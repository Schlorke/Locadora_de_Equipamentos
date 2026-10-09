/**
 * Cliente HTTP único do Asaas (ADR SaaS D24 e B.7.3). Toda chamada ao Asaas — cobrança de
 * cliente final, mensalidade da plataforma e subcontas — passa por `createAsaasHttpClient`:
 *
 * - origem fixa por ambiente, `redirect: 'error'` e timeout obrigatório;
 * - interruptor de emergência `PLATFORM_ASAAS_OUTBOUND_DISABLED`, lido a cada chamada: com ele
 *   ligado nada sai (os webhooks de entrada continuam sendo persistidos por quem os recebe);
 * - saída por IP fixo quando `PLATFORM_ASAAS_EGRESS_PROXY_URL` existe: a chamada só sai pelo
 *   transporte de egress registrado. Sem transporte, ou com URL inválida, falha fechada — nunca sai
 *   direto;
 * - nenhum corpo, header, query string ou chave vai para erro ou log. Erros guardam só códigos.
 *
 * Só as duas variáveis de TRANSPORTE acima são lidas aqui. Chaves da conta raiz
 * (`PLATFORM_ASAAS_ROOT_*`) nunca são lidas neste módulo (ROOT-KEY-ISOLATION).
 */

export type AsaasEnvironment = 'sandbox' | 'production'
export type AsaasMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
/** Assinatura mínima de `fetch` usada pelo cliente; o `fetch` global e o dublê a satisfazem. */
export type AsaasFetch = (url: string, init: RequestInit) => Promise<Response>

export const ASAAS_API_ORIGINS: Readonly<Record<AsaasEnvironment, string>> = Object.freeze({
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
})
export const ASAAS_OUTBOUND_DISABLED_ENV = 'PLATFORM_ASAAS_OUTBOUND_DISABLED'
export const ASAAS_EGRESS_PROXY_ENV = 'PLATFORM_ASAAS_EGRESS_PROXY_URL'
export const ASAAS_DEFAULT_TIMEOUT_MS = 12_000
export const ASAAS_MAX_TIMEOUT_MS = 120_000
const MAX_RESPONSE_CHARS = 2_000_000
const MAX_ERROR_BODY_CHARS = 65_536
const USER_AGENT = 'Locadora-Platform/1.0'
const METHODS: ReadonlySet<string> = new Set(['GET', 'POST', 'PUT', 'DELETE'])
const PROVIDER_CODE = /^[A-Za-z0-9_.-]{1,64}$/
const MAX_PROVIDER_CODES = 10

// ---------------------------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------------------------

export type BillingProviderErrorCode = 'UNAVAILABLE' | 'REJECTED' | 'AMBIGUOUS' | 'INVALID_RESPONSE'
export type AsaasFailureReason =
  | 'OUTBOUND_DISABLED'
  | 'EGRESS_UNAVAILABLE'
  | 'MISSING_CREDENTIAL'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_REQUEST'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CLIENT_ERROR'
  | 'MALFORMED_BODY'
  | 'UNEXPECTED_SHAPE'
  | 'AMBIGUOUS_MATCH'

export interface BillingProviderErrorDetails {
  reason?: AsaasFailureReason
  status?: number
  providerCodes?: readonly string[]
  retryAfterSeconds?: number | null
  maybeApplied?: boolean
}

/**
 * Falha de integração com o Asaas. A mensagem é sempre o próprio código; nenhum campo guarda
 * corpo, header, query, URL de proxy ou chave. `providerCodes` traz só os `errors[].code` do
 * Asaas (nunca `description`, que pode repetir dados enviados).
 */
export class BillingProviderError extends Error {
  readonly code: BillingProviderErrorCode
  readonly reason: AsaasFailureReason | null
  readonly status: number | null
  readonly providerCodes: readonly string[]
  readonly retryAfterSeconds: number | null
  /** `true` quando o Asaas pode ter aplicado a operação (timeout, rede ou 5xx numa escrita). */
  readonly maybeApplied: boolean

  constructor(code: BillingProviderErrorCode, details: BillingProviderErrorDetails = {}) {
    super(code)
    this.name = 'BillingProviderError'
    this.code = code
    this.reason = details.reason ?? null
    this.status = details.status ?? null
    this.providerCodes = Object.freeze([...(details.providerCodes ?? [])])
    this.retryAfterSeconds = details.retryAfterSeconds ?? null
    this.maybeApplied = details.maybeApplied ?? false
  }
}

function fail(code: BillingProviderErrorCode, details: BillingProviderErrorDetails): never {
  throw new BillingProviderError(code, details)
}

// ---------------------------------------------------------------------------------------------
// Segredos e redação
// ---------------------------------------------------------------------------------------------

/** Qualquer portador de segredo que só entrega o valor dentro de `use` (ex.: `SecretValue` do cofre). */
export interface AsaasSecret {
  use<T>(fn: (value: string) => T): T
}
export type AsaasCredential = string | AsaasSecret

export const REDACTED = '[REDACTED]'

/** Segredo devolvido pelo Asaas (chave de subconta). Nunca serializa nem imprime o valor. */
export class AsaasSecretValue implements AsaasSecret {
  readonly #value: string
  constructor(value: string) {
    this.#value = value
  }
  use<T>(fn: (value: string) => T): T {
    return fn(this.#value)
  }
  toJSON(): string {
    return REDACTED
  }
  toString(): string {
    return REDACTED
  }
  [Symbol.toPrimitive](): string {
    return REDACTED
  }
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return 'AsaasSecretValue(' + REDACTED + ')'
  }
}

/** Campos removidos por qualquer redator de log/Sentry que toque em dados do Asaas (B.7.3). */
export const ASAAS_SECRET_FIELDS = Object.freeze([
  'access_token',
  'asaas-access-token',
  'apiKey',
  'accessToken',
  'authToken',
  'onboardingUrl',
  'wrappedDek',
  'ciphertext',
  'authorization',
] as const)
const SECRET_FIELD_SET: ReadonlySet<string> = new Set(ASAAS_SECRET_FIELDS.map((field) => field.toLowerCase()))

function redactString(value: string, knownSecrets: readonly string[]): string {
  let out = value
  for (const secret of knownSecrets) if (secret) out = out.split(secret).join(REDACTED)
  return out
}

/**
 * Cópia de `value` sem os campos de `ASAAS_SECRET_FIELDS` (em qualquer nível, sem diferenciar
 * maiúsculas) e sem nenhuma ocorrência dos segredos conhecidos em strings.
 */
export function redactAsaasSecrets<T>(value: T, knownSecrets: readonly string[] = []): T {
  const secrets = knownSecrets.filter((secret) => typeof secret === 'string' && secret.length > 0)
  const seen = new WeakMap<object, unknown>()
  const visit = (current: unknown): unknown => {
    if (typeof current === 'string') return redactString(current, secrets)
    if (current === null || typeof current !== 'object') return current
    if (current instanceof AsaasSecretValue) return REDACTED
    if (current instanceof Date) return current
    if (seen.has(current)) return seen.get(current)
    if (current instanceof Error) {
      const copy = { name: current.name, message: redactString(current.message, secrets) }
      seen.set(current, copy)
      return copy
    }
    if (Array.isArray(current)) {
      const copy: unknown[] = []
      seen.set(current, copy)
      for (const item of current) copy.push(visit(item))
      return copy
    }
    const copy: Record<string, unknown> = {}
    seen.set(current, copy)
    for (const [key, item] of Object.entries(current)) {
      copy[key] = SECRET_FIELD_SET.has(key.toLowerCase()) ? REDACTED : visit(item)
    }
    return copy
  }
  return visit(value) as T
}

// ---------------------------------------------------------------------------------------------
// Política de transporte (interruptor de emergência e egress)
// ---------------------------------------------------------------------------------------------

export type AsaasEgressPolicy =
  | { readonly kind: 'direct' }
  | { readonly kind: 'proxy'; readonly proxyUrl: URL }
  | { readonly kind: 'invalid' }
export interface AsaasTransportPolicy {
  readonly outboundDisabled: boolean
  readonly egress: AsaasEgressPolicy
}
export type AsaasEnvSource = Readonly<Record<string, string | undefined>>

/** Valores que mantêm a saída LIGADA. Qualquer outro valor desliga (na dúvida, o interruptor corta). */
const OUTBOUND_ENABLED_VALUES: ReadonlySet<string> = new Set(['', 'false', '0', 'off', 'no'])

export function readAsaasTransportPolicy(env: AsaasEnvSource = process.env): AsaasTransportPolicy {
  const flag = env[ASAAS_OUTBOUND_DISABLED_ENV]
  const outboundDisabled = flag !== undefined && !OUTBOUND_ENABLED_VALUES.has(flag.trim().toLowerCase())
  const proxy = env[ASAAS_EGRESS_PROXY_ENV]?.trim()
  let egress: AsaasEgressPolicy = { kind: 'direct' }
  if (proxy) {
    try {
      const proxyUrl = new URL(proxy)
      egress = proxyUrl.protocol === 'http:' || proxyUrl.protocol === 'https:' ? { kind: 'proxy', proxyUrl } : { kind: 'invalid' }
    } catch {
      egress = { kind: 'invalid' }
    }
  }
  return { outboundDisabled, egress }
}

/**
 * Constrói o `fetch` que sai pelo proxy de IP fixo (ex.: `undici.ProxyAgent` como `dispatcher`).
 * A URL do proxy pode conter credenciais: o cliente nunca a registra.
 */
export type AsaasEgressFactory = (proxyUrl: URL) => AsaasFetch

let registeredEgress: AsaasEgressFactory | null = null
const egressTransports = new WeakMap<AsaasEgressFactory, Map<string, AsaasFetch>>()

/**
 * Registra, uma vez por processo (composição do servidor), o transporte de saída por IP fixo usado
 * por todos os clientes do Asaas quando `PLATFORM_ASAAS_EGRESS_PROXY_URL` existe. Devolve a função
 * que desfaz o registro.
 */
export function registerAsaasEgressTransport(factory: AsaasEgressFactory): () => void {
  registeredEgress = factory
  return () => {
    if (registeredEgress === factory) registeredEgress = null
  }
}

function egressTransport(factory: AsaasEgressFactory, proxyUrl: URL): AsaasFetch {
  let byUrl = egressTransports.get(factory)
  if (!byUrl) {
    byUrl = new Map()
    egressTransports.set(factory, byUrl)
  }
  let transport = byUrl.get(proxyUrl.href)
  if (!transport) {
    transport = factory(new URL(proxyUrl.href))
    if (typeof transport !== 'function') fail('UNAVAILABLE', { reason: 'EGRESS_UNAVAILABLE' })
    byUrl.set(proxyUrl.href, transport)
  }
  return transport
}

// ---------------------------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------------------------

export interface AsaasHttpLogEntry {
  readonly event: 'asaas.http'
  readonly environment: AsaasEnvironment
  readonly method: AsaasMethod
  /** Caminho sem query string (a query pode conter CPF/CNPJ). */
  readonly path: string
  readonly status: number | null
  readonly outcome: 'OK' | AsaasFailureReason
  readonly durationMs: number
}
export type AsaasHttpLogger = (entry: AsaasHttpLogEntry) => void

export interface AsaasHttpClientConfig {
  readonly credential: AsaasCredential
  readonly environment: AsaasEnvironment
  /** Transporte direto; padrão: o `fetch` global, resolvido a cada chamada. */
  readonly fetch?: AsaasFetch
  /** Transporte de IP fixo deste cliente; padrão: o registrado por `registerAsaasEgressTransport`. */
  readonly egress?: AsaasEgressFactory
  readonly timeoutMs?: number
  /** Política de transporte; padrão: lida do ambiente a cada chamada. */
  readonly policy?: () => AsaasTransportPolicy
  /** Recebe só método, caminho sem query, status, desfecho e duração. */
  readonly logger?: AsaasHttpLogger
}
export type AsaasQuery = Readonly<Record<string, string | number | boolean | undefined>>
export interface AsaasRequest {
  readonly method: AsaasMethod
  /** Caminho relativo a `/v3`, sem query. Monte ids com `asaasPath`. */
  readonly path: string
  readonly query?: AsaasQuery
  readonly body?: Readonly<Record<string, unknown>>
  readonly timeoutMs?: number
}
export interface AsaasHttpClient {
  readonly environment: AsaasEnvironment
  /** Devolve o JSON da resposta 2xx; qualquer falha vira `BillingProviderError`. */
  request(request: AsaasRequest): Promise<unknown>
}

function invalidRequest(): never {
  return fail('REJECTED', { reason: 'INVALID_REQUEST' })
}

function encodeId(id: unknown): string {
  if (typeof id !== 'string' || !id || /^\.+$/.test(id)) invalidRequest()
  return encodeURIComponent(id)
}

/** Monta um caminho do Asaas codificando cada id interpolado: asaasPath`/payments/${id}`. */
export function asaasPath(strings: TemplateStringsArray, ...ids: readonly string[]): string {
  let out = strings[0] ?? ''
  ids.forEach((id, index) => {
    out += encodeId(id) + (strings[index + 1] ?? '')
  })
  return out
}

const PATH_SHAPE = /^(?:\/[A-Za-z0-9\-._~%]+)+\/?$/

function checkedPath(path: string): string {
  if (typeof path !== 'string' || !PATH_SHAPE.test(path)) invalidRequest()
  for (const segment of path.split('/').slice(1)) {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      invalidRequest()
    }
    if (decoded === '.' || decoded === '..') invalidRequest()
  }
  return path
}

function checkedTimeout(value: number | undefined, fallback: number): number {
  const timeout = value ?? fallback
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > ASAAS_MAX_TIMEOUT_MS) fail('UNAVAILABLE', { reason: 'INVALID_CONFIGURATION' })
  return timeout
}

function credentialValue(credential: AsaasCredential): string | null {
  let value: unknown
  try {
    value = typeof credential === 'string' ? credential : credential?.use((secret) => secret)
  } catch {
    return null
  }
  // Chave vazia, com espaço ou caractere de controle é inutilizável (e poderia injetar header).
  if (typeof value !== 'string' || !value || /\s/.test(value)) return null
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return null
  }
  return value
}

function isTimeout(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    ((error as { name: unknown }).name === 'TimeoutError' || (error as { name: unknown }).name === 'AbortError')
  )
}

function retryAfter(headers: Headers): number | null {
  // VERIFICAR-SANDBOX: nome e unidade dos headers de limite (Retry-After / RateLimit-Reset, em segundos).
  for (const name of ['retry-after', 'ratelimit-reset']) {
    const raw = headers.get(name)?.trim()
    if (raw && /^\d{1,6}$/.test(raw)) {
      const seconds = Number(raw)
      if (seconds <= 86_400) return seconds
    }
  }
  return null
}

async function providerCodes(response: Response): Promise<string[]> {
  try {
    const text = await response.text()
    if (text.length > MAX_ERROR_BODY_CHARS) return []
    const parsed: unknown = JSON.parse(text)
    const errors = parsed && typeof parsed === 'object' ? (parsed as { errors?: unknown }).errors : undefined
    if (!Array.isArray(errors)) return []
    const codes: string[] = []
    for (const item of errors) {
      const code = item && typeof item === 'object' ? (item as { code?: unknown }).code : undefined
      if (typeof code === 'string' && PROVIDER_CODE.test(code) && codes.length < MAX_PROVIDER_CODES) codes.push(code)
    }
    return codes
  } catch {
    return []
  }
}

function statusFailure(method: AsaasMethod, status: number): { code: BillingProviderErrorCode; reason: AsaasFailureReason; maybeApplied: boolean } {
  if (status === 400) return { code: 'REJECTED', reason: 'VALIDATION', maybeApplied: false }
  if (status === 401) return { code: 'REJECTED', reason: 'AUTHENTICATION', maybeApplied: false }
  if (status === 403) return { code: 'REJECTED', reason: 'FORBIDDEN', maybeApplied: false }
  if (status === 404) return { code: 'REJECTED', reason: 'NOT_FOUND', maybeApplied: false }
  if (status === 429) return { code: 'UNAVAILABLE', reason: 'RATE_LIMITED', maybeApplied: false }
  if (status >= 400 && status < 500) return { code: 'REJECTED', reason: 'CLIENT_ERROR', maybeApplied: false }
  return { code: 'UNAVAILABLE', reason: 'PROVIDER_ERROR', maybeApplied: method !== 'GET' }
}

function isDecimalLike(value: unknown): boolean {
  return typeof value === 'object' && value !== null &&
    typeof (value as { decimalPlaces?: unknown }).decimalPlaces === 'function' &&
    typeof (value as { toFixed?: unknown }).toFixed === 'function'
}

/**
 * Corpo JSON da requisição. Dinheiro só sai como número convertido por `toAsaasAmount`: um Decimal
 * (que o JSON transformaria em string) ou um número não finito é recusado antes da rede.
 */
function serializeBody(body: Readonly<Record<string, unknown>>): string {
  let refused = false
  let text: string | undefined
  try {
    text = JSON.stringify(body, function (this: Record<string, unknown>, key: string, value: unknown) {
      const original = key === '' ? value : this[key]
      if (isDecimalLike(original) || (typeof original === 'number' && !Number.isFinite(original)) || typeof original === 'bigint') refused = true
      return value
    })
  } catch {
    refused = true
  }
  if (refused || text === undefined) invalidRequest()
  return text
}

function queryString(query: AsaasQuery | undefined): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.append(key, String(value))
  const text = params.toString()
  return text ? '?' + text : ''
}

export function createAsaasHttpClient(config: AsaasHttpClientConfig): AsaasHttpClient {
  const environment = config.environment
  if (environment !== 'sandbox' && environment !== 'production') fail('UNAVAILABLE', { reason: 'INVALID_CONFIGURATION' })
  if (config.fetch !== undefined && typeof config.fetch !== 'function') fail('UNAVAILABLE', { reason: 'INVALID_CONFIGURATION' })
  const defaultTimeout = checkedTimeout(config.timeoutMs, ASAAS_DEFAULT_TIMEOUT_MS)
  const credential = config.credential
  if (credentialValue(credential) === null) fail('UNAVAILABLE', { reason: 'MISSING_CREDENTIAL' })
  const origin = ASAAS_API_ORIGINS[environment]
  const originUrl = new URL(origin)
  const policySource = config.policy ?? (() => readAsaasTransportPolicy())
  const directFetch: AsaasFetch = config.fetch ?? ((url, init) => globalThis.fetch(url, init))

  function log(method: AsaasMethod, path: string, status: number | null, outcome: 'OK' | AsaasFailureReason, started: number) {
    if (!config.logger) return
    try {
      config.logger({ event: 'asaas.http', environment, method, path, status, outcome, durationMs: Date.now() - started })
    } catch {
      // Um logger com defeito nunca derruba nem altera a chamada.
    }
  }

  function transportFor(policy: AsaasTransportPolicy): AsaasFetch {
    if (policy.egress.kind === 'direct') return directFetch
    if (policy.egress.kind === 'invalid') fail('UNAVAILABLE', { reason: 'EGRESS_UNAVAILABLE' })
    const factory = config.egress ?? registeredEgress
    if (!factory) fail('UNAVAILABLE', { reason: 'EGRESS_UNAVAILABLE' })
    try {
      return egressTransport(factory, policy.egress.proxyUrl)
    } catch {
      return fail('UNAVAILABLE', { reason: 'EGRESS_UNAVAILABLE' })
    }
  }

  return {
    environment,
    async request(request) {
      const started = Date.now()
      const method = request.method
      if (!METHODS.has(method)) invalidRequest()
      const path = checkedPath(request.path)
      const url = origin + path + queryString(request.query)
      const parsedUrl = new URL(url)
      // A URL final precisa ser exatamente a origem fixa + o caminho pedido (sem normalização).
      if (parsedUrl.origin !== originUrl.origin || parsedUrl.pathname !== originUrl.pathname + path) invalidRequest()
      const timeoutMs = checkedTimeout(request.timeoutMs, defaultTimeout)
      const body = request.body === undefined ? undefined : serializeBody(request.body)

      const refuse = (code: BillingProviderErrorCode, details: BillingProviderErrorDetails): never => {
        log(method, path, details.status ?? null, details.reason ?? 'PROVIDER_ERROR', started)
        return fail(code, details)
      }

      let policy: AsaasTransportPolicy
      try {
        policy = policySource()
      } catch {
        return refuse('UNAVAILABLE', { reason: 'INVALID_CONFIGURATION' })
      }
      if (policy.outboundDisabled) return refuse('UNAVAILABLE', { reason: 'OUTBOUND_DISABLED' })
      let transport: AsaasFetch
      try {
        transport = transportFor(policy)
      } catch {
        return refuse('UNAVAILABLE', { reason: 'EGRESS_UNAVAILABLE' })
      }
      const apiKey = credentialValue(credential)
      if (apiKey === null) return refuse('UNAVAILABLE', { reason: 'MISSING_CREDENTIAL' })

      let response: Response
      try {
        response = await transport(url, {
          method,
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            access_token: apiKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
          ...(body === undefined ? {} : { body }),
        })
      } catch (error) {
        // O detalhe do erro de rede pode conter a URL com query (CPF/CNPJ): nunca é propagado.
        return refuse('UNAVAILABLE', { reason: isTimeout(error) ? 'TIMEOUT' : 'NETWORK', maybeApplied: method !== 'GET' })
      }

      if (!response.ok) {
        const failure = statusFailure(method, response.status)
        const clientError = response.status >= 400 && response.status < 500
        // O corpo de erro só é lido para extrair `errors[].code`; o resto é descartado sem registro.
        const codes = clientError ? await providerCodes(response) : []
        if (!clientError) await response.body?.cancel().catch(() => undefined)
        return refuse(failure.code, {
          reason: failure.reason,
          status: response.status,
          providerCodes: codes,
          retryAfterSeconds: failure.reason === 'RATE_LIMITED' ? retryAfter(response.headers) : null,
          maybeApplied: failure.maybeApplied,
        })
      }

      let parsed: unknown
      try {
        const text = await response.text()
        if (text.length > MAX_RESPONSE_CHARS) throw new Error('oversized')
        parsed = JSON.parse(text)
      } catch {
        return refuse('INVALID_RESPONSE', { reason: 'MALFORMED_BODY', status: response.status, maybeApplied: method !== 'GET' })
      }
      if (parsed === null || typeof parsed !== 'object') {
        return refuse('INVALID_RESPONSE', { reason: 'UNEXPECTED_SHAPE', status: response.status, maybeApplied: method !== 'GET' })
      }
      log(method, path, response.status, 'OK', started)
      return parsed
    },
  }
}
