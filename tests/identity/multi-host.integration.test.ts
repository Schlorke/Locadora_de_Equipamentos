import { withTestPlatformTransaction } from '../helpers/platform-fixture'
// T9 e T10 da ADR docs/architecture/adr-tenant-hosts.md: identidade multi-host pelo caminho real
// (lib/identity.ts → Better Auth → Prisma no PostgreSQL descartável), com as requisições chegando ao backend
// como o proxy do host web as entrega (URL do backend + contexto de borda assinado + Origin do navegador).
// Achados 5, 6 e 8 da revisão da onda 4:
// - 5: os endpoints nativos do motor que mandam e-mail a um endereço anônimo (cadastro, pedido de redefinição e
//   reenvio de verificação) ficam fora do HTTP; a única porta são as rotas próprias, com limite e resposta neutra;
// - 6: a conclusão do oauth-proxy fica presa ao navegador e ao host que iniciaram o login;
// - 8: os links de e-mail só saem na origem da locadora para o cliente só dela.
// Achado 105 da revisão adversarial: o login social do app (plugin `expo`) segue funcionando, e o
// `expo-authorization-proxy` não planta mais `state` de outro login nem deixa sessão no navegador.
import { randomUUID } from 'node:crypto'
import { CookieJar } from 'jsdom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PLATFORM, PLATFORM_EDGE_HEADER } from '@gb-locacoes/contracts/platform'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/prisma', async () => {
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
    testPool: pool,
  }
})
vi.mock('@/lib/resend', () => ({
  default: () => ({ emails: { send: mocks.send } }),
}))

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getIdentity, handleIdentityRequest } from '@/lib/identity'

const EDGE_SECRET = 'fixture-edge-secret-with-more-than-32-chars'
const ROOT = 'plataforma.example'
const APP = `https://app.${ROOT}`
const BACKEND = 'https://backend.example'
const fixture = randomUUID()
const slugA = `alfa-${fixture.slice(0, 8)}`
const slugB = `beta-${fixture.slice(0, 8)}`
const originA = `https://${slugA}.${ROOT}`
const originB = `https://${slugB}.${ROOT}`
const email = `multi-host-${fixture}@example.test`
// Contas com vínculos (achado 8): equipe de A, cliente de A e equipe de B, papel global de equipe, vínculo
// revogado e cliente de A ainda sem verificar o e-mail.
const staffEmail = `multi-host-staff-${fixture}@example.test`
const mixedEmail = `multi-host-mixed-${fixture}@example.test`
const globalAdminEmail = `multi-host-global-${fixture}@example.test`
const revokedEmail = `multi-host-revoked-${fixture}@example.test`
const unverifiedEmail = `multi-host-unverified-${fixture}@example.test`
// Cliente ACTIVE de A e de B; cliente de A com vínculo de cliente revogado em B; conta sem vínculo nenhum.
const dualEmail = `multi-host-dual-${fixture}@example.test`
const formerEmail = `multi-host-former-${fixture}@example.test`
const loneEmail = `multi-host-lone-${fixture}@example.test`
// Cliente só de B (locadora suspensa num dos casos).
const bOnlyEmail = `multi-host-b-only-${fixture}@example.test`
const linkedEmails = [
  email,
  staffEmail,
  mixedEmail,
  globalAdminEmail,
  revokedEmail,
  unverifiedEmail,
  dualEmail,
  formerEmail,
  loneEmail,
  bOnlyEmail,
]
// CPF de uma conta existente e os e-mails das sondas do cadastro nativo (achado 5).
const takenCpf = `cpf-taken-${fixture}`
const nativeSignupEmails = [
  `multi-host-native-taken-${fixture}@example.test`,
  `multi-host-native-free-${fixture}@example.test`,
]
const tenantA = `multi-host-${fixture}-a`
const tenantB = `multi-host-${fixture}-b`
const signupEmail = `multi-host-signup-${fixture}@example.test`
const appSignupEmail = `multi-host-app-signup-${fixture}@example.test`
const oauthEmail = `multi-host-oauth-${fixture}@example.test`
const password = 'multi-host-fixture-password'
// Um IP por requisição (o Better Auth agrupa IPv6 por /64): as janelas de rate limit por IP e rota não se
// somam entre casos.
const ipPrefix = `2001:db8:${fixture.slice(0, 4)}:`
let requests = 0
const nextIp = () => `${ipPrefix}${(++requests).toString(16)}::1`
const SESSION_COOKIE = `__Host-${PLATFORM.name}.session_token`
const STATE_COOKIE = `__Host-${PLATFORM.name}.state`
const env = {
  AUTH_MODE: 'better-auth',
  AUTH_V2_ENABLED: 'false',
  BETTER_AUTH_URL: APP,
  BETTER_AUTH_SECRET: 'fixture-multi-host-identity-secret-more-than-32',
  AUTH_TRUSTED_ORIGINS: `${PLATFORM.appScheme}://`,
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: ROOT,
  PLATFORM_EDGE_SECRET: EDGE_SECRET,
  WEB_API_ORIGIN: BACKEND,
  GOOGLE_CLIENT_ID: 'fixture-google-client',
  GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
  FROM_EMAIL: 'identidade@example.test',
}

type Host = 'a' | 'b' | 'app'
const originOf = (host: Host) =>
  host === 'a' ? originA : host === 'b' ? originB : APP

/** Headers que o proxy do host web define (e só ele, com o segredo) ao reescrever para o backend. */
function edgeHeaders(host: Host): Record<string, string> {
  return {
    [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
    [PLATFORM_EDGE_HEADER.hostKind]: host === 'app' ? 'app' : 'tenant',
    [PLATFORM_EDGE_HEADER.origin]: originOf(host),
    ...(host === 'app'
      ? {}
      : { [PLATFORM_EDGE_HEADER.tenantSlug]: host === 'a' ? slugA : slugB }),
  }
}

/** Requisição de navegador no host `host`, como chega ao backend (URL do backend, borda e cookies do jar). */
async function call(
  host: Host,
  path: string,
  options: {
    body?: unknown
    origin?: string | null
    jar?: CookieJar
    method?: string
  } = {}
) {
  const cookie = options.jar
    ? await options.jar.getCookieString(`${originOf(host)}${path}`)
    : ''
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST')
  const origin = options.origin === undefined ? originOf(host) : options.origin
  const response = await handleIdentityRequest(
    new Request(`${BACKEND}${path}`, {
      method,
      headers: {
        ...edgeHeaders(host),
        'x-forwarded-for': nextIp(),
        ...(origin && method !== 'GET' ? { origin } : {}),
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    })
  )
  if (options.jar)
    for (const value of response.headers.getSetCookie())
      await options.jar.setCookie(value, `${originOf(host)}${path}`)
  return response
}

/** Jar com as regras de navegador para prefixos (`__Host-` exige Secure, Path=/ e nenhum Domain). */
const browserJar = () =>
  new CookieJar(undefined, { looseMode: false, prefixSecurity: 'strict' })

const sessionCookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .find((value) => value.split('=')[0]?.includes('session_token'))

// Provedor OAuth simulado: só o endpoint de token do Google responde; nenhuma outra rede.
/** Conta do Google que o provedor devolve; um caso do achado 105 troca por uma conta ainda sem cadastro. */
const googleAccount = { sub: `google-${fixture}`, email: oauthEmail }
const newOauthEmail = `multi-host-oauth-new-${fixture}@example.test`
function unsignedIdToken(claims: Record<string, unknown>) {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(claims)}.fixture`
}
const fetchStub = vi.fn(async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url === 'https://oauth2.googleapis.com/token') {
    const now = Math.floor(Date.now() / 1000)
    return Response.json({
      access_token: 'fixture-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile',
      id_token: unsignedIdToken({
        iss: 'https://accounts.google.com',
        aud: env.GOOGLE_CLIENT_ID,
        sub: googleAccount.sub,
        email: googleAccount.email,
        email_verified: true,
        name: 'OAuth Fixture',
        iat: now,
        exp: now + 3600,
      }),
    })
  }
  throw new Error(`External network forbidden in identity tests: ${url}`)
})

/** Início do login social no host `host` (no navegador `jar`): devolve a URL do provedor. */
async function startSocial(host: Host, callbackURL: string, jar?: CookieJar) {
  const response = await call(host, '/api/auth/sign-in/social', {
    body: { provider: 'google', callbackURL },
    jar,
  })
  return { response, body: (await response.json()) as { url?: string } }
}

/** Login social iniciado no host `host` pelo navegador `jar`, até a URL de conclusão que o app devolve. */
async function startedCompletion(host: Host, jar: CookieJar) {
  const { response, body } = await startSocial(host, '/area-cliente', jar)
  expect(response.status).toBe(200)
  const completion = await providerCallback(body.url!)
  expect(completion.origin).toBe(originOf(host))
  return completion
}

const pathOf = (url: URL) => `${url.pathname}${url.search}`
const errorOf = (response: Response) =>
  new URL(response.headers.get('location')!).searchParams.get('error')
/** Par `nome=valor` de um cookie do navegador `jar` no host `origin`. */
const cookiePair = async (jar: CookieJar, origin: string, name: string) =>
  (await jar.getCookieString(`${origin}/`))
    .split('; ')
    .find((pair) => pair.startsWith(`${name}=`))

/** O Google devolve o navegador ao callback FIXO no app; o app encaminha ao host de origem. */
async function providerCallback(providerUrl: string) {
  const authorize = new URL(providerUrl)
  const redirectUri = authorize.searchParams.get('redirect_uri')
  const state = authorize.searchParams.get('state')
  expect(redirectUri).toBe(`${APP}/api/auth/callback/google`)
  const callback = new URL(redirectUri!)
  callback.searchParams.set('code', 'fixture-code')
  callback.searchParams.set('state', state!)
  const response = await call('app', `${callback.pathname}${callback.search}`)
  expect(response.status).toBe(302)
  return new URL(response.headers.get('location')!)
}

const startedAt = new Date()
beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  vi.stubGlobal('fetch', fetchStub)
  mocks.send.mockResolvedValue({ data: { id: 'fixture' }, error: null })
  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Multi-host fixture',
      password: hash,
      authEmailVerified: true,
      cpf: takenCpf,
    },
  })
  await prisma.authAccount.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: hash,
    },
  })
  await prisma.organization.createMany({
    data: [
      { id: tenantA, slug: slugA, name: 'Locadora Alfa' },
      { id: tenantB, slug: slugB, name: 'Locadora Beta' },
    ],
  })
  const others = await Promise.all(
    [
      { email: staffEmail, role: 'CLIENT' as const, verified: true },
      { email: mixedEmail, role: 'CLIENT' as const, verified: true },
      { email: globalAdminEmail, role: 'ADMIN' as const, verified: true },
      { email: revokedEmail, role: 'CLIENT' as const, verified: true },
      { email: unverifiedEmail, role: 'CLIENT' as const, verified: false },
      { email: dualEmail, role: 'CLIENT' as const, verified: true },
      { email: formerEmail, role: 'CLIENT' as const, verified: true },
      { email: loneEmail, role: 'CLIENT' as const, verified: true },
      { email: bOnlyEmail, role: 'CLIENT' as const, verified: true },
    ].map((account) =>
      prisma.user.create({
        data: {
          email: account.email,
          name: 'Multi-host vínculo',
          role: account.role,
          authEmailVerified: account.verified,
        },
      })
    )
  )
  const idOf = (address: string) =>
    [user, ...others].find((row) => row.email === address)!.id
  await prisma.membership.createMany({
    data: [
      { tenantId: tenantA, userId: idOf(email), role: 'CLIENT' },
      { tenantId: tenantA, userId: idOf(staffEmail), role: 'ADMIN' },
      { tenantId: tenantA, userId: idOf(mixedEmail), role: 'CLIENT' },
      { tenantId: tenantB, userId: idOf(mixedEmail), role: 'OPERATOR' },
      { tenantId: tenantA, userId: idOf(globalAdminEmail), role: 'CLIENT' },
      {
        tenantId: tenantA,
        userId: idOf(revokedEmail),
        role: 'CLIENT',
        status: 'REVOKED',
      },
      { tenantId: tenantA, userId: idOf(unverifiedEmail), role: 'CLIENT' },
      { tenantId: tenantA, userId: idOf(dualEmail), role: 'CLIENT' },
      { tenantId: tenantB, userId: idOf(dualEmail), role: 'CLIENT' },
      { tenantId: tenantA, userId: idOf(formerEmail), role: 'CLIENT' },
      { tenantId: tenantB, userId: idOf(bOnlyEmail), role: 'CLIENT' },
      {
        tenantId: tenantB,
        userId: idOf(formerEmail),
        role: 'CLIENT',
        status: 'REVOKED',
      },
    ],
  })
})
afterAll(async () => {
  const tenants = { tenantId: { in: [tenantA, tenantB] } }
  await prisma.auditLog.deleteMany({ where: tenants })
  await prisma.membership.deleteMany({ where: tenants })
  await prisma.organization.deleteMany({
    where: { id: { in: [tenantA, tenantB] } },
  })
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          ...linkedEmails,
          ...nativeSignupEmails,
          signupEmail,
          appSignupEmail,
          oauthEmail,
          newOauthEmail,
        ],
      },
    },
  })
  await prisma.authRateLimit.deleteMany({
    where: { key: { contains: ipPrefix } },
  })
  // Estados OAuth e tokens de e-mail emitidos por estes casos (banco exclusivo, arquivos em série).
  await prisma.authVerification.deleteMany({
    where: { createdAt: { gte: startedAt } },
  })
  await prisma.$disconnect()
  const { testPool } = (await import('@/lib/prisma')) as unknown as {
    testPool: { end(): Promise<void> }
  }
  await testPool.end()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('T9: sessão por host', () => {
  it('Set-Cookie __Host-<plataforma>.session_token, Secure, Path=/ e sem Domain', async () => {
    const jar = browserJar()
    const response = await call('a', '/api/auth/sign-in/email', {
      body: { email, password },
      jar,
    })
    expect(response.status).toBe(200)
    const cookie = sessionCookieOf(response)
    expect(cookie?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
    expect(cookie).not.toMatch(/__Secure-/)
    expect(cookie).not.toMatch(/;\s*domain=/i)
    expect(cookie).toMatch(/;\s*secure/i)
    expect(cookie).toMatch(/;\s*path=\/(;|$)/i)
    expect(cookie).toMatch(/;\s*httponly/i)
    // O jar estrito aceitou o prefixo __Host- (o navegador também aceita).
    expect(await jar.getCookieString(`${originA}/`)).toContain(
      `${SESSION_COOKIE}=`
    )
  })

  it('a sessão criada no host A não vale no host B', async () => {
    const jar = browserJar()
    await call('a', '/api/auth/sign-in/email', {
      body: { email, password },
      jar,
    })
    // Cookie host-only: o navegador nunca o envia a outro subdomínio da raiz.
    expect(await jar.getCookieString(`${originB}/`)).not.toContain(
      'session_token'
    )
    expect(await jar.getCookieString(`https://${ROOT}/`)).not.toContain(
      'session_token'
    )
    const onA = await call('a', '/api/auth/get-session', { jar })
    expect((await onA.json())?.user?.email).toBe(email)
    const onB = await call('b', '/api/auth/get-session', { jar })
    expect(await onB.json()).toBeNull()
  })

  it('POST com Origin de B no host A responde 403', async () => {
    const signIn = await call('a', '/api/auth/sign-in/email', {
      body: { email, password },
      origin: originB,
    })
    expect(signIn.status).toBe(403)
    expect(sessionCookieOf(signIn)).toBeUndefined()

    // Com o cookie de A, uma mutação iniciada pela origem de B também é recusada.
    const jar = browserJar()
    await call('a', '/api/auth/sign-in/email', {
      body: { email, password },
      jar,
    })
    const crossSignOut = await call('a', '/api/auth/sign-out', {
      body: {},
      origin: originB,
      jar,
    })
    expect(crossSignOut.status).toBe(403)
    expect(
      (await (await call('a', '/api/auth/get-session', { jar })).json())?.user
        ?.email
    ).toBe(email)
  })
})

describe('configuração que o comportamento não expõe sozinho', () => {
  it('baseURL estático, cookies host-only sem crossSubDomain e sem cabeçalhos x-forwarded', async () => {
    const { options } = await getIdentity()
    // O prefixo __Host- já descarta Domain do cookie de sessão; os demais cookies dependem destas opções.
    expect(options.baseURL).toBe(APP)
    expect(options.advanced?.crossSubDomainCookies?.enabled).toBe(false)
    expect(options.advanced?.trustedProxyHeaders).toBe(false)
    expect(options.advanced?.useSecureCookies).toBe(false)
    expect(options.advanced?.defaultCookieAttributes?.secure).toBe(true)
    expect(options.advanced?.cookiePrefix).toBe(PLATFORM.name)
    expect(typeof options.trustedOrigins).toBe('function')
  })
})

describe('T10: oauth-proxy com callback fixo no app', () => {
  it('login social no host A cria a sessão em A (callback registrado só no app)', async () => {
    const jar = browserJar()
    const { response, body } = await startSocial('a', '/area-cliente', jar)
    expect(response.status).toBe(200)
    // O início grava no host A o state assinado: host-only (__Host-), Lax e curto.
    const stateCookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${STATE_COOKIE}=`))
    expect(stateCookie).toMatch(/;\s*secure/i)
    expect(stateCookie).toMatch(/;\s*samesite=lax/i)
    expect(stateCookie).toMatch(/;\s*max-age=300/i)
    expect(stateCookie).toMatch(/;\s*path=\/(;|$)/i)
    expect(stateCookie).not.toMatch(/;\s*domain=/i)
    expect(await jar.getCookieString(`${originB}/`)).not.toContain('.state')
    const completion = await providerCallback(body.url!)
    expect(completion.origin).toBe(originA)
    expect(completion.pathname).toBe('/api/auth/callback/google/oauth-proxy')

    const done = await call('a', pathOf(completion), { jar })
    expect(done.status).toBe(302)
    expect(done.headers.get('location')).toBe('/area-cliente')
    expect(sessionCookieOf(done)?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
    expect(await jar.getCookieString(`${originB}/`)).not.toContain(
      'session_token'
    )
    const created = await prisma.user.findUniqueOrThrow({
      where: { email: oauthEmail },
    })
    expect(created.role).toBe('CLIENT')
  })

  it('callbackURL de outro host é rejeitado no início e na conclusão', async () => {
    const start = await startSocial('a', `${originB}/area-cliente`)
    expect(start.response.status).toBe(403)
    expect(start.body.url).toBeUndefined()
    // No app, a origem de uma locadora também não é destino confiável.
    expect(
      (await startSocial('app', `${originA}/area-cliente`)).response.status
    ).toBe(403)

    // Mesmo no navegador que iniciou (state conferido), o destino adulterado é recusado.
    const jar = browserJar()
    const completion = await startedCompletion('a', jar)
    completion.searchParams.set('callbackURL', `${originB}/area-cliente`)
    const tampered = await call('a', pathOf(completion), { jar })
    expect(tampered.status).toBe(403)
    expect(sessionCookieOf(tampered)).toBeUndefined()
  })

  it('replay do payload responde state_mismatch, com ou sem o cookie de state', async () => {
    const jar = browserJar()
    const completion = await startedCompletion('a', jar)
    // Quem guardou o state assinado antes da conclusão.
    const saved = await cookiePair(jar, originA, STATE_COOKIE)
    expect(saved).toBeTruthy()
    const first = await call('a', pathOf(completion), { jar })
    expect(first.status).toBe(302)
    expect(first.headers.get('location')).toBe('/area-cliente')
    // O mesmo navegador: a conclusão apagou o cookie de state.
    const replay = await call('a', pathOf(completion), { jar })
    expect(replay.status).toBe(302)
    expect(errorOf(replay)).toBe('state_mismatch')
    expect(sessionCookieOf(replay)).toBeUndefined()
    // Com o cookie guardado: o estado de uso único já saiu do banco.
    const copy = browserJar()
    await copy.setCookie(`${saved}; Secure; Path=/`, `${originA}/`)
    const stored = await call('a', pathOf(completion), { jar: copy })
    expect(stored.status).toBe(302)
    expect(errorOf(stored)).toBe('state_mismatch')
    expect(sessionCookieOf(stored)).toBeUndefined()
  })

  it('payload com mais de 60 s responde payload_expired', async () => {
    const jar = browserJar()
    const completion = await startedCompletion('a', jar)
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    try {
      const late = await call('a', pathOf(completion), { jar })
      expect(late.status).toBe(302)
      expect(errorOf(late)).toBe('payload_expired')
      expect(sessionCookieOf(late)).toBeUndefined()
    } finally {
      clock.mockRestore()
    }
  })
})

describe('achado 6: conclusão do oauth-proxy presa ao navegador e ao host do início', () => {
  /** State assinado que o início gravou no navegador `jar` do host A (nome e valor). */
  async function attackerState(jar: CookieJar) {
    const pair = (await jar.getCookieString(`${originA}/`))
      .split('; ')
      .find((entry) => entry.split('=')[0]!.endsWith('.state'))!
    const name = pair.slice(0, pair.indexOf('='))
    return { name, value: pair.slice(name.length + 1) }
  }

  it('outro navegador: a URL de conclusão do atacante não cria sessão na vítima (login CSRF)', async () => {
    const attacker = browserJar()
    const completion = await startedCompletion('a', attacker)
    // A vítima abre a URL (navegação de topo vinda de qualquer site), sem o state do atacante.
    const victim = browserJar()
    const refused = await call('a', pathOf(completion), { jar: victim })
    expect(refused.status).toBe(302)
    expect(errorOf(refused)).toBe('state_mismatch')
    expect(sessionCookieOf(refused)).toBeUndefined()
    expect(await victim.getCookieString(`${originA}/`)).not.toContain(
      'session_token'
    )
    // Controle: a recusa não consumiu o estado; no navegador que iniciou, a mesma URL conclui.
    const own = await call('a', pathOf(completion), { jar: attacker })
    expect(own.headers.get('location')).toBe('/area-cliente')
    expect(sessionCookieOf(own)?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
  })

  it('outro navegador com o próprio login em andamento em A: o state dela, válido mas de outro login, não conclui o do atacante', async () => {
    const attacker = browserJar()
    const completion = await startedCompletion('a', attacker)
    // A vítima começou o próprio login social em A: tem um state assinado válido deste host, só que de outro login.
    const victim = browserJar()
    const started = await startSocial('a', '/area-cliente', victim)
    expect(started.response.status).toBe(200)
    const victimState = await cookiePair(victim, originA, STATE_COOKIE)
    const attackerStatePair = await cookiePair(attacker, originA, STATE_COOKIE)
    expect(victimState).toBeTruthy()
    expect(victimState).not.toBe(attackerStatePair)
    const refused = await call('a', pathOf(completion), { jar: victim })
    expect(refused.status).toBe(302)
    expect(errorOf(refused)).toBe('state_mismatch')
    expect(sessionCookieOf(refused)).toBeUndefined()
    expect(await victim.getCookieString(`${originA}/`)).not.toContain(
      'session_token'
    )
    // Controle: o login da própria vítima segue intacto e conclui no navegador dela.
    const own = await providerCallback(started.body.url!)
    expect(own.origin).toBe(originA)
    const done = await call('a', pathOf(own), { jar: victim })
    expect(done.headers.get('location')).toBe('/area-cliente')
    expect(sessionCookieOf(done)?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
  })

  it('outro host: a conclusão de A levada ao host B é recusada, mesmo com o state plantado em B', async () => {
    const attacker = browserJar()
    const completion = await startedCompletion('a', attacker)
    const { name, value } = await attackerState(attacker)
    // Um script em B (pixel ou XSS) planta no navegador da vítima, em B, o state assinado do atacante.
    const victim = browserJar()
    await victim.setCookie(`${name}=${value}; Secure; Path=/`, `${originB}/`)
    const onB = await call('b', pathOf(completion), { jar: victim })
    expect(onB.status).toBe(302)
    expect(errorOf(onB)).toBe('state_mismatch')
    expect(sessionCookieOf(onB)).toBeUndefined()
    expect(await victim.getCookieString(`${originB}/`)).not.toContain(
      'session_token'
    )
  })

  it('rota depreciada /oauth-proxy-callback: a mesma recusa no app (que encaminha todo /api/**) e em A; no navegador que iniciou, conclui', async () => {
    const attacker = browserJar()
    const completion = await startedCompletion('a', attacker)
    // O plugin mantém o alias antigo da conclusão, com a mesma query; ele chama a atual sem passar pelos hooks.
    const deprecated = `/api/auth/oauth-proxy-callback${completion.search}`
    // No app: vítima sem state e vítima com o state assinado do atacante plantado lá (a origem do início, A, não
    // é a desta conclusão). Em A: vítima sem state.
    const { name, value } = await attackerState(attacker)
    const planted = browserJar()
    await planted.setCookie(`${name}=${value}; Secure; Path=/`, `${APP}/`)
    const victims: Array<[Host, CookieJar]> = [
      ['app', browserJar()],
      ['app', planted],
      ['a', browserJar()],
    ]
    for (const [host, victim] of victims) {
      const refused = await call(host, deprecated, { jar: victim })
      expect(refused.status).toBe(302)
      expect(refused.headers.get('location')).toBe(
        `${APP}/api/auth/error?error=state_mismatch`
      )
      expect(sessionCookieOf(refused)).toBeUndefined()
      expect(await victim.getCookieString(`${originOf(host)}/`)).not.toContain(
        'session_token'
      )
    }
    // Controle: as recusas não consumiram o estado; no navegador e no host que iniciaram, o alias conclui.
    const own = await call('a', deprecated, { jar: attacker })
    expect(own.status).toBe(302)
    expect(own.headers.get('location')).toBe('/area-cliente')
    expect(sessionCookieOf(own)?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
  })

  it('um script de outra locadora não planta no host A um state com Domain da raiz', async () => {
    const attacker = browserJar()
    const completion = await startedCompletion('a', attacker)
    const { name, value } = await attackerState(attacker)
    // O script em B grava o state do atacante com Domain=<raiz>, com o nome que o servidor usa e sem prefixo:
    // o navegador recusa __Host- com Domain, e o servidor só lê o nome __Host-.
    const victim = browserJar()
    for (const tossed of [name, `${PLATFORM.name}.state`])
      await victim
        .setCookie(
          `${tossed}=${value}; Domain=${ROOT}; Secure; Path=/`,
          `${originB}/`
        )
        .catch(() => undefined)
    const refused = await call('a', pathOf(completion), { jar: victim })
    expect(refused.status).toBe(302)
    expect(errorOf(refused)).toBe('state_mismatch')
    expect(sessionCookieOf(refused)).toBeUndefined()
  })
})

/** Deep link de volta do login social do app (`Linking.createURL('/auth/callback')` no build de produção). */
const APP_CALLBACK = `${PLATFORM.appScheme}://auth/callback`

/**
 * Requisição do app como o `expoClient` a envia, pelo proxy do host `app.`: sem Origin (o plugin `expo` usa o
 * `expo-origin`), com `x-skip-oauth-proxy` e o cookie guardado no SecureStore.
 */
async function appRequest(
  path: string,
  options: { body?: unknown; cookie?: string } = {}
) {
  return handleIdentityRequest(
    new Request(`${BACKEND}${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      headers: {
        ...edgeHeaders('app'),
        'x-forwarded-for': nextIp(),
        'expo-origin': `${PLATFORM.appScheme}://`,
        'x-skip-oauth-proxy': 'true',
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    })
  )
}

/**
 * O app inicia o login social; devolve a URL do provedor que ele abre no navegador do sistema, pelo proxy.
 * `destinations`: `newUserCallbackURL` e `errorCallbackURL` que o pedido traz além do deep link de volta.
 */
async function startAppSocial(destinations: Record<string, string> = {}) {
  const response = await appRequest('/api/auth/sign-in/social', {
    body: { provider: 'google', callbackURL: APP_CALLBACK, ...destinations },
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { url: string }).url
}

/** `openAuthSessionAsync` do `expoClient`: a entrada do navegador do sistema no login do app. */
const expoProxy = (
  authorizationURL: string,
  extra: Record<string, string> = {}
) =>
  `/api/auth/expo-authorization-proxy?${new URLSearchParams({ authorizationURL, ...extra })}`

/** O provedor devolve o navegador ao callback fixo no app, com `code` e o `state` da URL do provedor. */
function providerReturn(providerUrl: string) {
  const authorize = new URL(providerUrl)
  const callback = new URL(authorize.searchParams.get('redirect_uri')!)
  callback.searchParams.set('code', 'fixture-code')
  callback.searchParams.set('state', authorize.searchParams.get('state')!)
  return pathOf(callback)
}

/** Cabeçalho Cookie que o app monta com o `?cookie=` do deep link (o valor do cookie de sessão). */
function appCookieFrom(delivered: string) {
  const token = delivered.match(
    new RegExp(`${SESSION_COOKIE.replace(/[.]/g, '\\.')}=([^;,\\s]+)`)
  )?.[1]
  expect(token).toBeTruthy()
  return `${SESSION_COOKIE}=${token}`
}

describe('achado 105: login social do app pelo expo-authorization-proxy sem login CSRF no host app', () => {
  it('o app conclui o login pelo navegador do sistema e recebe a sessão só pelo deep link; o navegador não guarda sessão', async () => {
    const providerUrl = await startAppSocial()
    expect(new URL(providerUrl).origin).toBe('https://accounts.google.com')
    // Navegador do sistema: jar próprio, sem os cookies que o app guardou.
    const browser = browserJar()
    const proxied = await call('app', expoProxy(providerUrl), { jar: browser })
    expect(proxied.status).toBe(302)
    expect(proxied.headers.get('location')).toBe(providerUrl)
    const done = await call('app', providerReturn(providerUrl), {
      jar: browser,
    })
    expect(done.status).toBe(302)
    const location = done.headers.get('location')!
    expect(location.startsWith(`${APP_CALLBACK}?`)).toBe(true)
    const delivered = new URL(location).searchParams.get('cookie')!
    expect(delivered).toContain(`${SESSION_COOKIE}=`)
    // A sessão é do app: nenhum Set-Cookie de sessão fica no navegador.
    expect(sessionCookieOf(done)).toBeUndefined()
    expect(await browser.getCookieString(`${APP}/`)).not.toContain(
      'session_token'
    )
    // O app guarda o cookie do deep link e o manda nas chamadas: a sessão vale.
    const session = await appRequest('/api/auth/get-session', {
      cookie: appCookieFrom(delivered),
    })
    expect(
      ((await session.json()) as { user?: { email?: string } })?.user?.email
    ).toBe(oauthEmail)
  })

  it('login web no app: o proxy não planta o state na vítima, e a URL de callback do atacante não cria sessão nela', async () => {
    const attacker = browserJar()
    const { response, body } = await startSocial(
      'app',
      '/area-cliente',
      attacker
    )
    expect(response.status).toBe(200)
    const state = new URL(body.url!).searchParams.get('state')!
    const victim = browserJar()
    // O ataque do verificador (destino externo com o state) e a própria URL do provedor do login web.
    for (const target of [
      `https://evil.example/cb?state=${encodeURIComponent(state)}`,
      body.url!,
    ]) {
      const plant = await call('app', expoProxy(target), { jar: victim })
      expect(plant.status).toBe(400)
      expect(plant.headers.get('location')).toBeNull()
      expect(plant.headers.getSetCookie()).toEqual([])
    }
    const done = await call('app', providerReturn(body.url!), { jar: victim })
    expect(done.status).toBe(302)
    expect(errorOf(done)).toBe('state_mismatch')
    expect(sessionCookieOf(done)).toBeUndefined()
    expect(
      await (await call('app', '/api/auth/get-session', { jar: victim })).json()
    ).toBeNull()
    // Controle: a recusa não consumiu o estado; no navegador que iniciou, o login web conclui.
    const own = await call('app', providerReturn(body.url!), { jar: attacker })
    expect(own.headers.get('location')).toBe('/area-cliente')
    expect(sessionCookieOf(own)?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
  })

  it('o proxy só leva à URL que o servidor emitiu para aquele login do app, sem oauthState', async () => {
    const providerUrl = await startAppSocial()
    const state = new URL(providerUrl).searchParams.get('state')!
    const redirected = new URL(providerUrl)
    redirected.searchParams.set('redirect_uri', 'https://evil.example/cb')
    for (const path of [
      expoProxy(`https://evil.example/cb?state=${encodeURIComponent(state)}`),
      expoProxy(redirected.toString()),
      expoProxy(providerUrl, { oauthState: 'fixture-oauth-state' }),
      expoProxy(
        'https://accounts.google.com/o/oauth2/v2/auth?state=nunca-emitido'
      ),
    ]) {
      const refused = await call('app', path, { jar: browserJar() })
      expect(refused.status, path).toBe(400)
      expect(refused.headers.get('location'), path).toBeNull()
      expect(refused.headers.getSetCookie(), path).toEqual([])
    }
    // Controle: a URL emitida passa (as recusas não a consumiram).
    const issued = await call('app', expoProxy(providerUrl), {
      jar: browserJar(),
    })
    expect(issued.status).toBe(302)
    expect(issued.headers.get('location')).toBe(providerUrl)
  })

  it('login do app do atacante levado ao navegador da vítima: nenhuma sessão fica nela', async () => {
    // O atacante é um cliente legítimo do app: a URL do provedor foi emitida para o login dele.
    const providerUrl = await startAppSocial()
    const victim = browserJar()
    const planted = await call('app', expoProxy(providerUrl), { jar: victim })
    expect(planted.status).toBe(302)
    // A vítima abre o callback com o code do atacante: a sessão sai só no deep link (que o app dela ignora
    // sem uma sessão de login aberta por ele), nunca no navegador.
    const done = await call('app', providerReturn(providerUrl), {
      jar: victim,
    })
    expect(done.status).toBe(302)
    expect(done.headers.get('location')!.startsWith(`${APP_CALLBACK}?`)).toBe(
      true
    )
    expect(sessionCookieOf(done)).toBeUndefined()
    expect(await victim.getCookieString(`${APP}/`)).not.toContain(
      'session_token'
    )
    expect(
      await (await call('app', '/api/auth/get-session', { jar: victim })).json()
    ).toBeNull()
  })

  it('login do app com a conta nova voltando a uma página web: o proxy não planta, e a conta nova do atacante não vira sessão na vítima', async () => {
    // O deep link de volta é o do app, mas a conta NOVA iria para uma página web: o callback criaria a sessão no
    // navegador (Set-Cookie comum, sem deep link para o plugin `expo` levar nem para a retirada do navegador).
    const providerUrl = await startAppSocial({
      newUserCallbackURL: `${APP}/area-cliente`,
    })
    const victim = browserJar()
    const plant = await call('app', expoProxy(providerUrl), { jar: victim })
    expect(plant.status).toBe(400)
    expect(plant.headers.get('location')).toBeNull()
    expect(plant.headers.getSetCookie()).toEqual([])
    // O provedor devolve o code de uma conta Google do atacante ainda sem cadastro na plataforma.
    googleAccount.sub = `google-new-${fixture}`
    googleAccount.email = newOauthEmail
    try {
      const done = await call('app', providerReturn(providerUrl), {
        jar: victim,
      })
      expect(done.status).toBe(302)
      expect(errorOf(done)).toBe('state_mismatch')
      expect(sessionCookieOf(done)).toBeUndefined()
      expect(
        await (
          await call('app', '/api/auth/get-session', { jar: victim })
        ).json()
      ).toBeNull()
      expect(await prisma.user.count({ where: { email: newOauthEmail } })).toBe(
        0
      )
    } finally {
      googleAccount.sub = `google-${fixture}`
      googleAccount.email = oauthEmail
    }
  })

  it.each([
    [
      'conta nova numa página web',
      { newUserCallbackURL: `${APP}/area-cliente` },
    ],
    [
      'conta nova num caminho relativo',
      { newUserCallbackURL: '/area-cliente' },
    ],
    ['erro numa página web', { errorCallbackURL: `${APP}/login` }],
    ['erro num caminho relativo', { errorCallbackURL: '/login' }],
  ])(
    'o proxy recusa o login do app com algum destino fora do deep link (%s)',
    async (_label, destinations) => {
      const providerUrl = await startAppSocial(destinations)
      const refused = await call('app', expoProxy(providerUrl), {
        jar: browserJar(),
      })
      expect(refused.status).toBe(400)
      expect(refused.headers.get('location')).toBeNull()
      expect(refused.headers.getSetCookie()).toEqual([])
    }
  )

  it('controle: com conta nova e erro também no deep link do app, o proxy leva à URL do provedor', async () => {
    const providerUrl = await startAppSocial({
      newUserCallbackURL: `${PLATFORM.appScheme}://auth/callback`,
      errorCallbackURL: `${PLATFORM.appScheme}://auth/erro`,
    })
    const proxied = await call('app', expoProxy(providerUrl), {
      jar: browserJar(),
    })
    expect(proxied.status).toBe(302)
    expect(proxied.headers.get('location')).toBe(providerUrl)
  })

  it('vínculo de conta pelo app (link-social): o proxy não leva o navegador ao provedor', async () => {
    // Cliente com sessão no app (o fluxo do primeiro caso). Pelo proxy, o vínculo ligaria a conta Google de quem
    // abrisse o link à conta de quem o gerou.
    const providerUrl = await startAppSocial()
    const browser = browserJar()
    expect(
      (await call('app', expoProxy(providerUrl), { jar: browser })).status
    ).toBe(302)
    const done = await call('app', providerReturn(providerUrl), {
      jar: browser,
    })
    const cookie = appCookieFrom(
      new URL(done.headers.get('location')!).searchParams.get('cookie')!
    )
    const link = await appRequest('/api/auth/link-social', {
      body: { provider: 'google', callbackURL: APP_CALLBACK },
      cookie,
    })
    expect(link.status).toBe(200)
    const linkUrl = ((await link.json()) as { url: string }).url
    expect(new URL(linkUrl).origin).toBe('https://accounts.google.com')
    const refused = await call('app', expoProxy(linkUrl), {
      jar: browserJar(),
    })
    expect(refused.status).toBe(400)
    expect(refused.headers.get('location')).toBeNull()
    expect(refused.headers.getSetCookie()).toEqual([])
  })
})

const lastMail = () =>
  mocks.send.mock.calls.at(-1)?.[0] as { subject: string; text: string }
const linkOf = (text: string) => new URL(text.split('\n').at(-1)!)

/**
 * Como as rotas próprias (`/api/auth/register`, `/api/auth/forgot-password`) chamam o motor: direto, com a
 * requisição do navegador no host `host` (borda + Origin), para o callback de e-mail enxergar a borda.
 */
async function engineFrom(host: Host, path: string) {
  const request = new Request(`${BACKEND}${path}`, {
    method: 'POST',
    headers: {
      ...edgeHeaders(host),
      'x-forwarded-for': nextIp(),
      origin: originOf(host),
      'content-type': 'application/json',
    },
  })
  return {
    api: (await getIdentity()).api,
    input: { headers: request.headers, request, asResponse: true as const },
  }
}

describe('achado 5: endpoints nativos que mandam e-mail a um endereço anônimo ficam fora do HTTP', () => {
  // A borda do host app encaminha todo /api/** ao backend: sem isto, o motor respondia por conta própria, sem o
  // limite por conta e sem a resposta neutra das rotas próprias.
  it('app: /sign-up/email com o CPF de outra conta e com CPF livre respondem igual, sem criar conta nem mandar e-mail', async () => {
    mocks.send.mockClear()
    const answers = []
    for (const [address, cpf] of [
      [nativeSignupEmails[0]!, takenCpf],
      [nativeSignupEmails[1]!, `cpf-free-${fixture}`],
    ] as const) {
      const response = await call('app', '/api/auth/sign-up/email', {
        body: {
          email: address,
          name: 'Sonda',
          password,
          phone: '11999990000',
          cpf,
        },
      })
      answers.push({ status: response.status, body: await response.text() })
    }
    expect(answers[0]!.status).toBe(404)
    expect(answers[1]).toEqual(answers[0])
    expect(
      await prisma.user.count({ where: { email: { in: nativeSignupEmails } } })
    ).toBe(0)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('app: /request-password-reset responde igual para conta existente e inexistente, sem token nem e-mail', async () => {
    mocks.send.mockClear()
    const tokens = () =>
      prisma.authVerification.count({
        where: {
          identifier: { startsWith: 'reset-password:' },
          createdAt: { gte: startedAt },
        },
      })
    const before = await tokens()
    const answers = []
    for (const address of [email, `ninguem-${fixture}@example.test`]) {
      const response = await call('app', '/api/auth/request-password-reset', {
        body: { email: address, redirectTo: '/reset-password' },
      })
      answers.push({ status: response.status, body: await response.text() })
    }
    expect(answers[0]!.status).toBe(404)
    expect(answers[1]).toEqual(answers[0])
    expect(await tokens()).toBe(before)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('app: /send-verification-email para conta sem verificar responde 404, sem e-mail', async () => {
    mocks.send.mockClear()
    const response = await call('app', '/api/auth/send-verification-email', {
      body: { email: unverifiedEmail },
    })
    expect(response.status).toBe(404)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})

describe('achado 8: links de e-mail na origem da locadora só para o cliente só dela', () => {
  /** Origem do link de redefinição que a conta `address` recebe ao pedir no host `host` (caminho da rota própria). */
  async function resetLink(host: Host, address: string) {
    mocks.send.mockClear()
    const { api, input } = await engineFrom(host, '/api/auth/forgot-password')
    const response = await api.requestPasswordReset({
      ...input,
      body: { email: address, redirectTo: '/reset-password' },
    })
    expect(response.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const mail = lastMail()
    expect(mail.subject).toBe(`Recuperação de senha - ${PLATFORM.displayName}`)
    const link = linkOf(mail.text)
    expect(link.pathname).toBe('/reset-password')
    expect(link.searchParams.get('token')).toMatch(/^\S{16,}$/)
    return link.origin
  }

  it('cliente ACTIVE de A pedindo no host A: link na página de A; no app, no app', async () => {
    expect(await resetLink('a', email)).toBe(originA)
    expect(await resetLink('app', email)).toBe(APP)
  })

  it('admin de A pedindo a partir do host B (script em B): link no app, nunca em B', async () => {
    expect(await resetLink('b', staffEmail)).toBe(APP)
    // Nem no host da própria locadora: a conta de equipe é global.
    expect(await resetLink('a', staffEmail)).toBe(APP)
  })

  it('cliente de A pedindo no host B, sem vínculo com B: link no app', async () => {
    expect(await resetLink('b', email)).toBe(APP)
  })

  it('cliente de A que é equipe de B, com papel global de equipe ou com vínculo revogado: link no app', async () => {
    expect(await resetLink('a', mixedEmail)).toBe(APP)
    expect(await resetLink('a', globalAdminEmail)).toBe(APP)
    expect(await resetLink('a', revokedEmail)).toBe(APP)
  })

  it('cliente ACTIVE de A e de B: link no app nos dois hosts (um script em B tomaria a conta que também vale em A)', async () => {
    expect(await resetLink('b', dualEmail)).toBe(APP)
    expect(await resetLink('a', dualEmail)).toBe(APP)
  })

  it('cliente de A com vínculo de cliente revogado em B, ou conta sem vínculo nenhum: link no app', async () => {
    expect(await resetLink('a', formerEmail)).toBe(APP)
    expect(await resetLink('a', loneEmail)).toBe(APP)
  })

  it('cliente só de B com a locadora B suspensa: link no app; reativada, em B', async () => {
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: tenantB },
        data: { status: 'SUSPENDED' },
      })
    )
    try {
      expect(await resetLink('b', bOnlyEmail)).toBe(APP)
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: tenantB },
          data: { status: 'ACTIVE' },
        })
      )
    }
    expect(await resetLink('b', bOnlyEmail)).toBe(originB)
  })

  it('falha da consulta dos vínculos: link no app (falha fechada) e o log só com o nome do erro', async () => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const lookup = vi
      .spyOn(prisma.membership, 'findMany')
      .mockRejectedValueOnce(
        Object.assign(
          new Error(`connect ECONNREFUSED 10.0.0.7:5432 for ${email}`),
          { name: 'PrismaClientInitializationError' }
        )
      )
    try {
      expect(await resetLink('a', email)).toBe(APP)
      expect(lookup).toHaveBeenCalled()
      const events = JSON.stringify(logged.mock.calls)
      expect(events).toContain('account_link_origin_fallback')
      expect(events).toContain('PrismaClientInitializationError')
      for (const secret of ['10.0.0.7', email])
        expect(events).not.toContain(secret)
    } finally {
      lookup.mockRestore()
      logged.mockRestore()
    }
    // Controle: com a consulta de volta, o mesmo pedido sai na origem de A.
    expect(await resetLink('a', email)).toBe(originA)
  })

  it('verificação do cadastro: feito no host A, link em A (o token só confirma o e-mail digitado ali); feito no app, no app', async () => {
    const signUpFrom = async (host: Host, address: string) => {
      mocks.send.mockClear()
      const { api, input } = await engineFrom(host, '/api/auth/register')
      const response = await api.signUpEmail({
        ...input,
        body: {
          email: address,
          name: 'Cadastro multi-host',
          password,
          phone: '11999990000',
          cpf: `cpf-${address}`,
        },
      })
      expect(response.status).toBe(200)
      const mail = lastMail()
      expect(mail.subject).toBe(`Verifique seu email - ${PLATFORM.displayName}`)
      const link = linkOf(mail.text)
      expect(link.pathname).toBe('/api/auth/verify-email')
      expect(link.searchParams.get('token')).toBeTruthy()
      return link.origin
    }
    expect(await signUpFrom('a', signupEmail)).toBe(originA)
    expect(await signUpFrom('app', appSignupEmail)).toBe(APP)
  })

  it('verificação de conta que já tem vínculo: cliente só de A, em A; em B, no app', async () => {
    const resend = async (host: Host) => {
      mocks.send.mockClear()
      const { api, input } = await engineFrom(host, '/api/auth/register')
      const sent = await api.sendVerificationEmail({
        ...input,
        body: { email: unverifiedEmail },
      })
      expect(sent.status).toBe(200)
      expect(mocks.send).toHaveBeenCalledTimes(1)
      return linkOf(lastMail().text).origin
    }
    expect(await resend('a')).toBe(originA)
    expect(await resend('b')).toBe(APP)
  })
})
