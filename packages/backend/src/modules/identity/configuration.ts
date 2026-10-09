/**
 * Configuração da identidade (Better Auth) para os hosts da plataforma.
 * ADR docs/architecture/adr-tenant-hosts.md (D6, D7 e "Identidade (Lote 6)").
 *
 * - `baseURL` é estático: a origem do host `app` (`BETTER_AUTH_URL`). Nunca
 *   `allowedHosts` com curinga: um curinga viraria origem confiável para todas
 *   as locadoras.
 * - As origens confiáveis de navegador vêm por requisição: a origem EXATA que o
 *   proxy calculou para o host (borda validada por segredo). Estáticas só o app
 *   e os schemes do aplicativo (`AUTH_TRUSTED_ORIGINS`).
 * - Fora de development, `BETTER_AUTH_URL` precisa ser a origem canônica do
 *   host `app` do ambiente da plataforma.
 */
import {
  betterAuthBasePath,
  canonicalOrigin,
  resolvePlatformEnv,
  type BetterAuthBasePath,
  type PlatformEnv,
} from '@gb-locacoes/contracts/platform'
import {
  readPlatformEdgeContext,
  type PlatformEdgeContext,
} from './platform-edge'

export type IdentityMode = 'legacy' | 'better-auth'

type HeaderSource = { readonly headers: Pick<Headers, 'get'> }

export type IdentityConfiguration = {
  enabled: boolean
  credentialWritesPaused: boolean
  mode: IdentityMode
  /** Origem estática do host `app` (callbacks OAuth, cookie do painel). */
  baseURL: string
  /**
   * Rota do Better Auth pela regra única da plataforma (a dos clientes web e
   * mobile): em `legacy` ele coexiste com o NextAuth (`/api/auth/*`) no
   * basePath do modo `better-auth-v2`; em `better-auth`, no do corte.
   */
  basePath: BetterAuthBasePath
  secret: string
  /** Origens estáticas: a do app e os schemes do aplicativo. */
  trustedOrigins: string[]
  /** `baseURL` em https: cookie `__Host-` e atributos `Secure`. */
  secureCookies: boolean
  /** Borda validada (proxy da plataforma) da requisição; `null` sem borda. */
  readEdge(_request: HeaderSource): PlatformEdgeContext | null
  google?: { clientId: string; clientSecret: string }
  facebook?: { clientId: string; clientSecret: string }
}

type Env = Record<string, string | undefined>

export function identityMode(env: Env): IdentityMode {
  const mode = env.AUTH_MODE || 'legacy'
  if (mode !== 'legacy' && mode !== 'better-auth')
    throw new Error('Invalid AUTH_MODE')
  return mode
}

export function identityEnabled(env: Env): boolean {
  return identityMode(env) === 'better-auth' || env.AUTH_V2_ENABLED === 'true'
}

/** basePath do Better Auth no modo do backend: o do corte em `better-auth`, o do v2 ao lado do NextAuth. */
export function identityBasePath(env: Env): BetterAuthBasePath {
  return betterAuthBasePath(
    identityMode(env) === 'better-auth' ? 'better-auth' : 'better-auth-v2'
  )
}

function staticTrustedOrigin(
  entry: string,
  { development, multiHost }: { development: boolean; multiHost: boolean }
): string {
  if (entry.includes('*'))
    throw new Error('Authentication origins must be explicit')
  let origin: URL
  try {
    origin = new URL(entry)
  } catch {
    throw new Error('Invalid AUTH_TRUSTED_ORIGINS')
  }
  if (origin.username || origin.password || origin.search || origin.hash)
    throw new Error('Invalid AUTH_TRUSTED_ORIGINS')
  // Com hosts por locadora, origens de navegador vêm só da borda, por
  // requisição (origem exata do host): uma origem web estática valeria em
  // todos os hosts.
  if (
    multiHost &&
    (origin.protocol === 'http:' || origin.protocol === 'https:')
  )
    throw new Error(
      'AUTH_TRUSTED_ORIGINS accepts only app schemes; web origins come from the platform edge'
    )
  if (origin.protocol === 'exp:' && !development)
    throw new Error('exp:// is only trusted in development')
  return entry
}

export function identityConfiguration(env: Env): IdentityConfiguration {
  const mode = identityMode(env)
  const enabled = identityEnabled(env)
  let url: URL
  try {
    url = new URL(env.BETTER_AUTH_URL || '')
  } catch {
    throw new Error('BETTER_AUTH_URL is required')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('BETTER_AUTH_URL must be a canonical HTTP origin')
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw new Error('Production authentication requires HTTPS')
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  // O Better Auth soma esta variável às origens confiáveis de toda requisição.
  if (env.BETTER_AUTH_TRUSTED_ORIGINS?.trim())
    throw new Error(
      'BETTER_AUTH_TRUSTED_ORIGINS is not supported; use AUTH_TRUSTED_ORIGINS'
    )

  // Login por host exige o ambiente da plataforma; o legado segue sem ele.
  let platform: PlatformEnv | null = null
  try {
    platform = resolvePlatformEnv(env)
  } catch (error) {
    if (mode === 'better-auth') throw error
  }
  const development = platform
    ? platform.environment === 'development'
    : env.NODE_ENV !== 'production'
  if (platform && !development) {
    const app = canonicalOrigin(platform, 'app')
    if (url.origin !== app)
      throw new Error(`BETTER_AUTH_URL must be the app origin (${app})`)
  }

  const trustedOrigins = [url.origin]
  for (const entry of (env.AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    trustedOrigins.push(
      staticTrustedOrigin(entry, {
        development,
        multiHost: platform?.edgeSecret != null,
      })
    )
  }
  const provider = (prefix: string) => {
    const clientId = env[`${prefix}_CLIENT_ID`]
    const clientSecret = env[`${prefix}_CLIENT_SECRET`]
    if (Boolean(clientId) !== Boolean(clientSecret))
      throw new Error('Incomplete OAuth provider configuration')
    return clientId && clientSecret ? { clientId, clientSecret } : undefined
  }
  return {
    enabled,
    credentialWritesPaused: env.AUTH_CREDENTIAL_WRITES_PAUSED === 'true',
    mode,
    baseURL: url.origin,
    basePath: identityBasePath(env),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [...new Set(trustedOrigins)],
    secureCookies: url.protocol === 'https:',
    readEdge: (request) => readPlatformEdgeContext(request, env),
    google: provider('GOOGLE'),
    facebook: provider('FACEBOOK'),
  }
}

/** Borda de um host que fala com a identidade (locadora ou app); o apex não. */
function identityEdge(
  config: Pick<IdentityConfiguration, 'readEdge'>,
  request: HeaderSource | null | undefined
): PlatformEdgeContext | null {
  if (!request) return null
  const edge = config.readEdge(request)
  return edge && (edge.hostKind === 'tenant' || edge.hostKind === 'app')
    ? edge
    : null
}

/**
 * Origens confiáveis de uma requisição: as estáticas mais a origem EXATA do
 * host de onde ela veio (borda validada). Sem requisição (chamadas diretas da
 * API), só as estáticas. Um `Origin` de outra locadora nunca entra.
 */
export function trustedOriginsFor(
  config: Pick<IdentityConfiguration, 'trustedOrigins' | 'readEdge'>,
  request?: HeaderSource | null
): string[] {
  const edge = identityEdge(config, request)
  return edge
    ? [...new Set([...config.trustedOrigins, edge.origin])]
    : [...config.trustedOrigins]
}

/**
 * Origem pública do host de onde veio a requisição (locadora ou app). Sem
 * borda válida, a origem do app. Não serve para links de e-mail da conta
 * global: esses usam `accountLinkOrigin` (factory.ts), que só aceita a origem
 * da locadora para o cliente dela.
 */
export function originFor(
  config: Pick<IdentityConfiguration, 'baseURL' | 'readEdge'>,
  request?: HeaderSource | null
): string {
  return identityEdge(config, request)?.origin ?? config.baseURL
}
