import { createHash, timingSafeEqual } from 'node:crypto'
import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'

/**
 * Login social do app (plugin `expo` do Better Auth) sem login CSRF no host `app.` (achado 105 da revisão;
 * decisão na seção "Identidade" de docs/architecture/adr-tenant-hosts.md).
 *
 * O `expoClient` inicia o login por `fetch` (o `state` assinado fica no SecureStore do app) e abre o navegador
 * do sistema em `/expo-authorization-proxy?authorizationURL=<URL do provedor>`, que grava no navegador o cookie
 * assinado de `state` e redireciona. Sem nada mais, esse endpoint plantava no navegador de QUALQUER pessoa o
 * `state` de QUALQUER login (inclusive um login web iniciado pelo atacante) e redirecionava para qualquer https:
 * o callback aberto depois pela vítima criava nela a sessão da conta do atacante. Duas regras, juntas:
 *
 * 1. o proxy só leva à URL do provedor que o servidor emitiu para um login do APP (o que volta por deep link:
 *    `callbackURL`, `newUserCallbackURL` e `errorCallbackURL` num esquema de app confiável, sem vínculo de
 *    conta). A emissão fica registrada (SHA-256 da URL, mesma validade do `state`) no fim de `/sign-in/social`;
 *    qualquer outra URL, `state` de login web ou `oauthState` recebe 400 sem cookie nem redirecionamento;
 * 2. a resposta que entrega a sessão ao app pelo deep link (`?cookie=` do plugin `expo`) não deixa sessão no
 *    navegador: só saem os Set-Cookie que apagam. O app recebe a sessão só pela sessão de login que ele mesmo
 *    abriu (`openAuthSessionAsync`); um deep link avulso é ignorado pela tela `/auth/callback`.
 *
 * Assim, um login do app levado ao navegador da vítima termina sem sessão nela, e um login web nunca é plantado.
 * O plugin entra na lista DEPOIS do `expo()`: os hooks `after` de plugins rodam na ordem da lista, e o do
 * `expo` precisa copiar o Set-Cookie para o deep link antes de ele sair do navegador.
 */

/** Prefixo do registro da URL do provedor emitida para um login do app (tabela de verificação, identificador com hash). */
const APP_AUTHORIZATION_PREFIX = 'app-authorization:'

const digest = (value: string) =>
  createHash('sha256').update(value).digest('base64url')

function sameDigest(stored: string, presented: string): boolean {
  const expected = Buffer.from(stored)
  const received = Buffer.from(digest(presented))
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  )
}

/** URL absoluta num esquema que não é web (o deep link do app); relativa ou http(s) não é. */
function isAppDeepLink(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const { protocol } = new URL(value)
    return protocol !== 'http:' && protocol !== 'https:'
  } catch {
    return false
  }
}

/** O login guardado no `state` volta só ao app: todo destino é deep link confiável e não há vínculo de conta. */
function deliveredToApp(
  data: Record<string, unknown>,
  trusted: (_url: string) => boolean
): boolean {
  if (data.link !== undefined && data.link !== null) return false
  const destinations = [data.callbackURL, data.newUserURL, data.errorURL]
  if (!isAppDeepLink(data.callbackURL)) return false
  return destinations.every(
    (destination) =>
      destination === undefined ||
      destination === null ||
      (isAppDeepLink(destination) && trusted(destination))
  )
}

/** Set-Cookie que só apaga um cookie (`Max-Age` <= 0 ou `Expires` no passado). */
function onlyExpires(setCookie: string): boolean {
  for (const attribute of setCookie.split(';').slice(1)) {
    const separator = attribute.indexOf('=')
    const name = (separator === -1 ? attribute : attribute.slice(0, separator))
      .trim()
      .toLowerCase()
    const value = separator === -1 ? '' : attribute.slice(separator + 1).trim()
    if (name === 'max-age' && Number(value) <= 0) return true
    if (name === 'expires' && Date.parse(value) <= Date.now()) return true
  }
  return false
}

const refused = () =>
  new APIError('BAD_REQUEST', { message: 'Invalid authorizationURL' })

/** Os caminhos em que o plugin `expo` entrega os cookies ao app pelo deep link (o mesmo casamento dele). */
const deliversCookiesToApp = (path: string | undefined) =>
  Boolean(
    path?.startsWith('/callback') ||
    path?.startsWith('/magic-link/verify') ||
    path?.startsWith('/verify-email')
  )

export function appAuthorization() {
  return {
    id: 'app-authorization',
    hooks: {
      before: [
        {
          matcher: (context) => context.path === '/expo-authorization-proxy',
          handler: createAuthMiddleware(async (ctx) => {
            const query = (ctx.query ?? {}) as Record<string, unknown>
            // `oauthState` é do armazenamento de state em cookie; aqui o state é do banco.
            if (query.oauthState !== undefined) throw refused()
            const { authorizationURL } = query
            if (typeof authorizationURL !== 'string') throw refused()
            let state: string | null
            try {
              state = new URL(authorizationURL).searchParams.get('state')
            } catch {
              throw refused()
            }
            if (!state) throw refused()
            const issued =
              await ctx.context.internalAdapter.findVerificationValue(
                `${APP_AUTHORIZATION_PREFIX}${state}`
              )
            if (
              !issued ||
              new Date(issued.expiresAt).getTime() <= Date.now() ||
              !sameDigest(issued.value, authorizationURL)
            )
              throw refused()
          }),
        },
      ],
      after: [
        {
          matcher: (context) => context.path === '/sign-in/social',
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as { url?: unknown } | null
            const url =
              returned && typeof returned === 'object' ? returned.url : null
            if (typeof url !== 'string') return
            let state: string | null
            try {
              state = new URL(url).searchParams.get('state')
            } catch {
              return
            }
            if (!state) return
            const stored =
              await ctx.context.internalAdapter.findVerificationValue(state)
            if (!stored) return
            let data: unknown
            try {
              data = JSON.parse(stored.value)
            } catch {
              return
            }
            if (
              !data ||
              typeof data !== 'object' ||
              !deliveredToApp(data as Record<string, unknown>, (value) =>
                ctx.context.isTrustedOrigin(value)
              )
            )
              return
            await ctx.context.internalAdapter.createVerificationValue({
              identifier: `${APP_AUTHORIZATION_PREFIX}${state}`,
              value: digest(url),
              expiresAt: stored.expiresAt,
            })
          }),
        },
        {
          matcher: (context) => deliversCookiesToApp(context.path),
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.context.responseHeaders
            if (!headers || !isAppDeepLink(headers.get('location'))) return
            const kept = headers.getSetCookie().filter(onlyExpires)
            headers.delete('set-cookie')
            for (const cookie of kept) headers.append('set-cookie', cookie)
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin
}
