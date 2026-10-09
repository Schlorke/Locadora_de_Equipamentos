/**
 * Contrato da plataforma multiempresa com locadora por host.
 * Decisões: docs/architecture/adr-tenant-hosts.md (D1, D3, D14, D15); termos
 * bloqueados e e-mails descartáveis: docs/architecture/adr-saas-subscription.md (B.8).
 *
 * Puro e universal: só manipula strings. Não usa Node, DOM, URL, fetch, banco
 * nem variáveis de ambiente globais; o ambiente chega sempre por parâmetro.
 * A locadora vem somente do cabeçalho Host (D1). Cabeçalhos encaminhados
 * (forwarded) nunca servem de fonte.
 */
import platformData from './platform.json'

export interface PlatformConfig {
  /** Nome técnico provisório (prefixo de cookie, scheme). */
  readonly name: string
  /** Nome exibido (appName, assuntos de e-mail da plataforma). */
  readonly displayName: string
  readonly appScheme: string
  readonly appSlug: string
  /** Prefixo dos links universais servidos no apex: `https://<raiz>/l/{slug}/...`. */
  readonly deepLinkPrefix: string
  readonly surfaces: { readonly app: string }
  readonly mobile: {
    readonly iosBundleIdentifier: string | null
    readonly androidPackage: string | null
  }
  /** Rótulos que nunca podem ser locadora (hosts da plataforma e rotas de primeiro nível). */
  readonly reservedSubdomains: readonly string[]
  /**
   * Termos que um slug novo não pode conter como palavra inteira (bancos,
   * órgãos públicos, "pix", "login"...). Vale só no cadastro; não muda o
   * roteamento de locadoras existentes (ADR adr-saas-subscription.md, B.8).
   */
  readonly blockedSlugTerms: readonly string[]
  /** Domínios de e-mail descartável recusados no cadastro do dono (B.8). */
  readonly disposableEmailDomains: readonly string[]
}

// Verificação estrutural do JSON em tempo de compilação.
const source: PlatformConfig = platformData

/** Única fonte do nome provisório da plataforma (D14). Imutável. */
export const PLATFORM: PlatformConfig = Object.freeze({
  name: source.name,
  displayName: source.displayName,
  appScheme: source.appScheme,
  appSlug: source.appSlug,
  deepLinkPrefix: source.deepLinkPrefix,
  surfaces: Object.freeze({ app: source.surfaces.app }),
  mobile: Object.freeze({
    iosBundleIdentifier: source.mobile.iosBundleIdentifier,
    androidPackage: source.mobile.androidPackage,
  }),
  reservedSubdomains: Object.freeze([...source.reservedSubdomains]),
  blockedSlugTerms: Object.freeze([...source.blockedSlugTerms]),
  disposableEmailDomains: Object.freeze([...source.disposableEmailDomains]),
})

const RESERVED = new Set<string>(PLATFORM.reservedSubdomains)
const WWW_LABEL = 'www'
const VERCEL_PREVIEW_SUFFIX = '.vercel.app'
const VERCEL_PREFIX_SEPARATOR = '---'

/**
 * Sintaxe do slug de locadora (D15): rótulo DNS de 2 a 63 caracteres,
 * `[a-z0-9-]`, sem hífen nas pontas e sem `--` em nenhuma posição
 * (bloqueia `xn--` e o separador `---` do preview da Vercel).
 * Equivale ao CHECK do banco: `^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$` e sem `--`.
 * Não considera a lista de reservados; use `isTenantSlug`.
 */
export const TENANT_SLUG_RE = /^(?!.*--)[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/

const DNS_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** Rótulo reservado pela plataforma (host próprio ou rota de primeiro nível). */
export function isReservedSubdomain(label: string): boolean {
  return RESERVED.has(label)
}

/** Slug de locadora válido: sintaxe de `TENANT_SLUG_RE` e fora dos reservados. */
export function isTenantSlug(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    TENANT_SLUG_RE.test(value) &&
    !RESERVED.has(value)
  )
}

/**
 * O slug contém um termo bloqueado como sequência de palavras inteiras
 * (separadas por hífen): `pix-locacoes` e `loja-banco-do-brasil` contêm;
 * `pixel-locacoes` e `governador-valadares` não.
 */
export function hasBlockedSlugTerm(slug: string): boolean {
  const padded = `-${slug}-`
  return PLATFORM.blockedSlugTerms.some(
    (term) => padded.indexOf(`-${term}-`) !== -1
  )
}

/**
 * Slug aceito para uma locadora NOVA: `isTenantSlug` e sem termo bloqueado.
 * A disponibilidade (slug já usado) é conferida no banco.
 */
export function isSignupSlug(value: unknown): value is string {
  return isTenantSlug(value) && !hasBlockedSlugTerm(value)
}

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>(
  PLATFORM.disposableEmailDomains
)

/**
 * O e-mail usa domínio descartável da lista, ou um subdomínio dele.
 * Compara sem diferenciar maiúsculas e ignora um ponto final.
 */
export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return false
  let domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
  if (domain.endsWith('.')) domain = domain.slice(0, -1)
  while (domain.length > 0) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true
    const dot = domain.indexOf('.')
    if (dot === -1) return false
    domain = domain.slice(dot + 1)
  }
  return false
}

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

export type PlatformEnvironment =
  'development' | 'preview' | 'staging' | 'production'

const ENVIRONMENTS: readonly PlatformEnvironment[] = [
  'development',
  'preview',
  'staging',
  'production',
]

export interface PlatformEnv {
  readonly environment: PlatformEnvironment
  /** Domínio raiz, minúsculo, sem esquema, porta, caminho ou ponto final. */
  readonly rootDomain: string
  /** `http` só em development. */
  readonly protocol: 'http' | 'https'
  /** Porta pública do host web; só em development (padrão 3001). */
  readonly publicPort: number | null
  /** `VERCEL_ENV=preview`: habilita os prefixos `{rótulo}---{deploy}.vercel.app`. */
  readonly vercelPreview: boolean
  readonly edgeSecret: string | null
  readonly edgeSecretPrevious: string | null
  /**
   * Origem privada do backend (`WEB_API_ORIGIN`, só do processo web),
   * normalizada; `null` quando ausente ou inválida (ver `resolveWebPlatformEnv`).
   */
  readonly apiOrigin: string | null
  /** Rotas de laboratório; sempre `false` em produção. */
  readonly labsEnabled: boolean
}

/** Subconjunto usado para montar origens. */
export type PlatformOriginEnv = Pick<
  PlatformEnv,
  'rootDomain' | 'protocol' | 'publicPort'
>

/** Subconjunto usado para classificar o Host. */
export type PlatformHostEnv = PlatformOriginEnv &
  Pick<PlatformEnv, 'environment' | 'vercelPreview'>

export type PlatformEnvSource = Readonly<Record<string, string | undefined>>

export class PlatformEnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlatformEnvError'
  }
}

const MIN_SECRET_LENGTH = 32
const DEFAULT_DEV_PORT = 3001
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function isIpv4(host: string): boolean {
  const match = IPV4_RE.exec(host)
  if (!match) return false
  return match.slice(1).every((octet) => Number(octet) <= 255)
}

function isEnvironment(value: string): value is PlatformEnvironment {
  return (ENVIRONMENTS as readonly string[]).indexOf(value) !== -1
}

function parsePort(raw: string): number | null {
  if (!/^\d{1,5}$/.test(raw)) return null
  const port = Number(raw)
  return port >= 1 && port <= 65535 ? port : null
}

function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false
  return value.split('.').every((label) => DNS_LABEL_RE.test(label))
}

/** Normaliza uma origem http(s) sem credenciais, caminho, query ou fragmento. */
function normalizeOrigin(raw: string): string | null {
  const match =
    /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:.]+\])(?::(\d{1,5}))?\/?$/i.exec(raw)
  if (!match) return null
  const scheme = (match[1] ?? '').toLowerCase()
  const host = (match[2] ?? '').toLowerCase()
  if (!host.startsWith('[') && !isHostname(host)) return null
  const rawPort = match[3]
  if (rawPort === undefined) return `${scheme}://${host}`
  const port = parsePort(rawPort)
  if (port === null) return null
  const isDefault =
    (scheme === 'https' && port === 443) || (scheme === 'http' && port === 80)
  return isDefault ? `${scheme}://${host}` : `${scheme}://${host}:${port}`
}

function readVariable(env: PlatformEnvSource, key: string): string | null {
  const value = env[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

type ApiOriginResult =
  | { readonly ok: true; readonly origin: string | null }
  | { readonly ok: false; readonly message: string }

/** `WEB_API_ORIGIN`: só a origem HTTP(S), em https fora de development. */
function parseApiOrigin(
  env: PlatformEnvSource,
  development: boolean
): ApiOriginResult {
  const raw = readVariable(env, 'WEB_API_ORIGIN')
  if (raw === null) return { ok: true, origin: null }
  const origin = normalizeOrigin(raw)
  if (origin === null) {
    return {
      ok: false,
      message:
        'WEB_API_ORIGIN deve conter somente a origem HTTP(S) do backend.',
    }
  }
  if (!development && !origin.startsWith('https://')) {
    return {
      ok: false,
      message: 'WEB_API_ORIGIN precisa usar https fora de development.',
    }
  }
  return { ok: true, origin }
}

/**
 * Lê e valida o ambiente da plataforma comum ao host web e ao backend.
 * Falha fechada: sem `PLATFORM_ENV`, `VERCEL_ENV`/`NODE_ENV=production`
 * contam como produção. Produção exige `PLATFORM_ROOT_DOMAIN` e
 * `PLATFORM_EDGE_SECRET`. As mensagens nunca contêm valores de segredo.
 *
 * `WEB_API_ORIGIN` é variável só do processo web (ADR adr-tenant-hosts.md,
 * tabela de variáveis): aqui nunca é exigida nem recusada, porque o backend
 * valida a borda com esta função e não a tem. `apiOrigin` traz a origem
 * normalizada quando o valor é válido para o ambiente e `null` nos demais
 * casos. Quem repassa ao backend (proxy e gateway do host web) lê o ambiente
 * por `resolveWebPlatformEnv`, que recusa valor inválido e a exige em produção.
 */
export function resolvePlatformEnv(env: PlatformEnvSource): PlatformEnv {
  const read = (key: string): string | null => readVariable(env, key)

  const vercelEnv = read('VERCEL_ENV')
  const explicit = read('PLATFORM_ENV')
  let environment: PlatformEnvironment
  if (explicit !== null) {
    if (!isEnvironment(explicit)) {
      throw new PlatformEnvError(
        `PLATFORM_ENV deve ser um de: ${ENVIRONMENTS.join(', ')}.`
      )
    }
    environment = explicit
  } else if (vercelEnv === 'preview') {
    environment = 'preview'
  } else if (vercelEnv === 'production' || read('NODE_ENV') === 'production') {
    environment = 'production'
  } else {
    environment = 'development'
  }
  if (
    environment === 'development' &&
    (vercelEnv === 'production' || vercelEnv === 'preview')
  ) {
    throw new PlatformEnvError(
      'PLATFORM_ENV=development não é permitido em deploy da Vercel.'
    )
  }
  const development = environment === 'development'
  const production = environment === 'production'

  const rawRoot = read('PLATFORM_ROOT_DOMAIN')
  if (rawRoot === null && !development) {
    throw new PlatformEnvError(
      'PLATFORM_ROOT_DOMAIN é obrigatória fora de development.'
    )
  }
  const rootDomain = rawRoot ?? 'localhost'
  if (!isHostname(rootDomain) || isIpv4(rootDomain)) {
    throw new PlatformEnvError(
      'PLATFORM_ROOT_DOMAIN deve ser um domínio em minúsculas, sem esquema, porta, caminho ou ponto final.'
    )
  }
  if (
    !development &&
    (rootDomain.indexOf('.') === -1 ||
      rootDomain === 'localhost' ||
      rootDomain.endsWith('.localhost'))
  ) {
    throw new PlatformEnvError(
      'PLATFORM_ROOT_DOMAIN fora de development precisa ser um domínio público (ex.: plataforma.example).'
    )
  }

  let publicPort: number | null = null
  if (development) {
    const rawPort = read('PLATFORM_PUBLIC_PORT')
    publicPort = rawPort === null ? DEFAULT_DEV_PORT : parsePort(rawPort)
    if (publicPort === null) {
      throw new PlatformEnvError(
        'PLATFORM_PUBLIC_PORT deve ser uma porta entre 1 e 65535.'
      )
    }
  }

  const edgeSecret = read('PLATFORM_EDGE_SECRET')
  const edgeSecretPrevious = read('PLATFORM_EDGE_SECRET_PREVIOUS')
  if (edgeSecret !== null && edgeSecret.length < MIN_SECRET_LENGTH) {
    throw new PlatformEnvError(
      `PLATFORM_EDGE_SECRET precisa ter ${MIN_SECRET_LENGTH} caracteres ou mais.`
    )
  }
  if (
    edgeSecretPrevious !== null &&
    edgeSecretPrevious.length < MIN_SECRET_LENGTH
  ) {
    throw new PlatformEnvError(
      `PLATFORM_EDGE_SECRET_PREVIOUS precisa ter ${MIN_SECRET_LENGTH} caracteres ou mais.`
    )
  }
  if (edgeSecretPrevious !== null && edgeSecret === null) {
    throw new PlatformEnvError(
      'PLATFORM_EDGE_SECRET_PREVIOUS exige PLATFORM_EDGE_SECRET.'
    )
  }
  if (production && edgeSecret === null) {
    throw new PlatformEnvError(
      'PLATFORM_EDGE_SECRET é obrigatória em produção.'
    )
  }

  const api = parseApiOrigin(env, development)
  const apiOrigin = api.ok ? api.origin : null

  return Object.freeze({
    environment,
    rootDomain,
    protocol: development ? 'http' : 'https',
    publicPort,
    vercelPreview: vercelEnv === 'preview',
    edgeSecret,
    edgeSecretPrevious,
    apiOrigin,
    labsEnabled: !production && read('PLATFORM_LABS_ENABLED') === 'true',
  })
}

/**
 * Ambiente do processo web (proxy e gateway server-only), o único que repassa
 * ao backend: `resolvePlatformEnv` mais `WEB_API_ORIGIN` válida (só a origem,
 * https fora de development) e obrigatória em produção. O backend nunca usa
 * esta função.
 */
export function resolveWebPlatformEnv(env: PlatformEnvSource): PlatformEnv {
  const platform = resolvePlatformEnv(env)
  const api = parseApiOrigin(env, platform.environment === 'development')
  if (!api.ok) throw new PlatformEnvError(api.message)
  if (platform.environment === 'production' && api.origin === null) {
    throw new PlatformEnvError('WEB_API_ORIGIN é obrigatória em produção.')
  }
  return platform
}

// ---------------------------------------------------------------------------
// Classificação do Host
// ---------------------------------------------------------------------------

export type InvalidHostReason =
  | 'missing'
  | 'malformed'
  | 'ip-literal'
  | 'outside-root'
  | 'multi-level'
  | 'invalid-label'

interface ServedHost {
  /** Origem recalculada pelo classificador; nunca o texto cru do Host. */
  readonly origin: string
  /** Rótulo do deploy de preview da Vercel, quando o host veio por ele. */
  readonly preview: string | null
}

export type HostClass =
  | ({ readonly kind: 'apex' } & ServedHost)
  | ({ readonly kind: 'www' } & ServedHost)
  | ({ readonly kind: 'app' } & ServedHost)
  | ({ readonly kind: 'tenant'; readonly slug: string } & ServedHost)
  | { readonly kind: 'reserved'; readonly label: string }
  | { readonly kind: 'invalid'; readonly reason: InvalidHostReason }

export type HostKind = HostClass['kind']

/** Contexto de preview usado para montar origens irmãs do mesmo deploy. */
export interface PreviewContext {
  readonly preview: string | null
}

function portSuffix(env: PlatformOriginEnv): string {
  return env.publicPort === null ? '' : `:${env.publicPort}`
}

function labelOrigin(
  env: PlatformOriginEnv,
  label: string | null,
  preview: string | null
): string {
  if (preview !== null) {
    const prefix = label === null ? '' : `${label}${VERCEL_PREFIX_SEPARATOR}`
    return `https://${prefix}${preview}${VERCEL_PREVIEW_SUFFIX}`
  }
  const prefix = label === null ? '' : `${label}.`
  return `${env.protocol}://${prefix}${env.rootDomain}${portSuffix(env)}`
}

function invalid(reason: InvalidHostReason): HostClass {
  return { kind: 'invalid', reason }
}

type ParsedHost =
  | { readonly ok: true; readonly host: string; readonly ip: boolean }
  | { readonly ok: false; readonly reason: InvalidHostReason }

function parseHost(raw: string | null | undefined): ParsedHost {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, reason: 'missing' }
  }
  // Somente ASCII imprimível: evita normalizações Unicode em toLowerCase.
  if (!/^[\x21-\x7e]+$/.test(raw)) return { ok: false, reason: 'malformed' }
  const value = raw.toLowerCase()

  if (value.startsWith('[')) {
    const match = /^\[([0-9a-f:.]+)\](?::(\d{1,5}))?$/.exec(value)
    const address = match?.[1]
    if (!match || address === undefined || address.indexOf(':') === -1) {
      return { ok: false, reason: 'malformed' }
    }
    if (match[2] !== undefined && parsePort(match[2]) === null) {
      return { ok: false, reason: 'malformed' }
    }
    return { ok: true, host: `[${address}]`, ip: true }
  }

  const match = /^([a-z0-9.-]+)(?::(\d{1,5}))?$/.exec(value)
  const name = match?.[1]
  if (!match || name === undefined) return { ok: false, reason: 'malformed' }
  if (match[2] !== undefined && parsePort(match[2]) === null) {
    return { ok: false, reason: 'malformed' }
  }
  const host = name.endsWith('.') ? name.slice(0, -1) : name
  if (
    host.length === 0 ||
    host.length > 253 ||
    host.split('.').some((label) => label.length === 0)
  ) {
    return { ok: false, reason: 'malformed' }
  }
  return { ok: true, host, ip: isIpv4(host) }
}

function classifyLabel(
  label: string,
  env: PlatformHostEnv,
  preview: string | null
): HostClass {
  if (label === WWW_LABEL) {
    return { kind: 'www', origin: labelOrigin(env, label, preview), preview }
  }
  if (label === PLATFORM.surfaces.app) {
    return { kind: 'app', origin: labelOrigin(env, label, preview), preview }
  }
  if (RESERVED.has(label)) return { kind: 'reserved', label }
  if (isTenantSlug(label)) {
    return {
      kind: 'tenant',
      slug: label,
      origin: labelOrigin(env, label, preview),
      preview,
    }
  }
  return invalid('invalid-label')
}

/**
 * Classifica o valor do cabeçalho `Host` (nunca `x-forwarded-host`).
 * Normaliza para minúsculas, remove a porta e um ponto final.
 *
 * - `apex`: o domínio raiz; no preview da Vercel, `{deploy}.vercel.app`.
 * - `www`, `app`: `www.<raiz>`, `app.<raiz>` (preview: `www---`, `app---`).
 * - `tenant`: um único rótulo que passa em `isTenantSlug`
 *   (preview: `{slug}---{deploy}.vercel.app`, só com `VERCEL_ENV=preview`).
 * - `reserved`: um único rótulo da lista de reservados.
 * - `invalid`: ausente, malformado, multinível, fora da raiz, rótulo inválido
 *   ou IP literal fora de development (em development, IP literal é o host
 *   `app`, usado pelo app mobile na rede local).
 */
export function classifyHost(
  hostHeader: string | null | undefined,
  env: PlatformHostEnv
): HostClass {
  const parsed = parseHost(hostHeader)
  if (!parsed.ok) return invalid(parsed.reason)
  const { host } = parsed

  if (parsed.ip) {
    if (env.environment !== 'development') return invalid('ip-literal')
    return {
      kind: 'app',
      origin: `${env.protocol}://${host}${portSuffix(env)}`,
      preview: null,
    }
  }

  const root = env.rootDomain
  if (host === root) {
    return { kind: 'apex', origin: labelOrigin(env, null, null), preview: null }
  }
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, host.length - root.length - 1)
    if (label.indexOf('.') !== -1) return invalid('multi-level')
    return classifyLabel(label, env, null)
  }

  if (env.vercelPreview && host.endsWith(VERCEL_PREVIEW_SUFFIX)) {
    const label = host.slice(0, host.length - VERCEL_PREVIEW_SUFFIX.length)
    if (label.indexOf('.') !== -1) return invalid('multi-level')
    const separator = label.indexOf(VERCEL_PREFIX_SEPARATOR)
    if (separator === -1) {
      if (!DNS_LABEL_RE.test(label)) return invalid('invalid-label')
      return {
        kind: 'apex',
        origin: labelOrigin(env, null, label),
        preview: label,
      }
    }
    const prefix = label.slice(0, separator)
    const deployment = label.slice(separator + VERCEL_PREFIX_SEPARATOR.length)
    if (
      !DNS_LABEL_RE.test(deployment) ||
      deployment.indexOf(VERCEL_PREFIX_SEPARATOR) !== -1
    ) {
      return invalid('invalid-label')
    }
    return classifyLabel(prefix, env, deployment)
  }

  return invalid('outside-root')
}

// ---------------------------------------------------------------------------
// Origens
// ---------------------------------------------------------------------------

export interface PlatformOrigins {
  readonly apex: string
  readonly www: string
  readonly app: string
}

/**
 * Origens dos hosts da plataforma. Com `via` vindo de um host de preview,
 * devolve as origens irmãs do mesmo deploy (`app---{deploy}.vercel.app`).
 */
export function platformOrigins(
  env: PlatformOriginEnv,
  via?: PreviewContext | null
): PlatformOrigins {
  const preview = via?.preview ?? null
  return Object.freeze({
    apex: labelOrigin(env, null, preview),
    www: labelOrigin(env, WWW_LABEL, preview),
    app: labelOrigin(env, PLATFORM.surfaces.app, preview),
  })
}

/** Origem do site de uma locadora. Lança erro para slug inválido ou reservado. */
export function tenantOrigin(
  env: PlatformOriginEnv,
  slug: string,
  via?: PreviewContext | null
): string {
  if (!isTenantSlug(slug)) {
    throw new TypeError('Slug de locadora inválido ou reservado.')
  }
  return labelOrigin(env, slug, via?.preview ?? null)
}

/**
 * Origem canônica (SEO, e-mails, `metadataBase`): sempre sob o domínio raiz,
 * nunca a de um deploy de preview.
 */
export function canonicalOrigin(
  env: PlatformOriginEnv,
  target: 'apex' | 'app' | { readonly slug: string }
): string {
  if (target === 'apex') return labelOrigin(env, null, null)
  if (target === 'app') return labelOrigin(env, PLATFORM.surfaces.app, null)
  return tenantOrigin(env, target.slug)
}

// ---------------------------------------------------------------------------
// Contexto de borda (proxy → backend)
// ---------------------------------------------------------------------------

/**
 * Cabeçalhos do contexto de borda. O proxy remove todos na entrada e só ele os
 * define; o backend aceita o contexto apenas com `auth` igual ao segredo.
 */
export const PLATFORM_EDGE_HEADER = Object.freeze({
  auth: 'x-platform-edge-auth',
  hostKind: 'x-platform-host-kind',
  tenantSlug: 'x-platform-tenant-slug',
  origin: 'x-platform-origin',
  clientIp: 'x-platform-client-ip',
} as const)

export type PlatformEdgeHeaderName =
  (typeof PLATFORM_EDGE_HEADER)[keyof typeof PLATFORM_EDGE_HEADER]

/** Todos os cabeçalhos de borda, para remoção na entrada do proxy. */
export const PLATFORM_EDGE_HEADERS: readonly PlatformEdgeHeaderName[] =
  Object.freeze([
    PLATFORM_EDGE_HEADER.auth,
    PLATFORM_EDGE_HEADER.hostKind,
    PLATFORM_EDGE_HEADER.tenantSlug,
    PLATFORM_EDGE_HEADER.origin,
    PLATFORM_EDGE_HEADER.clientIp,
  ])

/** Valores de `x-platform-host-kind`. */
export type PlatformEdgeHostKind = 'tenant' | 'app' | 'apex'

// ---------------------------------------------------------------------------
// Autenticação: modo dos clientes e basePath do Better Auth
// ---------------------------------------------------------------------------

/**
 * Modos de autenticação dos clientes (`NEXT_PUBLIC_AUTH_MODE` no host web, `EXPO_PUBLIC_AUTH_MODE` no app):
 * - `legacy`: só o NextAuth (`/api/auth/*`); nenhum cliente Better Auth.
 * - `better-auth-v2`: coexistência. O backend fica em `AUTH_MODE=legacy` com `AUTH_V2_ENABLED=true`: `/api/auth/*` é
 *   o NextAuth e o Better Auth atende em `/api/auth/v2`.
 * - `better-auth`: corte. O backend fica em `AUTH_MODE=better-auth` e o Better Auth atende em `/api/auth`.
 */
export const AUTH_MODES = Object.freeze([
  'legacy',
  'better-auth-v2',
  'better-auth',
] as const)
export type AuthMode = (typeof AUTH_MODES)[number]
/** Modo em que o cliente fala com o Better Auth (todos menos `legacy`). */
export type BetterAuthMode = Exclude<AuthMode, 'legacy'>

/** Regra única modo → `basePath` do Better Auth (clientes web e mobile, proxy do host web e backend). */
const BETTER_AUTH_BASE_PATH = Object.freeze({
  'better-auth': '/api/auth',
  'better-auth-v2': '/api/auth/v2',
} as const)
export type BetterAuthBasePath = (typeof BETTER_AUTH_BASE_PATH)[BetterAuthMode]

/** Os `basePath` do Better Auth, um por modo com Better Auth (as negações do proxy valem nos dois). */
export const BETTER_AUTH_BASE_PATHS: readonly BetterAuthBasePath[] =
  Object.freeze(Object.values(BETTER_AUTH_BASE_PATH))

/** Resultado de `betterAuthBasePath`: nunca `null` para um modo com Better Auth. */
export type BetterAuthBasePathOf<M extends AuthMode | undefined> =
  M extends BetterAuthMode ? BetterAuthBasePath : BetterAuthBasePath | null

/**
 * `basePath` do Better Auth no modo. `null` no `legacy` (não há Better Auth no cliente) e sem modo (falha fechada).
 * O basePath vale só no seu modo: no `better-auth-v2`, `/api/auth/*` é o NextAuth.
 */
export function betterAuthBasePath<M extends AuthMode | undefined>(
  mode: M
): BetterAuthBasePathOf<M> {
  const base: BetterAuthBasePath | null =
    mode === 'better-auth' || mode === 'better-auth-v2'
      ? BETTER_AUTH_BASE_PATH[mode as BetterAuthMode]
      : null
  // O tipo condicional só estreita o que o valor já garante: `null` apenas fora de `BetterAuthMode`.
  return base as BetterAuthBasePathOf<M>
}

/**
 * Lê o modo de autenticação do valor de `variable` (ex.: `NEXT_PUBLIC_AUTH_MODE`). Ausente ou vazio vale `legacy`;
 * valor fora de `AUTH_MODES` é recusado com `<variable> inválido.`.
 */
export function parseAuthMode(
  value: string | undefined,
  variable: string
): AuthMode {
  const mode = value || 'legacy'
  const known = AUTH_MODES.find((candidate) => candidate === mode)
  if (known === undefined) throw new Error(`${variable} inválido.`)
  return known
}
