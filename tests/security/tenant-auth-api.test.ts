// V26 contra a identidade real: a API de conta do Better Auth fica só no host `app`. Monta a instância de
// `@gb-locacoes/backend/identity` (sem banco: nenhuma chamada é feita) e percorre TODOS os endpoints que ela expõe,
// nos dois basePath e em cada modo de autenticação do host web. Num host de locadora, só a lista mínima da vitrine
// passa pelo proxy, e só no basePath do Better Auth do modo (no `better-auth-v2`, `/api/auth` é o NextAuth: achado 9);
// qualquer endpoint novo de uma atualização do Better Auth nasce negado ali até entrar na lista com motivo.
import { describe, expect, it } from 'vitest'
import {
  classifyHost,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { createIdentity } from '../../packages/backend/src/modules/identity/factory'
import { identityConfiguration } from '../../packages/backend/src/modules/identity/configuration'
import type { HostAuthMode } from '../../apps/clients/web/src/host/auth/mode'
import { decide } from '../../apps/clients/web/src/host/routing/decide'
import {
  BETTER_AUTH_BASE_PATHS,
  betterAuthBasePath,
} from '../../apps/clients/web/src/host/routing/route-table'

/** Endpoints do Better Auth que a vitrine usa, com o motivo (o resto da API só no app). */
const TENANT_MINIMAL: Record<string, string> = {
  '/get-session': 'hostAuth.getSession',
  '/sign-in/email': 'hostAuth.signInCredentials',
  '/sign-in/social':
    'hostAuth.signInProvider (início; o callback do provedor é do app)',
  '/callback/:id/oauth-proxy':
    'conclusão do oauth-proxy no host de origem (T10)',
  '/sign-out': 'hostAuth.signOut',
}

/**
 * Caminhos do Better Auth em `/api/auth` que uma rota própria do backend atende antes do catch-all (Next prioriza o
 * segmento estático): a vitrine chama a rota própria, com as regras dela.
 * As descrições preservam as antigas app/api/auth/reset-password/route.ts e app/api/auth/verify-email/route.ts, retiradas em F; são metadados dos consumidores originais, não imports da raiz.
 */
const OWN_ROUTE_SHADOWS: Record<string, string> = {
  '/reset-password': 'app/api/auth/reset-password/route.ts (ResetPasswordPage)',
  '/verify-email':
    'app/api/auth/verify-email/route.ts (link do e-mail de verificação)',
}

const env = resolvePlatformEnv({
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: 'segredo-de-borda-de-teste-com-mais-de-32-caracteres',
  WEB_API_ORIGIN: 'https://backend.example',
})

const MODES: readonly HostAuthMode[] = [
  'legacy',
  'better-auth',
  'better-auth-v2',
]

/**
 * Backend de cada modo do host web: `better-auth` com o backend em `AUTH_MODE=better-auth`; `better-auth-v2` com o
 * backend em `AUTH_MODE=legacy` e `AUTH_V2_ENABLED=true` (o NextAuth fica com `/api/auth`).
 */
const BACKEND_ENV: Readonly<
  Record<Exclude<HostAuthMode, 'legacy'>, Record<string, string>>
> = {
  'better-auth': { AUTH_MODE: 'better-auth' },
  'better-auth-v2': { AUTH_MODE: 'legacy', AUTH_V2_ENABLED: 'true' },
}

const identityEnv = (backend: Record<string, string>) => ({
  ...backend,
  BETTER_AUTH_URL: 'https://app.plataforma.example',
  BETTER_AUTH_SECRET: 'segredo-de-identidade-de-teste-com-mais-de-32',
  GOOGLE_CLIENT_ID: 'fixture-google-client',
  GOOGLE_CLIENT_SECRET: 'fixture-google-secret',
})

function endpoints(): { path: string; methods: string[] }[] {
  const config = identityConfiguration(identityEnv(BACKEND_ENV['better-auth']))
  const auth = createIdentity({} as never, config, {
    sendPasswordReset: async () => undefined,
    sendEmailVerification: async () => undefined,
  })
  return Object.values(auth.api)
    .map(
      (endpoint) =>
        endpoint as unknown as {
          path?: string
          options?: { method?: string | string[] }
        }
    )
    .filter(
      (
        endpoint
      ): endpoint is {
        path: string
        options?: { method?: string | string[] }
      } => typeof endpoint.path === 'string'
    )
    .map((endpoint) => ({
      path: endpoint.path,
      methods: [endpoint.options?.method ?? 'GET'].flat(),
    }))
}

const concrete = (path: string) =>
  path.replace(':id', 'google').replace(':token', 'token-x')
const at = (
  host: string,
  pathname: string,
  method: string,
  authMode: HostAuthMode
) =>
  decide({ ...env, authMode }, classifyHost(host, env), {
    pathname,
    search: '',
    method,
  })

describe('API do Better Auth por host (V26)', () => {
  const all = endpoints()

  it('a instância real expõe a API de conta que precisa ficar fora da vitrine', () => {
    const paths = all.map((endpoint) => endpoint.path)
    for (const path of [
      '/list-sessions',
      '/revoke-session',
      '/revoke-sessions',
      '/update-user',
      '/change-email',
      '/delete-user',
      '/list-accounts',
      '/link-social',
      ...Object.keys(TENANT_MINIMAL),
    ]) {
      expect(paths, path).toContain(path)
    }
  })

  it('o basePath do Better Auth de cada modo do host web é o que o backend daquele modo configura', () => {
    for (const [mode, backend] of Object.entries(BACKEND_ENV) as [
      Exclude<HostAuthMode, 'legacy'>,
      Record<string, string>,
    ][]) {
      expect(identityConfiguration(identityEnv(backend)).basePath, mode).toBe(
        betterAuthBasePath(mode)
      )
    }
    expect(betterAuthBasePath('legacy')).toBeNull()
  })

  it('host de locadora: só a lista mínima passa, só com login por subdomínio e só no basePath do modo; o resto 404', () => {
    for (const { path, methods } of all) {
      for (const base of BETTER_AUTH_BASE_PATHS) {
        const pathname = base + concrete(path)
        for (const mode of MODES) {
          // As rotas próprias em /api/auth (segmento estático) vencem o catch-all em qualquer modo com conta.
          const minimal =
            mode !== 'legacy' &&
            ((base === betterAuthBasePath(mode) && path in TENANT_MINIMAL) ||
              (base === '/api/auth' && path in OWN_ROUTE_SHADOWS))
          for (const method of methods) {
            const decision = at(
              'locadora-a.plataforma.example',
              pathname,
              method,
              mode
            )
            if (minimal)
              expect(decision, `${mode} ${method} ${pathname}`).toMatchObject({
                type: 'backend',
                edge: { hostKind: 'tenant', tenantSlug: 'locadora-a' },
              })
            else
              expect(decision, `${mode} ${method} ${pathname}`).toMatchObject({
                type: 'respond',
                status: 404,
              })
          }
        }
      }
    }
  })

  it('host app: toda a API de conta segue ao backend com a borda do app, em qualquer modo', () => {
    for (const { path, methods } of all) {
      for (const base of BETTER_AUTH_BASE_PATHS) {
        const pathname = base + concrete(path)
        for (const method of methods) {
          for (const mode of MODES) {
            expect(
              at('app.plataforma.example', pathname, method, mode),
              `${mode} ${method} ${pathname}`
            ).toMatchObject({
              type: 'backend',
              edge: { hostKind: 'app', tenantSlug: null },
            })
          }
        }
      }
    }
  })
})
