// @vitest-environment jsdom
// Host de locadora x NextAuth, por modo de autenticação (achado 9 da revisão adversarial).
//
// O NextAuth (`apps/services/api/src/app/api/auth/[...nextauth]`) atende `/api/auth/*` sempre que o backend está em `AUTH_MODE=legacy`: no
// modo `legacy` do host web e no `better-auth-v2` (Better Auth em `/api/auth/v2`, com `AUTH_V2_ENABLED`). Ele lê a ação
// só do primeiro segmento e o provedor do segundo, e ignora o resto: `/api/auth/callback/credentials/oauth-proxy` é o
// callback de credenciais dele, que grava a sessão NextAuth no host da locadora. A regra do host: o callback de
// provedor existe só no app, então nenhuma entrada que o host de locadora repassa ao backend pode cair numa ação do
// NextAuth além da sessão que o shell lê no `legacy` (`/api/auth/session`), em nenhum modo.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifyHost,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import type { HostAuthMode } from '../auth/mode'
import { decide } from './decide'
import {
  TENANT_ACCOUNT_API,
  TENANT_API_ALLOWLIST,
  TENANT_API_DENYLIST,
  betterAuthBasePath,
  isTenantApiAllowed,
  type PathPattern,
} from './route-table'

const repoRoot = path.resolve(__dirname, '../../../../../..')
const webRoot = path.join(repoRoot, 'apps', 'clients', 'web')

/**
 * O NextAuth que o host web declara (`apps/clients/web/package.json`), resolvido a partir do próprio host e não do
 * `node_modules` da raiz: o modelo do teste segue a versão que o web instala, mesmo depois que a raiz legada sair.
 */
function webNextAuthFile(...segments: string[]) {
  // O `exports` do pacote não publica o package.json; a entrada principal (`./index.js`) fica na raiz do pacote.
  const entry = createRequire(path.join(webRoot, 'package.json')).resolve(
    'next-auth'
  )
  return path.join(path.dirname(entry), ...segments)
}

/** O catch-all do NextAuth na API compartilhada (`apps/services/api`), o backend que o host web chama. */
const SERVICE_NEXTAUTH_ROUTE = path.join(
  repoRoot,
  'apps',
  'services',
  'api',
  'src',
  'app',
  'api',
  'auth',
  '[...nextauth]',
  'route.ts'
)

const MODES: readonly HostAuthMode[] = [
  'legacy',
  'better-auth',
  'better-auth-v2',
]

/** Onde o backend atende o NextAuth em cada modo do host web (`null`: `[...nextauth]` delega ao Better Auth). */
const NEXTAUTH_BASE: Readonly<Record<HostAuthMode, '/api/auth' | null>> = {
  legacy: '/api/auth',
  'better-auth': null,
  'better-auth-v2': '/api/auth',
}

/** Rotas próprias em `/api/auth` (segmento estático vence o catch-all do NextAuth no App Router). */
const OWN_AUTH_ROUTES = new Set([
  'v2',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'organizations',
])

/** Ações do NextAuth 4 (`next-auth/core/index.js`, GET e POST). */
const NEXTAUTH_ACTIONS = [
  'providers',
  'session',
  'csrf',
  'signin',
  'signout',
  'callback',
  'verify-request',
  'error',
  '_log',
]

/** Ação do NextAuth que o backend executaria para o caminho no modo, ou `null` quando outro handler o atende. */
function nextAuthAction(mode: HostAuthMode, pathname: string): string | null {
  const base = NEXTAUTH_BASE[mode]
  if (base === null || !pathname.startsWith(base + '/')) return null
  const [action] = pathname.slice(base.length + 1).split('/')
  return action && !OWN_AUTH_ROUTES.has(action) ? action : null
}

const PROVIDERS = ['credentials', 'google', 'facebook', 'email']
const concrete = (pattern: PathPattern, segment: string) =>
  pattern.replace(/\/\*\*$/, `/${segment}/x`).replace(/\*/g, segment)

/**
 * Candidatos: toda entrada das listas do host, concretizada com cada provedor, e cada ação do NextAuth com o provedor e
 * segmentos a mais (o que o NextAuth ignora).
 */
const CANDIDATES = [
  ...new Set([
    ...[
      ...TENANT_API_ALLOWLIST,
      ...Object.values(TENANT_ACCOUNT_API).flat(),
      ...TENANT_API_DENYLIST,
    ].flatMap((pattern) =>
      PROVIDERS.map((provider) => concrete(pattern, provider))
    ),
    ...NEXTAUTH_ACTIONS.flatMap((action) =>
      [
        '',
        ...PROVIDERS.flatMap((provider) => [
          `/${provider}`,
          `/${provider}/oauth-proxy`,
          `/${provider}/x/y`,
        ]),
      ].map((rest) => `/api/auth/${action}${rest}`)
    ),
  ]),
]

const env = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: 'x'.repeat(32),
  WEB_API_ORIGIN: 'https://backend.example',
})
const onTenant = (authMode: HostAuthMode, pathname: string, method: string) =>
  decide(
    { ...env, authMode },
    classifyHost('locadora-a.plataforma.example', env),
    { pathname, search: '', method }
  )

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('host de locadora x NextAuth, por modo', () => {
  it('o modelo segue o NextAuth instalado: ação no primeiro segmento, provedor no segundo, o resto ignorado', () => {
    // A cópia que o host web declara (a versão exata do package.json dele), não a que a raiz do repositório instala.
    expect(
      JSON.parse(readFileSync(webNextAuthFile('package.json'), 'utf8')).version
    ).toBe(
      JSON.parse(readFileSync(path.join(webRoot, 'package.json'), 'utf8'))
        .dependencies['next-auth']
    )
    const handler = readFileSync(webNextAuthFile('next', 'index.js'), 'utf8')
    expect(handler).toMatch(/action: nextauth === null [^,]*nextauth\[0\]/)
    expect(handler).toMatch(/providerId: nextauth === null [^,]*nextauth\[1\]/)
    expect(handler).not.toContain('nextauth[2]')
    const core = readFileSync(webNextAuthFile('core', 'index.js'), 'utf8')
    for (const action of NEXTAUTH_ACTIONS)
      expect(core, action).toContain(`case "${action}":`)
  })

  it('a entrada do NextAuth na API compartilhada fica com /api/auth/*, salvo quando o modo delega ao Better Auth', () => {
    const route = readFileSync(SERVICE_NEXTAUTH_ROUTE, 'utf8')
    expect(route).toContain("identityMode(process.env) === 'better-auth'")
    expect(route).toMatch(/return handleIdentityRequest\(request\)/)
    expect(route).toMatch(/export \{ handler as GET, handler as POST \}/)
  })

  it.each(MODES)(
    '%s: das ações do NextAuth, o host de locadora só alcança a sessão',
    (mode) => {
      const reached = new Map<string, string[]>()
      for (const pathname of CANDIDATES) {
        for (const method of ['GET', 'POST']) {
          const action = nextAuthAction(mode, pathname)
          if (
            action === null ||
            onTenant(mode, pathname, method).type !== 'backend'
          )
            continue
          reached.set(action, [
            ...(reached.get(action) ?? []),
            `${method} ${pathname}`,
          ])
        }
      }
      expect([...reached.keys()]).toEqual(
        NEXTAUTH_BASE[mode] === null ? [] : ['session']
      )
      expect(reached.get('session') ?? []).toEqual(
        NEXTAUTH_BASE[mode] === null
          ? []
          : ['GET /api/auth/session', 'POST /api/auth/session']
      )
    }
  )

  it('o callback de credenciais do NextAuth com segmento a mais responde 404 onde /api/auth é o NextAuth', () => {
    const notFound = { type: 'respond', status: 404 }
    const oauthProxy = '/api/auth/callback/credentials/oauth-proxy'
    expect(onTenant('legacy', oauthProxy, 'POST')).toMatchObject(notFound)
    expect(onTenant('better-auth-v2', oauthProxy, 'POST')).toMatchObject(
      notFound
    )
    // No better-auth, /api/auth é o Better Auth: é a conclusão do oauth-proxy dele (T10).
    expect(onTenant('better-auth', oauthProxy, 'POST')).toMatchObject({
      type: 'backend',
      pathname: oauthProxy,
    })
    for (const mode of MODES)
      expect(
        onTenant(mode, '/api/auth/callback/credentials/x/y', 'POST')
      ).toMatchObject(notFound)
  })

  it('a conclusão do oauth-proxy passa só no basePath do Better Auth do modo', () => {
    for (const mode of MODES) {
      const base = betterAuthBasePath(mode)
      for (const candidate of ['/api/auth', '/api/auth/v2']) {
        const decision = onTenant(
          mode,
          `${candidate}/callback/google/oauth-proxy`,
          'GET'
        )
        expect(decision.type, `${mode} ${candidate}`).toBe(
          candidate === base ? 'backend' : 'respond'
        )
      }
    }
    expect(betterAuthBasePath('legacy')).toBeNull()
    expect(betterAuthBasePath(undefined)).toBeNull()
  })

  it.each(['better-auth', 'better-auth-v2'] as const)(
    '%s: o cliente do host (host/auth/client.ts) chama só o basePath que o proxy deixa passar no modo',
    async (mode) => {
      vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', mode)
      vi.resetModules()
      const calls: string[] = []
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async (input: string | URL | Request) => {
          calls.push(
            new URL(input instanceof Request ? input.url : String(input))
              .pathname
          )
          return new Response('null', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
      )
      const { hostAuth } = await import('../auth/client')
      await hostAuth.getSession()
      await hostAuth
        .signInCredentials('cliente@example.test', 'senha-de-teste')
        .catch(() => undefined)
      await hostAuth.signOut().catch(() => undefined)
      const base = betterAuthBasePath(mode)
      expect(calls).toEqual([
        `${base}/get-session`,
        `${base}/sign-in/email`,
        `${base}/sign-out`,
      ])
      for (const call of calls) {
        expect(isTenantApiAllowed(call, mode), call).toBe(true)
        // O mesmo endpoint no basePath do outro modo não passa (em better-auth-v2, /api/auth é o NextAuth).
        const other =
          base === '/api/auth'
            ? call.replace('/api/auth/', '/api/auth/v2/')
            : call.replace('/api/auth/v2/', '/api/auth/')
        expect(isTenantApiAllowed(other, mode), other).toBe(false)
      }
    }
  )
})
