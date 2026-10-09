// Configuração da identidade multi-host (ADR adr-tenant-hosts, D6/D7 e Lote 6): baseURL estático no app,
// origens confiáveis por requisição com a origem EXATA da borda e nenhuma origem web estática.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PLATFORM_EDGE_HEADER,
  betterAuthBasePath,
} from '@gb-locacoes/contracts/platform'
import {
  identityConfiguration,
  originFor,
  trustedOriginsFor,
} from '../../packages/backend/src/modules/identity/configuration'

// Regra única modo → basePath do Better Auth (achado 113): a implementação real do contrato; um caso troca a resposta
// para provar que o backend a consulta em vez de repetir o mapeamento.
const rule = vi.hoisted(() => ({ basePath: vi.fn() }))
vi.mock('@gb-locacoes/contracts/platform', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/contracts/platform')>()
  rule.basePath.mockImplementation(actual.betterAuthBasePath)
  return { ...actual, betterAuthBasePath: rule.basePath }
})

beforeEach(() => {
  rule.basePath.mockClear()
})

const EDGE_SECRET = 'fixture-edge-secret-with-more-than-32-chars'
const production = {
  AUTH_MODE: 'better-auth',
  BETTER_AUTH_URL: 'https://app.plataforma.example',
  BETTER_AUTH_SECRET: 'fixture-identity-secret-more-than-thirty-two',
  AUTH_TRUSTED_ORIGINS: 'locadora://',
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'plataforma.example',
  PLATFORM_EDGE_SECRET: EDGE_SECRET,
  WEB_API_ORIGIN: 'https://backend.example',
}

function edgeRequest(
  host: { kind: 'tenant'; slug: string } | { kind: 'app' } | { kind: 'apex' },
  secret = EDGE_SECRET
) {
  const origin =
    host.kind === 'tenant'
      ? `https://${host.slug}.plataforma.example`
      : host.kind === 'app'
        ? 'https://app.plataforma.example'
        : 'https://plataforma.example'
  return new Request('https://backend.example/api/auth/get-session', {
    headers: {
      [PLATFORM_EDGE_HEADER.auth]: secret,
      [PLATFORM_EDGE_HEADER.hostKind]: host.kind,
      [PLATFORM_EDGE_HEADER.origin]: origin,
      ...(host.kind === 'tenant'
        ? { [PLATFORM_EDGE_HEADER.tenantSlug]: host.slug }
        : {}),
    },
  })
}

describe('configuração da identidade por host', () => {
  it('baseURL estático no app e cookies seguros em https', () => {
    const config = identityConfiguration(production)
    expect(config.baseURL).toBe('https://app.plataforma.example')
    expect(config.secureCookies).toBe(true)
    expect(config.trustedOrigins).toEqual([
      'https://app.plataforma.example',
      'locadora://',
    ])
  })

  it('fora de development, BETTER_AUTH_URL precisa ser a origem do app', () => {
    for (const url of [
      'https://plataforma.example',
      'https://locadora-a.plataforma.example',
      'https://app.outra.example',
    ]) {
      expect(() =>
        identityConfiguration({ ...production, BETTER_AUTH_URL: url })
      ).toThrow('BETTER_AUTH_URL must be the app origin')
    }
    expect(() =>
      identityConfiguration({
        ...production,
        PLATFORM_ENV: 'staging',
        PLATFORM_ROOT_DOMAIN: 'staging.plataforma.example',
      })
    ).toThrow('BETTER_AUTH_URL must be the app origin')
  })

  it('login por host exige o ambiente da plataforma; o legado segue sem ele', () => {
    const withoutPlatform = {
      AUTH_V2_ENABLED: 'true',
      BETTER_AUTH_URL: 'https://legado.example',
      BETTER_AUTH_SECRET: production.BETTER_AUTH_SECRET,
      NODE_ENV: 'production',
    }
    expect(identityConfiguration(withoutPlatform).mode).toBe('legacy')
    expect(() =>
      identityConfiguration({ ...withoutPlatform, AUTH_MODE: 'better-auth' })
    ).toThrow()
  })

  it('nenhuma origem web estática nem curinga', () => {
    expect(() =>
      identityConfiguration({
        ...production,
        AUTH_TRUSTED_ORIGINS: 'https://locadora-b.plataforma.example',
      })
    ).toThrow('AUTH_TRUSTED_ORIGINS accepts only app schemes')
    expect(() =>
      identityConfiguration({
        ...production,
        AUTH_TRUSTED_ORIGINS: 'https://*.plataforma.example',
      })
    ).toThrow('Authentication origins must be explicit')
    expect(() =>
      identityConfiguration({ ...production, AUTH_TRUSTED_ORIGINS: 'exp://' })
    ).toThrow('exp:// is only trusted in development')
    expect(() =>
      identityConfiguration({
        ...production,
        BETTER_AUTH_TRUSTED_ORIGINS: 'https://*.plataforma.example',
      })
    ).toThrow('BETTER_AUTH_TRUSTED_ORIGINS is not supported')
  })

  it('confia só na origem exata do host da requisição (borda validada)', () => {
    const config = identityConfiguration(production)
    const a = edgeRequest({ kind: 'tenant', slug: 'locadora-a' })
    expect(trustedOriginsFor(config, a)).toEqual([
      'https://app.plataforma.example',
      'locadora://',
      'https://locadora-a.plataforma.example',
    ])
    expect(trustedOriginsFor(config, a)).not.toContain(
      'https://locadora-b.plataforma.example'
    )
    expect(trustedOriginsFor(config, edgeRequest({ kind: 'app' }))).toEqual([
      'https://app.plataforma.example',
      'locadora://',
    ])
    // Apex não fala com a identidade; borda sem segredo é ignorada.
    expect(trustedOriginsFor(config, edgeRequest({ kind: 'apex' }))).toEqual(
      config.trustedOrigins
    )
    expect(
      trustedOriginsFor(
        config,
        edgeRequest({ kind: 'tenant', slug: 'locadora-a' }, 'x'.repeat(40))
      )
    ).toEqual(config.trustedOrigins)
    expect(trustedOriginsFor(config)).toEqual(config.trustedOrigins)
  })

  it('links de e-mail usam a origem do host de onde veio o pedido', () => {
    const config = identityConfiguration(production)
    expect(
      originFor(config, edgeRequest({ kind: 'tenant', slug: 'locadora-a' }))
    ).toBe('https://locadora-a.plataforma.example')
    expect(originFor(config, edgeRequest({ kind: 'app' }))).toBe(
      'https://app.plataforma.example'
    )
    expect(
      originFor(
        config,
        edgeRequest({ kind: 'tenant', slug: 'locadora-a' }, 'x'.repeat(40))
      )
    ).toBe('https://app.plataforma.example')
    expect(originFor(config)).toBe('https://app.plataforma.example')
  })
})

describe('basePath do Better Auth pela regra única da plataforma', () => {
  const coexistence = {
    AUTH_V2_ENABLED: 'true',
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: production.BETTER_AUTH_SECRET,
  }

  it('corte (better-auth) no basePath do modo better-auth; coexistência (legacy) no do modo better-auth-v2', () => {
    const cut = betterAuthBasePath('better-auth')
    const v2 = betterAuthBasePath('better-auth-v2')
    // Os valores da regra: o mesmo basePath que os clientes web e mobile usam em cada modo.
    expect([cut, v2]).toEqual(['/api/auth', '/api/auth/v2'])
    expect(identityConfiguration(production).basePath).toBe(cut)
    expect(identityConfiguration(coexistence).basePath).toBe(v2)
  })

  it('a regra é consultada, não repetida: o basePath que ela devolve é o da identidade', () => {
    // Respostas que um mapeamento repetido no backend não daria (os dois basePath trocados).
    rule.basePath.mockReturnValueOnce('/api/auth/v2')
    expect(identityConfiguration(production).basePath).toBe('/api/auth/v2')
    expect(rule.basePath).toHaveBeenLastCalledWith('better-auth')
    rule.basePath.mockReturnValueOnce('/api/auth')
    expect(identityConfiguration(coexistence).basePath).toBe('/api/auth')
    expect(rule.basePath).toHaveBeenLastCalledWith('better-auth-v2')
  })
})
