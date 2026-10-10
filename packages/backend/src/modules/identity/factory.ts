import { AsyncLocalStorage } from 'node:async_hooks'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { symmetricDecrypt } from 'better-auth/crypto'
import { oAuthProxy } from 'better-auth/plugins/oauth-proxy'
import { expo } from '@better-auth/expo'
import { isOwnerAccountSignUp } from './owner-signup-context'
import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { appAuthorization } from './app-authorization'
import { trustedOriginsFor, type IdentityConfiguration } from './configuration'
import {
  AUTH_UNAVAILABLE_RETRY_SECONDS,
  synchronizeLegacyCredential,
  verifyLegacyCredential,
  type LegacySignInGuard,
} from './legacy-credentials'

export type IdentityMail = {
  sendPasswordReset(_input: { email: string; url: string }): Promise<void>
  sendEmailVerification(_input: { email: string; url: string }): Promise<void>
  /**
   * Orçamento silencioso do reenvio da verificação a uma conta ainda sem
   * verificar que repete o cadastro (`true`: pode sair mais um). Ausente, nada
   * é reenviado.
   */
  verificationResendAllowed?(_email: string): Promise<boolean>
}

const passwordMutations = new Set([
  '/sign-up/email',
  '/change-password',
  '/set-password',
  '/reset-password',
  '/request-password-reset',
])

/** Janela do payload cifrado do `oauth-proxy` (segundos). */
export const OAUTH_PROXY_MAX_AGE = 60

/** Maior senha aceita pelo motor (`maxPasswordLength`); as rotas próprias validam antes de chamá-lo. */
export const IDENTITY_MAX_PASSWORD_LENGTH = 128

/**
 * Nome do cookie de sessão. Em https é `__Host-` (host-only, `Secure`,
 * `Path=/`, sem `Domain`): exige `useSecureCookies: false` com `secure` nos
 * atributos, senão o Better Auth prefixaria `__Secure-__Host-`.
 */
export function sessionCookieName(
  config: Pick<IdentityConfiguration, 'secureCookies'>
): string {
  const name = `${PLATFORM.name}.session_token`
  return config.secureCookies ? `__Host-${name}` : name
}

/**
 * Nome do cookie assinado de `state` do OAuth, gravado por `/sign-in/social`
 * no host que iniciou o login (Lax, 300 s). Em https é `__Host-`: o navegador
 * recusa esse prefixo com `Domain`, então um script de outra locadora (irmã na
 * mesma raiz) não planta no host A um `state` que valha lá.
 */
export function stateCookieName(
  config: Pick<IdentityConfiguration, 'secureCookies'>
): string {
  const name = `${PLATFORM.name}.state`
  return config.secureCookies ? `__Host-${name}` : name
}

/** Conclusões do `oauth-proxy` (a depreciada chama a atual sem os hooks). */
const OAUTH_PROXY_COMPLETIONS = new Set([
  '/callback/:id/oauth-proxy',
  '/oauth-proxy-callback',
])

/**
 * A conclusão do `oauth-proxy` pertence ao navegador e ao host que iniciaram o
 * login? O plugin confere o `state` só no banco (`skipStateCookieCheck` fixo):
 * sem isto, a URL de conclusão de um login do atacante, aberta pela vítima em
 * até 60 s, criaria nela a sessão da conta do atacante (login CSRF), em
 * qualquer host de locadora. Exige as duas coisas:
 * - o cookie assinado de `state` deste host igual ao `state` do payload;
 * - a origem desta conclusão igual à origem gravada no início (a do
 *   `callbackURL` do estado guardado no banco).
 */
async function oauthProxyCompletionBound(input: {
  profile: string
  decrypt(_data: string): Promise<string>
  signedState(): Promise<string | null>
  startedAt(_state: string): Promise<string | null>
  completionURL: string | undefined
}): Promise<boolean> {
  let state: unknown
  try {
    state = (
      JSON.parse(await input.decrypt(input.profile)) as { state?: unknown }
    )?.state
  } catch {
    return false
  }
  if (typeof state !== 'string' || !state) return false
  const cookie = await input.signedState()
  if (!cookie || cookie !== state) return false
  const started = await input.startedAt(state)
  if (!started || !input.completionURL) return false
  try {
    return new URL(started).origin === new URL(input.completionURL).origin
  } catch {
    return false
  }
}

/**
 * Endpoints nativos que mandam e-mail a um endereço dado por quem não está
 * logado. Ficam fora do HTTP (`disabledPaths` vale só no roteador; a chamada
 * direta `auth.api.*` segue): a única porta são as rotas próprias
 * (`/api/auth/register` e `/api/auth/forgot-password`), com o limitador
 * persistente por IP e por conta, o orçamento silencioso de e-mails e a
 * resposta neutra decidida antes da busca. Pelo HTTP, o motor revelaria CPF
 * em uso (422 no cadastro), a existência da conta pelo tempo do envio e
 * mandaria e-mails sem limite por conta. Nenhuma tela chama estes caminhos.
 */
const ANONYMOUS_EMAIL_ENDPOINTS = [
  '/sign-up/email',
  '/request-password-reset',
  '/send-verification-email',
] as const

/**
 * Trabalho que só pode rodar depois do COMMIT da transação do motor em que foi
 * pedido. O cadastro (`/sign-up/email`) chama `sendVerificationEmail` DENTRO
 * da transação que cria o usuário, e ela segura uma conexão do pool até o fim.
 * O envio consulta os vínculos da conta (`accountLinkOrigin`) pelo cliente
 * global: no incidente da antiga `lib/prisma.ts`, retirada em F, o pool tinha
 * 1 conexão (2 no transaction pooler) e
 * a consulta esperava a conexão que a própria transação segurava, a transação
 * expirava, a conta não nascia e o e-mail saía assim mesmo.
 */
const pendingUntilCommit = new AsyncLocalStorage<Array<() => Promise<void>>>()

/**
 * O adaptador do motor com transações que, confirmadas, rodam o que ficou
 * para depois do commit (na ordem, com a conexão já devolvida ao pool). Uma
 * transação desfeita descarta tudo: nenhum e-mail para conta que não existe.
 * A falha de uma tarefa chega a quem chamou o motor, como nos hooks do Better
 * Auth depois do commit.
 */
function runningAfterCommit(
  database: ReturnType<typeof prismaAdapter>
): ReturnType<typeof prismaAdapter> {
  return (options) => {
    const adapter = database(options)
    const transaction = adapter.transaction.bind(adapter)
    adapter.transaction = async (callback) => {
      const pending: Array<() => Promise<void>> = []
      const result = await transaction((trx) =>
        pendingUntilCommit.run(pending, () => callback(trx))
      )
      for (const task of pending) await task()
      return result
    }
    return adapter
  }
}

/** Roda `task` agora ou, se pedida dentro de uma transação do motor, depois do commit dela. */
async function afterCommit(task: () => Promise<void>): Promise<void> {
  const pending = pendingUntilCommit.getStore()
  if (pending) pending.push(task)
  else await task()
}

/** Qual link de e-mail a conta recebe (`accountLinkOrigin`). */
type AccountLink = 'password-reset' | 'email-verification'

/**
 * Origem dos links de e-mail de identidade (redefinição de senha e
 * verificação). A conta é global: um link na origem de uma locadora entrega o
 * token a qualquer script daquela origem (pixel, XSS), e com ele a conta em
 * todos os hosts. A origem do host de locadora só vale quando a conta
 * pertence só àquela locadora:
 * - papel global de cliente e nenhum vínculo de equipe ou com outra locadora,
 *   em qualquer status (um cliente de A e de B com o link em B entregaria a
 *   um script de B a conta que também vale em A);
 * - e vínculo de cliente ACTIVE com a locadora ACTIVE daquele host. Na
 *   verificação, basta a conta ainda não ter vínculo nenhum: é o cadastro
 *   feito naquele host (o único caminho que manda verificação), cujo e-mail e
 *   senha foram digitados naquela origem, e o token só confirma o e-mail (sem
 *   sessão nem troca de senha).
 * Em todo outro caso (app, apex, sem borda, falha da consulta), a origem do
 * app (`baseURL`).
 *
 * O papel global vem do usuário que o motor entrega ao callback (lido do
 * banco na mesma requisição); os vínculos, de uma consulta à parte pelo
 * cliente global. Ela nunca pode rodar dentro de uma transação do motor: o
 * cadastro chama a verificação dentro da dele, então consulta e envio esperam
 * o commit (`afterCommit`), com a conta criada e nenhum vínculo.
 */
async function accountLinkOrigin(
  prisma: PrismaClient,
  config: Pick<IdentityConfiguration, 'baseURL' | 'readEdge'>,
  user: { id: string; role?: unknown },
  request: Request | undefined,
  link: AccountLink
): Promise<string> {
  const edge = request ? config.readEdge(request) : null
  if (edge?.hostKind !== 'tenant' || user.role !== 'CLIENT')
    return config.baseURL
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        status: true,
        organization: { select: { slug: true, status: true } },
      },
    })
    if (
      memberships.some(
        (m) => m.role !== 'CLIENT' || m.organization.slug !== edge.tenantSlug
      )
    )
      return config.baseURL
    const client = memberships.some(
      (m) => m.status === 'ACTIVE' && m.organization.status === 'ACTIVE'
    )
    const newAccount = link === 'email-verification' && memberships.length === 0
    return client || newAccount ? edge.origin : config.baseURL
  } catch (error) {
    console.error('[identity]', {
      event: 'account_link_origin_fallback',
      error: error instanceof Error ? error.name : 'unknown',
    })
    return config.baseURL
  }
}

/**
 * `legacySignIn` é obrigatório na coexistência (`AUTH_MODE=legacy`): o login
 * do Better Auth confere a senha legada pelo mesmo caminho e pelo mesmo
 * limitador persistente do login do NextAuth; sem ele, `/api/auth/v2` seria um
 * atalho sem limite.
 */
export function createIdentity(
  prisma: PrismaClient,
  config: IdentityConfiguration,
  mail: IdentityMail,
  legacySignIn?: LegacySignInGuard
) {
  if (config.mode === 'legacy' && !legacySignIn)
    throw new Error('Legacy coexistence sign-in requires the attempt guard')
  // Reenvio da verificação pelo endpoint do próprio motor (chamada direta, fora do HTTP); ligado depois de criado.
  let resendVerification:
    | ((_email: string, _request: Request | undefined) => Promise<Response>)
    | undefined
  const identity = betterAuth({
    appName: PLATFORM.displayName,
    baseURL: config.baseURL,
    basePath: config.basePath,
    secret: config.secret,
    // Origem EXATA do host da requisição (borda validada); nunca curinga.
    trustedOrigins: (request) => trustedOriginsFor(config, request),
    database: runningAfterCommit(
      prismaAdapter(prisma, {
        provider: 'postgresql',
        transaction: true,
      })
    ),
    user: {
      modelName: 'User',
      fields: { emailVerified: 'authEmailVerified' },
      additionalFields: {
        role: {
          type: ['ADMIN', 'FINANCIAL', 'OPERATOR', 'CLIENT'],
          defaultValue: 'CLIENT',
          input: false,
        },
        phone: { type: 'string', required: false },
        cpf: { type: 'string', required: false, returned: false },
        cnpj: { type: 'string', required: false, returned: false },
      },
    },
    session: {
      modelName: 'AuthSession',
      expiresIn: 24 * 60 * 60,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: 'AuthAccount',
      accountLinking: { enabled: true, trustedProviders: [] },
      // Estado do OAuth no banco: o `oauth-proxy` o consome uma única vez.
      storeStateStrategy: 'database',
    },
    verification: { modelName: 'AuthVerification', storeIdentifier: 'hashed' },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'AuthRateLimit',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/request-password-reset': { window: 60, max: 3 },
      },
    },
    advanced: {
      database: { generateId: false },
      disableOriginCheck: false,
      disableCSRFCheck: false,
      // Uma sessão por host: cookies host-only, nunca no domínio raiz.
      crossSubDomainCookies: { enabled: false },
      // A origem pública chega pela borda, nunca por x-forwarded-*.
      trustedProxyHeaders: false,
      useSecureCookies: false,
      cookiePrefix: PLATFORM.name,
      ...(config.secureCookies
        ? {
            defaultCookieAttributes: { secure: true },
            cookies: {
              session_token: {
                name: sessionCookieName(config),
                attributes: { secure: true, path: '/' },
              },
              // `state` do OAuth host-only de verdade (`__Host-`): preso ao host.
              state: {
                name: stateCookieName(config),
                attributes: { secure: true, path: '/' },
              },
            },
          }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: IDENTITY_MAX_PASSWORD_LENGTH,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: (password) => bcrypt.hash(password, 12),
        verify: ({ hash, password }) => bcrypt.compare(password, hash),
      },
      // Página do host de locadora só para quem é cliente só dela (accountLinkOrigin); senão, a do app.
      sendResetPassword: async ({ user, token }, request) =>
        mail.sendPasswordReset({
          email: user.email,
          url: `${await accountLinkOrigin(prisma, config, user, request, 'password-reset')}/reset-password?token=${encodeURIComponent(token)}`,
        }),
      // Quem repete o cadastro de uma conta ainda sem verificar recebe de novo a verificação (achado 106): o
      // motor responde igual a um cadastro novo, o orçamento por conta é silencioso e o envio espera o commit.
      onExistingUserSignUp: ({ user }, request) =>
        afterCommit(async () => {
          if (user.emailVerified || !mail.verificationResendAllowed) return
          try {
            if (!(await mail.verificationResendAllowed(user.email))) return
            const response = await resendVerification?.(user.email, request)
            if (response && !response.ok)
              console.error('[identity]', {
                event: 'verification_resend_failed',
                status: response.status,
              })
          } catch (error) {
            console.error('[identity]', {
              event: 'verification_resend_failed',
              error: error instanceof Error ? error.name : 'unknown',
            })
          }
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      // No cadastro, chamado dentro da transação que cria o usuário: consulta e envio esperam o commit.
      // A entrega que falha depois do COMMIT não desfaz o cadastro (a conta já existe): vai só para o log, sem
      // endereço nem mensagem do provedor, e o cadastro repetido reenvia (onExistingUserSignUp).
      sendVerificationEmail: ({ user, url }, request) =>
        afterCommit(async () => {
          // Mesmo caminho e token; a origem segue accountLinkOrigin.
          const link = new URL(url)
          try {
            await mail.sendEmailVerification({
              email: user.email,
              url: `${await accountLinkOrigin(prisma, config, user, request, 'email-verification')}${link.pathname}${link.search}`,
            })
          } catch (error) {
            console.error('[identity]', {
              event: 'verification_email_failed',
              error: error instanceof Error ? error.name : 'unknown',
            })
          }
        }),
    },
    // Só pelas rotas próprias (limite e resposta neutra); a chamada direta segue valendo.
    disabledPaths: [...ANONYMOUS_EMAIL_ENDPOINTS],
    socialProviders: {
      ...(config.google ? { google: config.google } : {}),
      ...(config.facebook ? { facebook: config.facebook } : {}),
    },
    plugins: [
      expo(),
      // Callback OAuth fixo no app; a sessão nasce no host de origem.
      oAuthProxy({
        productionURL: config.baseURL,
        maxAge: OAUTH_PROXY_MAX_AGE,
      }),
      // Depois do expo(): o proxy do navegador do sistema só leva à URL emitida para um login do app, e a sessão
      // que vai ao app pelo deep link não fica no navegador (login CSRF no host app, achado 105).
      appAuthorization(),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          OAUTH_PROXY_COMPLETIONS.has(ctx.path) &&
          typeof ctx.query?.profile === 'string'
        ) {
          // Antes do plugin consumir o estado: navegador e host do início.
          const bound = await oauthProxyCompletionBound({
            profile: ctx.query.profile,
            decrypt: (data) =>
              symmetricDecrypt({ key: ctx.context.secretConfig, data }),
            signedState: async () => {
              const value = await ctx.getSignedCookie(
                ctx.context.createAuthCookie('state').name,
                ctx.context.secret
              )
              return typeof value === 'string' ? value : null
            },
            startedAt: async (state) => {
              const stored =
                await ctx.context.internalAdapter.findVerificationValue(state)
              if (!stored) return null
              try {
                const { callbackURL } = JSON.parse(stored.value) as {
                  callbackURL?: unknown
                }
                return typeof callbackURL === 'string' ? callbackURL : null
              } catch {
                return null
              }
            },
            completionURL: ctx.request?.url,
          })
          if (!bound)
            throw ctx.redirect(
              `${config.baseURL}/api/auth/error?error=state_mismatch`
            )
        }
        if (
          config.credentialWritesPaused &&
          (passwordMutations.has(ctx.path) || ctx.path === '/verify-email')
        ) {
          throw new APIError('SERVICE_UNAVAILABLE', {
            message: 'Credential maintenance in progress',
          })
        }
        if (config.mode === 'legacy' && passwordMutations.has(ctx.path)) {
          throw new APIError('FORBIDDEN', {
            message:
              'Credential changes use the legacy endpoint during coexistence',
          })
        }
        if (ctx.path === '/sign-in/email') {
          if (typeof ctx.body?.email === 'string')
            ctx.body.email = ctx.body.email.trim().toLowerCase()
          if (config.mode === 'legacy' && legacySignIn) {
            // Mesmo caminho do login legado: tentativa contada antes da busca,
            // igualdade exata do e-mail e bcrypt fictício sem conta.
            // Limitador que não conta (segredo ausente, banco fora): 503 com
            // Retry-After, nunca 429 nem 500; a causa só no log, sem mensagem.
            const unavailable = () =>
              new APIError(
                'SERVICE_UNAVAILABLE',
                { message: 'Authentication unavailable' },
                {
                  'Retry-After': String(AUTH_UNAVAILABLE_RETRY_SECONDS),
                  'Cache-Control': 'no-store',
                }
              )
            let verification: Awaited<ReturnType<typeof verifyLegacyCredential>>
            try {
              verification = await verifyLegacyCredential(
                { db: prisma, guard: legacySignIn },
                {
                  email: ctx.body?.email,
                  password: ctx.body?.password,
                  ip: legacySignIn.clientIp(
                    ctx.headers ?? ctx.request?.headers
                  ),
                }
              )
            } catch (error) {
              console.error('[identity]', {
                event: 'sign_in_unavailable',
                error: error instanceof Error ? error.name : 'unknown',
              })
              throw unavailable()
            }
            if (verification.status === 'rate-limited')
              throw new APIError(
                'TOO_MANY_REQUESTS',
                { message: 'Too many sign-in attempts', code: 'RATE_LIMITED' },
                {
                  'Retry-After': String(
                    Math.max(
                      1,
                      Math.ceil((verification.resetTime - Date.now()) / 1000)
                    )
                  ),
                }
              )
            if (verification.status === 'unavailable') throw unavailable()
            if (verification.status !== 'authenticated')
              throw new APIError('UNAUTHORIZED', {
                message: 'Invalid email or password',
              })
            await synchronizeLegacyCredential(prisma, verification.account)
          }
        }
        if (ctx.path === '/sign-up/email' && !isOwnerAccountSignUp(ctx.body)) {
          const { phone, cpf, cnpj } = ctx.body || {}
          if (
            typeof phone !== 'string' ||
            phone.length < 10 ||
            (!cpf && !cnpj)
          ) {
            throw new APIError('BAD_REQUEST', {
              message: 'Phone and CPF or CNPJ are required',
            })
          }
        }
      }),
    },
  })
  // O endpoint decide sozinho: conta inexistente ou já verificada não recebe nada. Sem o cookie do visitante, para
  // nunca cair no ramo de sessão; com a requisição, para a origem do link seguir accountLinkOrigin.
  resendVerification = (email, request) => {
    const headers = new Headers(request?.headers)
    headers.delete('cookie')
    return identity.api.sendVerificationEmail({
      body: { email },
      headers,
      ...(request ? { request } : {}),
      asResponse: true,
    })
  }
  return identity
}

export type Identity = ReturnType<typeof createIdentity>
