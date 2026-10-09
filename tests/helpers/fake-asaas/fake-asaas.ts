import Decimal from 'decimal.js'

import { isAlphanumericCnpj, isValidCnpj, isValidCpf } from './documents'
import { loadFixture, type FixtureName } from './fixtures'

/**
 * Dublê de contrato da API v3 do Asaas (ADR SaaS B.15), em memória, exposto como um `fetch`.
 *
 * Construído a partir do contrato documentado (AccountSaveRequestDTO, CustomerSaveRequestDTO,
 * PaymentSaveRequestDTO, SubscriptionSaveRequestDTO, WebhookConfigSaveRequestDTO) e das fixtures
 * sanitizadas em `./fixtures`: toda resposta nasce de um molde e nunca ganha campo que o molde não
 * tem. Cobre conta raiz e subcontas (cada uma com a própria chave), clientes, cobranças,
 * assinaturas, webhooks com entrega assinada por `asaas-access-token` e as falhas 400, 401, 403,
 * 404, 429, 5xx, timeout e queda de rede.
 *
 * Suposições ainda não confirmadas no sandbox estão marcadas com VERIFICAR-SANDBOX; o lote S15
 * resolve cada uma com a mesma suíte de contrato (`contract-suite.ts`).
 */

type Json = Record<string, unknown>
export type FakeAsaasEnvironment = 'sandbox' | 'production'

export const FAKE_ASAAS_ORIGINS: Readonly<Record<FakeAsaasEnvironment, string>> = Object.freeze({
  sandbox: 'https://api-sandbox.asaas.com',
  production: 'https://api.asaas.com',
})
const INVOICE_ORIGINS: Readonly<Record<FakeAsaasEnvironment, string>> = Object.freeze({
  sandbox: 'https://sandbox.asaas.com',
  production: 'https://www.asaas.com',
})
const BILLING_TYPES = ['UNDEFINED', 'BOLETO', 'CREDIT_CARD', 'PIX'] as const
const CYCLES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'] as const
const COMPANY_TYPES = ['MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION'] as const
const SEND_TYPES = ['SEQUENTIALLY', 'NON_SEQUENTIALLY'] as const
const APPROVAL = ['APPROVED', 'AWAITING_APPROVAL', 'PENDING', 'REJECTED'] as const
const SECRET_BODY_FIELDS = new Set(['apikey', 'authtoken', 'accesstoken', 'access_token'])
const STATUS_EVENT_PREFIX: Readonly<Record<StatusField, string>> = Object.freeze({
  bankAccountInfo: 'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_',
  commercialInfo: 'ACCOUNT_STATUS_COMMERCIAL_INFO_',
  documentation: 'ACCOUNT_STATUS_DOCUMENT_',
  general: 'ACCOUNT_STATUS_GENERAL_APPROVAL_',
})

type StatusField = 'commercialInfo' | 'bankAccountInfo' | 'documentation' | 'general'
type ApprovalStatus = (typeof APPROVAL)[number]
export type FakeAccountStatus = Record<StatusField, ApprovalStatus>

export type FakeFault =
  | { readonly kind: 'status'; readonly status: 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503; readonly body?: unknown; readonly headers?: Record<string, string> }
  /** Nunca responde: rejeita com o motivo do `signal` quando o cliente desiste. */
  | { readonly kind: 'timeout' }
  /** Queda de rede antes de o Asaas receber a requisição. */
  | { readonly kind: 'network' }
  /** O Asaas processa a requisição e a resposta se perde (timeout do lado do cliente). */
  | { readonly kind: 'apply-then-timeout' }
  /**
   * Resposta 200 que o cliente não consegue usar: `body` em texto (corpo ilegível) ou JSON de forma
   * inesperada. Com `apply: true` o Asaas processa a requisição antes (a escrita foi aplicada e só a
   * resposta veio estragada); sem ele nada é processado.
   */
  | { readonly kind: 'body'; readonly body: unknown; readonly apply?: boolean }
export interface FakeFaultRule {
  readonly method?: string
  /** Caminho sem `/v3` (ex.: `/payments`) ou expressão regular sobre ele. */
  readonly path?: string | RegExp
  /** Quantas requisições a regra afeta (padrão 1). */
  readonly times?: number
  readonly fault: FakeFault
}

export interface FakeAsaasRequestRecord {
  readonly method: string
  /** Caminho sem `/v3` e sem query. */
  readonly path: string
  readonly query: Readonly<Record<string, string>>
  /** Nomes dos headers enviados (minúsculos); valores nunca são guardados. */
  readonly headerNames: readonly string[]
  readonly redirect: RequestInit['redirect']
  readonly hadSignal: boolean
  /** Corpo JSON com `apiKey`, `authToken` e `accessToken` redigidos. */
  readonly body: unknown
  accountId: string | null
  status: number | null
  outcome: 'response' | 'timeout' | 'network' | 'timeout-after-apply'
}

export interface FakeWebhookDelivery {
  readonly id: string
  readonly accountId: string
  readonly webhookId: string
  readonly url: string
  readonly event: string
  readonly body: Json
}

export interface FakeAsaasOptions {
  readonly environment?: FakeAsaasEnvironment
  readonly now?: () => Date
  /** Formato da chave na criação de subconta. VERIFICAR-SANDBOX: qual formato o BaaS devolve. */
  readonly accountKeyFormat?: 'apiKey' | 'accessToken'
  /** VERIFICAR-SANDBOX: aceitação de CNPJ alfanumérico em /customers e /accounts. */
  readonly alphanumericCnpj?: 'accept' | 'reject'
  /** VERIFICAR-SANDBOX: para onde vão os eventos ACCOUNT_STATUS_* de uma subconta. */
  readonly accountStatusEventsTo?: 'subaccount' | 'root' | 'both'
  /** VERIFICAR-SANDBOX: valor mínimo de cobrança. */
  readonly minimumChargeValue?: string
  /**
   * A plataforma nunca remove assinatura (ADR SaaS: `DELETE /v3/subscriptions` apaga as faturas
   * vencidas; ela inativa com `PUT status: INACTIVE`). Por padrão o dublê recusa esse DELETE com
   * 405, sem efeito, e o registra em `forbiddenRequests`: um chamador que o use derruba o teste.
   * `true` só para reproduzir o Asaas de propósito.
   */
  readonly allowSubscriptionDelete?: boolean
}

/** Requisição que a política da plataforma proíbe e o dublê recusou. */
export interface FakeForbiddenRequest {
  readonly method: string
  readonly path: string
}

interface FakeWebhook {
  config: Json
  authToken: string | null
}
interface FakeAccount {
  readonly id: string
  readonly walletId: string
  readonly parentId: string | null
  profile: Json
  status: FakeAccountStatus
  readonly customers: Map<string, Json>
  readonly payments: Map<string, Json>
  readonly subscriptions: Map<string, Json>
  readonly webhooks: Map<string, FakeWebhook>
}
interface FakeKey {
  readonly value: string
  readonly accountId: string
  readonly tokenId: string
  name: string
  enabled: boolean
  deleted: boolean
  readonly expiresAt: Date | null
  readonly dateCreated: string
}
interface Context {
  readonly account: FakeAccount
  readonly method: string
  readonly segments: readonly string[]
  readonly query: URLSearchParams
  readonly body: Json | null
}
interface Result {
  readonly status: number
  readonly body: unknown
}

class FakeHttpError extends Error {
  constructor(readonly status: number, readonly code: string | null = null) {
    super('fake-asaas ' + status + (code ? ' ' + code : ''))
  }
}
function badRequest(code: string): never {
  throw new FakeHttpError(400, code)
}
function notFound(): never {
  throw new FakeHttpError(404)
}
function forbidden(): never {
  throw new FakeHttpError(403)
}

function pad(value: number): string {
  return String(value).padStart(12, '0')
}

function redactBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactBody)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Json).map(([key, item]) => [key, SECRET_BODY_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : redactBody(item)]))
}

function hang(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

function money(value: Decimal): number {
  return Number(value.toFixed(2))
}

function addCycle(date: string, cycle: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const days = cycle === 'WEEKLY' ? 7 : cycle === 'BIWEEKLY' ? 14 : 0
  if (days) return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
  const months = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUALLY: 6, YEARLY: 12 }[cycle] ?? 1
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export class FakeAsaas {
  readonly environment: FakeAsaasEnvironment
  readonly origin: string
  readonly rootAccountId: string
  readonly rootApiKey: string
  private readonly now: () => Date
  private readonly options: Required<Omit<FakeAsaasOptions, 'now' | 'environment'>>
  private readonly accounts = new Map<string, FakeAccount>()
  private readonly keys = new Map<string, FakeKey>()
  private readonly faults: { rule: FakeFaultRule; remaining: number }[] = []
  private readonly requestLog: FakeAsaasRequestRecord[] = []
  private readonly deliveryLog: FakeWebhookDelivery[] = []
  private readonly forbiddenLog: FakeForbiddenRequest[] = []
  private sequence = 0
  private accessTokenWindowOpen = false

  constructor(options: FakeAsaasOptions = {}) {
    this.environment = options.environment ?? 'sandbox'
    this.origin = FAKE_ASAAS_ORIGINS[this.environment]
    this.now = options.now ?? (() => new Date())
    this.options = {
      accountKeyFormat: options.accountKeyFormat ?? 'apiKey',
      alphanumericCnpj: options.alphanumericCnpj ?? 'accept',
      accountStatusEventsTo: options.accountStatusEventsTo ?? 'subaccount',
      minimumChargeValue: options.minimumChargeValue ?? '5.00',
      allowSubscriptionDelete: options.allowSubscriptionDelete ?? false,
    }
    const root = this.createAccount(null, loadFixture<Json>('account'), {
      commercialInfo: 'APPROVED', bankAccountInfo: 'APPROVED', documentation: 'APPROVED', general: 'APPROVED',
    })
    this.rootAccountId = root.id
    this.rootApiKey = this.issueKey(root.id, 'ROOT', 'raiz', null).value
  }

  // ------------------------------------------------------------------------------------------
  // Superfície de teste
  // ------------------------------------------------------------------------------------------

  /** `fetch` do dublê: aceite-o em `createAsaasHttpClient({ fetch })` ou num `vi.stubGlobal`. */
  readonly fetch = async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input))
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    let parsedBody: unknown = null
    let bodyError = false
    if (typeof init.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body)
      } catch {
        bodyError = true
      }
    } else if (init.body !== undefined && init.body !== null) {
      bodyError = true
    }
    const path = url.pathname.startsWith('/v3/') ? url.pathname.slice(3) : url.pathname
    const record: FakeAsaasRequestRecord = {
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      headerNames: [...headers.keys()],
      redirect: init.redirect,
      hadSignal: Boolean(init.signal),
      body: redactBody(parsedBody),
      accountId: null,
      status: null,
      outcome: 'response',
    }
    this.requestLog.push(record)
    if (url.origin !== this.origin || !url.pathname.startsWith('/v3/') || url.username || url.password) {
      record.outcome = 'network'
      throw new TypeError('fetch failed')
    }
    if (init.signal?.aborted) throw init.signal.reason
    const fault = this.takeFault(method, path)
    if (fault?.kind === 'network') {
      record.outcome = 'network'
      throw new TypeError('fetch failed')
    }
    if (fault?.kind === 'timeout') {
      record.outcome = 'timeout'
      return hang(init.signal)
    }
    if (fault?.kind === 'status') {
      record.status = fault.status
      return this.respond(fault.status, fault.body ?? this.defaultErrorBody(fault.status), fault.headers ?? this.defaultErrorHeaders(fault.status))
    }
    if (fault?.kind === 'body' && !fault.apply) {
      record.status = 200
      return this.respond(200, fault.body)
    }
    let result: Result
    try {
      result = this.handle(method, path, url.searchParams, headers, bodyError ? undefined : parsedBody, bodyError, record)
    } catch (error) {
      if (!(error instanceof FakeHttpError)) throw error
      result = { status: error.status, body: this.errorBody(error) }
    }
    record.status = result.status
    if (fault?.kind === 'apply-then-timeout') {
      record.outcome = 'timeout-after-apply'
      return hang(init.signal)
    }
    if (fault?.kind === 'body' && result.status < 300) return this.respond(result.status, fault.body)
    return this.respond(result.status, result.body)
  }

  get requests(): readonly FakeAsaasRequestRecord[] {
    return this.requestLog
  }

  get deliveries(): readonly FakeWebhookDelivery[] {
    return this.deliveryLog
  }

  /** Requisições proibidas pela plataforma que o dublê recusou (ex.: `DELETE /subscriptions/{id}`). */
  get forbiddenRequests(): readonly FakeForbiddenRequest[] {
    return this.forbiddenLog
  }

  countRequests(method: string, path: string | RegExp): number {
    return this.requestLog.filter((row) => row.method === method && (typeof path === 'string' ? row.path === path : path.test(row.path))).length
  }

  clearRecords(): void {
    this.requestLog.length = 0
    this.deliveryLog.length = 0
  }

  inject(rule: FakeFaultRule): void {
    this.faults.push({ rule, remaining: rule.times ?? 1 })
  }

  /** VERIFICAR-SANDBOX: gestão de chaves de subconta exige liberação temporária (janela de 2 h). */
  openAccessTokenWindow(): void {
    this.accessTokenWindowOpen = true
  }

  closeAccessTokenWindow(): void {
    this.accessTokenWindowOpen = false
  }

  /** Requisição que o Asaas faria ao webhook, com o header `asaas-access-token` configurado. */
  deliveryRequest(delivery: FakeWebhookDelivery, overrides: { token?: string | null } = {}): Request {
    const hook = this.accounts.get(delivery.accountId)?.webhooks.get(delivery.webhookId)
    const token = overrides.token !== undefined ? overrides.token : (hook?.authToken ?? null)
    const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'Asaas_Hmlg/3.0' }
    if (token !== null) headers['asaas-access-token'] = token
    return new Request(delivery.url, { method: 'POST', headers, body: JSON.stringify(delivery.body) })
  }

  accountStatus(accountId: string): FakeAccountStatus {
    return { ...this.requireAccount(accountId).status }
  }

  /** Muda a situação da conta e emite os eventos ACCOUNT_STATUS_* correspondentes. */
  setAccountStatus(accountId: string, patch: Partial<FakeAccountStatus>): void {
    const account = this.requireAccount(accountId)
    for (const [field, status] of Object.entries(patch) as [StatusField, ApprovalStatus][]) {
      if (!(field in STATUS_EVENT_PREFIX) || !APPROVAL.includes(status)) throw new Error('fake-asaas: situação inválida ' + field + '=' + status)
      if (account.status[field] === status) continue
      account.status[field] = status
      this.emitAccountStatus(account, STATUS_EVENT_PREFIX[field] + status)
    }
  }

  /** Emite um evento ACCOUNT_STATUS_* arbitrário (ex.: COMMERCIAL_INFO_EXPIRING_SOON). */
  emitAccountEvent(accountId: string, event: string): void {
    this.emitAccountStatus(this.requireAccount(accountId), event)
  }

  /** O cliente final paga: RECEIVED (PIX/boleto) ou CONFIRMED (cartão), com o evento. */
  receivePayment(paymentId: string, options: { date?: string } = {}): Json {
    const { account, payment } = this.findPayment(paymentId)
    const date = options.date ?? this.today()
    const status = payment.billingType === 'CREDIT_CARD' ? 'CONFIRMED' : 'RECEIVED'
    Object.assign(payment, { status, paymentDate: date, clientPaymentDate: date, billingType: payment.billingType === 'UNDEFINED' ? 'PIX' : payment.billingType })
    this.emit(account, 'PAYMENT_' + status, 'payment', payment)
    return structuredClone(payment)
  }

  markOverdue(paymentId: string): Json {
    const { account, payment } = this.findPayment(paymentId)
    payment.status = 'OVERDUE'
    this.emit(account, 'PAYMENT_OVERDUE', 'payment', payment)
    return structuredClone(payment)
  }

  refundPayment(paymentId: string): Json {
    const { account, payment } = this.findPayment(paymentId)
    payment.status = 'REFUNDED'
    this.emit(account, 'PAYMENT_REFUNDED', 'payment', payment)
    return structuredClone(payment)
  }

  /** Gera a próxima cobrança da assinatura (no Asaas, dias antes do vencimento). */
  generateSubscriptionPayment(subscriptionId: string): Json {
    for (const account of this.accounts.values()) {
      const subscription = account.subscriptions.get(subscriptionId)
      if (subscription) return structuredClone(this.subscriptionPayment(account, subscription))
    }
    throw new Error('fake-asaas: assinatura inexistente ' + subscriptionId)
  }

  // ------------------------------------------------------------------------------------------
  // Infraestrutura
  // ------------------------------------------------------------------------------------------

  private nextId(): number {
    this.sequence += 1
    return this.sequence
  }

  private uuid(group: string): string {
    return '00000000-0000-4000-' + group + '-' + pad(this.nextId())
  }

  private today(): string {
    return new Date(this.now().getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
  }

  private timestamp(offsetDays = 0): string {
    return new Date(this.now().getTime() - 3 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
  }

  private template(name: FixtureName, values: Json): Json {
    const base = loadFixture<Json>(name)
    for (const key of Object.keys(values)) {
      if (!(key in base)) throw new Error('fake-asaas: campo "' + key + '" não existe na fixture ' + name)
    }
    return { ...base, ...values }
  }

  private respond(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    if (typeof body === 'string') return new Response(body, { status, headers: { 'content-type': 'text/plain', ...headers } })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
  }

  private defaultErrorBody(status: number): unknown {
    const errors = loadFixture<Record<string, unknown>>('errors')
    return errors[String(status)] ?? (status >= 500 ? 'Service Unavailable' : { errors: [] })
  }

  private defaultErrorHeaders(status: number): Record<string, string> {
    // VERIFICAR-SANDBOX: headers de limite de requisições devolvidos com 429.
    return status === 429 ? { 'RateLimit-Limit': '100', 'RateLimit-Remaining': '0', 'RateLimit-Reset': '60', 'Retry-After': '60' } : {}
  }

  private errorBody(error: FakeHttpError): unknown {
    if (error.status === 400) {
      const code = error.code ?? 'invalid_object'
      return { errors: [{ code, description: 'Descricao de exemplo para ' + code + '.' }] }
    }
    return this.defaultErrorBody(error.status)
  }

  private takeFault(method: string, path: string): FakeFault | null {
    const index = this.faults.findIndex(({ rule }) =>
      (!rule.method || rule.method.toUpperCase() === method) &&
      (!rule.path || (typeof rule.path === 'string' ? rule.path === path : rule.path.test(path))))
    if (index < 0) return null
    const entry = this.faults[index]!
    entry.remaining -= 1
    if (entry.remaining <= 0) this.faults.splice(index, 1)
    return entry.rule.fault
  }

  private requireAccount(accountId: string): FakeAccount {
    const account = this.accounts.get(accountId)
    if (!account) throw new Error('fake-asaas: conta inexistente ' + accountId)
    return account
  }

  private findPayment(paymentId: string): { account: FakeAccount; payment: Json } {
    for (const account of this.accounts.values()) {
      const payment = account.payments.get(paymentId)
      if (payment) return { account, payment }
    }
    throw new Error('fake-asaas: cobrança inexistente ' + paymentId)
  }

  private createAccount(parentId: string | null, profile: Json, status: FakeAccountStatus): FakeAccount {
    const id = this.uuid('8000')
    const walletId = this.uuid('9000')
    const account: FakeAccount = {
      id, walletId, parentId, status,
      profile: { ...profile, id, walletId },
      customers: new Map(), payments: new Map(), subscriptions: new Map(), webhooks: new Map(),
    }
    this.accounts.set(id, account)
    return account
  }

  private issueKey(accountId: string, kind: string, name: string, expiresAt: Date | null): FakeKey {
    // VERIFICAR-SANDBOX: formato da chave ($aact_hmlg_… no sandbox, $aact_prod_… em produção).
    const prefix = this.environment === 'production' ? '$aact_prod_' : '$aact_hmlg_'
    const key: FakeKey = {
      value: prefix + 'FAKE_' + kind + '_KEY_' + pad(this.nextId()),
      accountId, tokenId: this.uuid('a000'), name, enabled: true, deleted: false, expiresAt, dateCreated: this.timestamp(),
    }
    this.keys.set(key.value, key)
    return key
  }

  private authenticate(headers: Headers): FakeKey {
    // Só o header `access_token` autentica; `Authorization` é ignorado.
    const value = headers.get('access_token')
    const key = value ? this.keys.get(value) : undefined
    if (!key || key.deleted || !key.enabled || (key.expiresAt && key.expiresAt.getTime() <= this.now().getTime())) {
      throw new FakeHttpError(401)
    }
    return key
  }

  private emit(account: FakeAccount, event: string, resourceKey: string | null, resource: Json | null, extra: Json = {}): void {
    const body: Json = this.template('webhook-event', { id: 'evt_' + pad(this.nextId()), event, dateCreated: this.timestamp() })
    // A chave do recurso (`payment`, `subscription`, `accountStatus`…) acompanha o envelope da fixture.
    if (resourceKey && resource) body[resourceKey] = structuredClone(resource)
    Object.assign(body, extra)
    for (const hook of account.webhooks.values()) {
      const events = hook.config.events as string[]
      if (hook.config.enabled !== true || hook.config.interrupted === true || !events.includes(event)) continue
      this.deliveryLog.push({
        id: String(body.id), accountId: account.id, webhookId: String(hook.config.id), url: String(hook.config.url), event, body: structuredClone(body),
      })
    }
  }

  private emitAccountStatus(account: FakeAccount, event: string): void {
    const status = this.template('account-status', { id: account.id, ...account.status })
    const target = this.options.accountStatusEventsTo
    if (target !== 'root') this.emit(account, event, 'accountStatus', status)
    const root = account.parentId ? this.accounts.get(account.parentId) : undefined
    // VERIFICAR-SANDBOX: identificação da subconta (`account.id`) no evento entregue à raiz.
    if (root && target !== 'subaccount') this.emit(root, event, 'accountStatus', status, { account: { id: account.id } })
  }

  // ------------------------------------------------------------------------------------------
  // Validação (códigos `invalid_<campo>`; VERIFICAR-SANDBOX: códigos exatos de cada recusa)
  // ------------------------------------------------------------------------------------------

  private text(body: Json, field: string, required: boolean, max = 255): string | null {
    const value = body[field]
    if (value === undefined || value === null || value === '') return required ? badRequest('invalid_' + field) : null
    if (typeof value !== 'string' || !value.trim() || value.length > max) return badRequest('invalid_' + field)
    return value
  }

  private email(body: Json, field: string, required: boolean): string | null {
    const value = this.text(body, field, required)
    if (value !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) badRequest('invalid_' + field)
    return value
  }

  private document(body: Json, field = 'cpfCnpj'): { value: string; personType: 'FISICA' | 'JURIDICA' } {
    const raw = body[field]
    if (typeof raw !== 'string') return badRequest('invalid_cpfCnpj')
    const value = raw.trim().replace(/[.\-/\s]/g, '').toUpperCase()
    if (isValidCpf(value)) return { value, personType: 'FISICA' }
    if (!isValidCnpj(value)) return badRequest('invalid_cpfCnpj')
    if (isAlphanumericCnpj(value) && this.options.alphanumericCnpj === 'reject') return badRequest('invalid_cpfCnpj')
    return { value, personType: 'JURIDICA' }
  }

  private amount(body: Json, field: string, options: { min?: Decimal; allowZero?: boolean } = {}): Decimal {
    const value = body[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) return badRequest('invalid_' + field)
    const amount = new Decimal(String(value))
    if (amount.decimalPlaces() > 2 || amount.isNegative() || (!options.allowZero && amount.isZero())) return badRequest('invalid_' + field)
    if (options.min && amount.lessThan(options.min)) return badRequest('invalid_' + field)
    return amount
  }

  private date(body: Json, field: string, options: { required: boolean; notPast?: boolean }): string | null {
    const value = body[field]
    if (value === undefined || value === null) return options.required ? badRequest('invalid_' + field) : null
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return badRequest('invalid_' + field)
    const [year, month, day] = value.split('-').map(Number) as [number, number, number]
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return badRequest('invalid_' + field)
    if (options.notPast && value < this.today()) return badRequest('invalid_' + field)
    return value
  }

  private oneOf<T extends string>(body: Json, field: string, allowed: readonly T[], required: boolean): T | null {
    const value = body[field]
    if (value === undefined || value === null) return required ? badRequest('invalid_' + field) : null
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) return badRequest('invalid_' + field)
    return value as T
  }

  private charges(body: Json, current: Json | null): Json {
    const out: Json = {}
    for (const field of ['fine', 'interest', 'discount'] as const) {
      const value = body[field]
      if (value === undefined) continue
      if (!value || typeof value !== 'object' || Array.isArray(value)) badRequest('invalid_' + field)
      const amount = this.amount(value as Json, 'value', { allowZero: true })
      const base = (current?.[field] ?? loadFixture<Json>('payment')[field]) as Json
      out[field] = { ...base, ...(value as Json), value: money(amount) }
    }
    return out
  }

  private requireBody(context: Context): Json {
    if (!context.body) return badRequest('invalid_object')
    return context.body
  }

  private page(items: Json[], query: URLSearchParams): Json {
    const offset = Math.max(0, Number.parseInt(query.get('offset') ?? '0', 10) || 0)
    // VERIFICAR-SANDBOX: limite acima de 100 é recusado ou limitado a 100.
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.get('limit') ?? '10', 10) || 10))
    const data = items.slice(offset, offset + limit).map((item) => structuredClone(item))
    return this.template('list', { hasMore: offset + limit < items.length, totalCount: items.length, limit, offset, data })
  }

  private filtered(items: Iterable<Json>, query: URLSearchParams, fields: readonly string[]): Json[] {
    return [...items].filter((item) => item.deleted !== true && fields.every((field) => {
      const wanted = query.get(field)
      return wanted === null || String(item[field]) === (field === 'cpfCnpj' ? wanted.toUpperCase() : wanted)
    }))
  }

  // ------------------------------------------------------------------------------------------
  // Rotas
  // ------------------------------------------------------------------------------------------

  private handle(method: string, path: string, query: URLSearchParams, headers: Headers, body: unknown, bodyError: boolean, record: FakeAsaasRequestRecord): Result {
    const key = this.authenticate(headers)
    const account = this.requireAccount(key.accountId)
    record.accountId = account.id
    if (bodyError || (body !== null && body !== undefined && (typeof body !== 'object' || Array.isArray(body)))) badRequest('invalid_object')
    const context: Context = { account, method, segments: path.split('/').filter(Boolean), query, body: (body ?? null) as Json | null }
    const [resource] = context.segments
    switch (resource) {
      case 'accounts': return this.accountsRoute(context)
      case 'myAccount': return this.myAccountRoute(context)
      case 'customers': return this.customersRoute(context)
      case 'payments': return this.paymentsRoute(context)
      case 'subscriptions': return this.subscriptionsRoute(context)
      case 'webhooks': return this.webhooksRoute(context)
      default: return notFound()
    }
  }

  private accountsRoute(context: Context): Result {
    // VERIFICAR-SANDBOX: subconta não cria nem gerencia subcontas (403).
    if (context.account.parentId !== null) forbidden()
    const [, accountId, sub, tokenId] = context.segments
    if (!accountId) {
      if (context.method === 'GET') {
        const children = [...this.accounts.values()].filter((row) => row.parentId === context.account.id).map((row) => row.profile)
        return { status: 200, body: this.page(this.filtered(children, context.query, ['cpfCnpj', 'email', 'name', 'walletId']), context.query) }
      }
      if (context.method === 'POST') return { status: 200, body: this.createSubaccount(context) }
      return notFound()
    }
    const target = this.accounts.get(accountId)
    if (!target || target.parentId !== context.account.id) return notFound()
    if (sub !== 'accessTokens') return context.method === 'GET' && !sub ? { status: 200, body: structuredClone(target.profile) } : notFound()
    if (!this.accessTokenWindowOpen) forbidden()
    const tokens = [...this.keys.values()].filter((row) => row.accountId === target.id && !row.deleted)
    const view = (row: FakeKey, withKey: boolean): Json => {
      const shaped = this.template('access-token', {
        id: row.tokenId, name: row.name, enabled: row.enabled, dateCreated: row.dateCreated,
        expirationDate: row.expiresAt ? row.expiresAt.toISOString().slice(0, 19).replace('T', ' ') : null,
        projectedExpirationDateByLackOfUse: null, apiKey: row.value,
      })
      if (!withKey) delete shaped.apiKey
      return shaped
    }
    if (!tokenId) {
      if (context.method === 'GET') return { status: 200, body: this.page(tokens.map((row) => view(row, false)), context.query) }
      if (context.method === 'POST') {
        const body = this.requireBody(context)
        const name = this.text(body, 'name', true, 100)!
        const expiration = body.expirationDate === undefined || body.expirationDate === null ? null : new Date(String(body.expirationDate).replace(' ', 'T') + '-03:00')
        if (expiration && !Number.isFinite(expiration.getTime())) badRequest('invalid_expirationDate')
        return { status: 200, body: view(this.issueKey(target.id, 'SUBACCOUNT', name, expiration), true) }
      }
      return notFound()
    }
    const token = tokens.find((row) => row.tokenId === tokenId)
    if (!token) return notFound()
    if (context.method === 'PUT') {
      const body = this.requireBody(context)
      if (typeof body.enabled !== 'boolean') badRequest('invalid_enabled')
      token.enabled = body.enabled as boolean
      return { status: 200, body: view(token, false) }
    }
    if (context.method === 'DELETE') {
      token.deleted = true
      return { status: 200, body: this.template('deleted', { id: token.tokenId }) }
    }
    return notFound()
  }

  private createSubaccount(context: Context): Json {
    const body = this.requireBody(context)
    const name = this.text(body, 'name', true)!
    const email = this.email(body, 'email', true)!
    const loginEmail = this.email(body, 'loginEmail', false)
    const document = this.document(body)
    const mobilePhone = this.text(body, 'mobilePhone', true, 20)!
    if (!/^\d{10,11}$/.test(mobilePhone)) badRequest('invalid_mobilePhone')
    const incomeValue = this.amount(body, 'incomeValue')
    const address = this.text(body, 'address', true)!
    const addressNumber = this.text(body, 'addressNumber', true, 20)!
    const province = this.text(body, 'province', true)!
    const postalCode = (this.text(body, 'postalCode', true, 9) ?? '').replace('-', '')
    if (!/^\d{8}$/.test(postalCode)) badRequest('invalid_postalCode')
    const birthDate = this.date(body, 'birthDate', { required: document.personType === 'FISICA' })
    // VERIFICAR-SANDBOX: companyType obrigatório para CNPJ.
    const companyType = this.oneOf(body, 'companyType', COMPANY_TYPES, document.personType === 'JURIDICA')
    const site = this.text(body, 'site', false)
    const hooks = body.webhooks === undefined || body.webhooks === null ? [] : body.webhooks
    if (!Array.isArray(hooks)) return badRequest('invalid_webhooks')
    const validatedHooks = hooks.map((hook) => {
      if (!hook || typeof hook !== 'object' || Array.isArray(hook)) return badRequest('invalid_webhooks')
      return this.webhookConfig(hook as Json, null)
    })

    // VERIFICAR-SANDBOX: situação inicial de uma subconta recém-criada.
    const account = this.createAccount(context.account.id, this.template('account', {
      name, email, loginEmail: loginEmail ?? email, phone: this.text(body, 'phone', false, 20), mobilePhone,
      address, addressNumber, complement: this.text(body, 'complement', false), province, postalCode,
      cpfCnpj: document.value, birthDate, personType: document.personType, companyType, site, incomeValue: money(incomeValue),
      tradingName: null, city: null, state: null,
      commercialInfoExpiration: { isExpired: false, scheduledDate: this.timestamp(365) },
    }), { commercialInfo: 'PENDING', bankAccountInfo: 'PENDING', documentation: 'PENDING', general: 'PENDING' })
    account.profile.accountNumber = { agency: '0001', account: pad(this.nextId()).slice(-7), accountDigit: '0' }
    for (const hook of validatedHooks) this.storeWebhook(account, hook.config, hook.authToken)

    if (this.options.accountKeyFormat === 'apiKey') {
      const key = this.issueKey(account.id, 'SUBACCOUNT', 'criacao', null)
      return this.template('account-created.api-key', { ...account.profile, apiKey: key.value })
    }
    const expires = new Date(this.now().getTime() + 365 * 86_400_000)
    const key = this.issueKey(account.id, 'SUBACCOUNT', 'criacao', expires)
    return this.template('account-created.access-token', {
      ...account.profile,
      accessToken: {
        id: key.tokenId, apiKey: key.value, expirationDate: this.timestamp(365), projectedExpirationDateByLackOfUse: this.timestamp(90),
      },
    })
  }

  private myAccountRoute(context: Context): Result {
    const [, sub] = context.segments
    if (context.method !== 'GET' || context.segments.length !== 2) return notFound()
    const account = context.account
    if (sub === 'status') return { status: 200, body: this.template('account-status', { id: account.id, ...account.status }) }
    if (sub === 'commercialInfo') {
      const profile = account.profile
      return { status: 200, body: this.template('commercial-info', {
        status: account.status.commercialInfo, personType: profile.personType, cpfCnpj: profile.cpfCnpj, name: profile.name,
        birthDate: profile.birthDate, companyName: profile.personType === 'JURIDICA' ? profile.name : null, companyType: profile.companyType,
        incomeValue: profile.incomeValue, email: profile.email, phone: profile.phone, mobilePhone: profile.mobilePhone,
        postalCode: profile.postalCode, address: profile.address, addressNumber: profile.addressNumber, complement: profile.complement,
        province: profile.province, site: profile.site, commercialInfoExpiration: profile.commercialInfoExpiration,
      }) }
    }
    return notFound()
  }

  private customersRoute(context: Context): Result {
    const [, id] = context.segments
    const store = context.account.customers
    if (!id) {
      if (context.method === 'GET') return { status: 200, body: this.page(this.filtered(store.values(), context.query, ['cpfCnpj', 'externalReference', 'email', 'name']), context.query) }
      if (context.method !== 'POST') return notFound()
      const body = this.requireBody(context)
      const name = this.text(body, 'name', true)!
      const document = this.document(body)
      if (body.notificationDisabled !== undefined && typeof body.notificationDisabled !== 'boolean') badRequest('invalid_notificationDisabled')
      const customer = this.template('customer', {
        id: 'cus_' + pad(this.nextId()), dateCreated: this.today(), name, email: this.email(body, 'email', false),
        company: this.text(body, 'company', false), phone: this.text(body, 'phone', false, 20), mobilePhone: this.text(body, 'mobilePhone', false, 20),
        address: this.text(body, 'address', false), addressNumber: this.text(body, 'addressNumber', false, 20), complement: this.text(body, 'complement', false),
        province: this.text(body, 'province', false), postalCode: this.text(body, 'postalCode', false, 9),
        cpfCnpj: document.value, personType: document.personType, deleted: false,
        additionalEmails: this.text(body, 'additionalEmails', false), externalReference: this.text(body, 'externalReference', false, 100),
        notificationDisabled: body.notificationDisabled === true, observations: this.text(body, 'observations', false, 1000),
        municipalInscription: this.text(body, 'municipalInscription', false), stateInscription: this.text(body, 'stateInscription', false),
        foreignCustomer: false,
      })
      store.set(String(customer.id), customer)
      return { status: 200, body: structuredClone(customer) }
    }
    const customer = store.get(id)
    if (!customer || context.segments.length !== 2 || context.method !== 'GET') return notFound()
    return { status: 200, body: structuredClone(customer) }
  }

  private newPayment(account: FakeAccount, values: { customer: string; billingType: string; value: Decimal; dueDate: string; description: string | null; externalReference: string | null; subscription: string | null; charges: Json }): Json {
    const number = pad(this.nextId())
    const invoice = INVOICE_ORIGINS[this.environment]
    const bankSlip = values.billingType === 'BOLETO' || values.billingType === 'UNDEFINED'
    const payment = this.template('payment', {
      id: 'pay_' + number, dateCreated: this.today(), customer: values.customer, subscription: values.subscription,
      value: money(values.value),
      // VERIFICAR-SANDBOX: netValue desconta a tarifa do meio de pagamento; o dublê não cobra tarifa.
      netValue: money(values.value),
      description: values.description, billingType: values.billingType, status: 'PENDING', dueDate: values.dueDate, originalDueDate: values.dueDate,
      paymentDate: null, clientPaymentDate: null, invoiceUrl: invoice + '/i/' + number, invoiceNumber: number.slice(-8),
      externalReference: values.externalReference, deleted: false, nossoNumero: bankSlip ? number.slice(-8) : null,
      bankSlipUrl: bankSlip ? invoice + '/b/pdf/' + number : null, ...values.charges,
    })
    account.payments.set(String(payment.id), payment)
    this.emit(account, 'PAYMENT_CREATED', 'payment', payment)
    return payment
  }

  private paymentsRoute(context: Context): Result {
    const [, id, sub] = context.segments
    const account = context.account
    if (!id) {
      if (context.method === 'GET') {
        return { status: 200, body: this.page(this.filtered(account.payments.values(), context.query, ['customer', 'subscription', 'externalReference', 'status', 'billingType']), context.query) }
      }
      if (context.method !== 'POST') return notFound()
      const body = this.requireBody(context)
      const customerId = this.text(body, 'customer', true)!
      const customer = account.customers.get(customerId)
      if (!customer || customer.deleted === true) badRequest('invalid_customer')
      const billingType = this.oneOf(body, 'billingType', BILLING_TYPES, true)!
      const value = this.amount(body, 'value', { min: new Decimal(this.options.minimumChargeValue) })
      const dueDate = this.date(body, 'dueDate', { required: true, notPast: true })!
      const payment = this.newPayment(account, {
        customer: customerId, billingType, value, dueDate, description: this.text(body, 'description', false, 500),
        externalReference: this.text(body, 'externalReference', false, 100), subscription: null, charges: this.charges(body, null),
      })
      return { status: 200, body: structuredClone(payment) }
    }
    const payment = account.payments.get(id)
    if (!payment) return notFound()
    if (!sub) {
      // VERIFICAR-SANDBOX: GET de cobrança removida devolve o objeto com `deleted: true`.
      if (context.method === 'GET') return { status: 200, body: structuredClone(payment) }
      if (context.method === 'DELETE') {
        // VERIFICAR-SANDBOX: código da recusa ao remover cobrança paga.
        if (payment.deleted === true || !['PENDING', 'OVERDUE'].includes(String(payment.status))) badRequest('invalid_action')
        payment.deleted = true
        this.emit(account, 'PAYMENT_DELETED', 'payment', payment)
        return { status: 200, body: this.template('deleted', { id }) }
      }
      return notFound()
    }
    if (context.method !== 'GET' || context.segments.length !== 3 || payment.deleted === true) return notFound()
    if (sub === 'pixQrCode') {
      if (!['PIX', 'UNDEFINED', 'BOLETO'].includes(String(payment.billingType)) || !['PENDING', 'OVERDUE'].includes(String(payment.status))) badRequest('invalid_action')
      return { status: 200, body: this.template('pix-qr-code', {
        payload: '00020101021226FAKEPIX' + id.toUpperCase(), expirationDate: String(payment.dueDate) + ' 23:59:59',
      }) }
    }
    if (sub === 'identificationField') {
      // VERIFICAR-SANDBOX: linha digitável pedida para cobrança PIX.
      if (!['BOLETO', 'UNDEFINED'].includes(String(payment.billingType))) badRequest('invalid_billingType')
      const digits = new Decimal(String(payment.value)).times(100).toFixed(0).padStart(10, '0')
      return { status: 200, body: this.template('identification-field', {
        identificationField: '0019000009' + String(payment.nossoNumero).padStart(27, '0') + digits,
        nossoNumero: payment.nossoNumero, barCode: '0019' + digits + String(payment.nossoNumero).padStart(30, '0'),
      }) }
    }
    return notFound()
  }

  private subscriptionPayment(account: FakeAccount, subscription: Json): Json {
    const dueDate = String(subscription.nextDueDate)
    const payment = this.newPayment(account, {
      customer: String(subscription.customer), billingType: String(subscription.billingType), value: new Decimal(String(subscription.value)),
      dueDate, description: (subscription.description as string | null) ?? null,
      // VERIFICAR-SANDBOX: cobranças da assinatura herdam o externalReference da assinatura.
      externalReference: (subscription.externalReference as string | null) ?? null,
      subscription: String(subscription.id),
      charges: { fine: subscription.fine, interest: subscription.interest, discount: subscription.discount },
    })
    subscription.nextDueDate = addCycle(dueDate, String(subscription.cycle))
    return payment
  }

  private subscriptionsRoute(context: Context): Result {
    const [, id, sub] = context.segments
    const account = context.account
    if (!id) {
      if (context.method === 'GET') {
        return { status: 200, body: this.page(this.filtered(account.subscriptions.values(), context.query, ['customer', 'externalReference', 'status', 'billingType']), context.query) }
      }
      if (context.method !== 'POST') return notFound()
      const body = this.requireBody(context)
      const customerId = this.text(body, 'customer', true)!
      const customer = account.customers.get(customerId)
      if (!customer || customer.deleted === true) badRequest('invalid_customer')
      const subscription = this.template('subscription', {
        id: 'sub_' + pad(this.nextId()), dateCreated: this.today(), customer: customerId,
        billingType: this.oneOf(body, 'billingType', BILLING_TYPES, true), cycle: this.oneOf(body, 'cycle', CYCLES, true),
        value: money(this.amount(body, 'value', { min: new Decimal(this.options.minimumChargeValue) })),
        nextDueDate: this.date(body, 'nextDueDate', { required: true, notPast: true }), endDate: this.date(body, 'endDate', { required: false }),
        description: this.text(body, 'description', false, 500), status: 'ACTIVE', deleted: false,
        maxPayments: typeof body.maxPayments === 'number' ? body.maxPayments : null,
        externalReference: this.text(body, 'externalReference', false, 100), ...this.charges(body, null),
      })
      account.subscriptions.set(String(subscription.id), subscription)
      this.emit(account, 'SUBSCRIPTION_CREATED', 'subscription', subscription)
      // VERIFICAR-SANDBOX: a primeira cobrança é gerada na criação e o próximo vencimento avança um ciclo.
      this.subscriptionPayment(account, subscription)
      return { status: 200, body: structuredClone(subscription) }
    }
    const subscription = account.subscriptions.get(id)
    if (!subscription) return notFound()
    if (sub === 'payments' && context.method === 'GET' && context.segments.length === 3) {
      const rows = [...account.payments.values()].filter((row) => row.subscription === id && row.deleted !== true)
      return { status: 200, body: this.page(rows, context.query) }
    }
    if (sub) return notFound()
    if (context.method === 'GET') return { status: 200, body: structuredClone(subscription) }
    if (context.method === 'PUT') {
      if (subscription.deleted === true) badRequest('invalid_action')
      const body = this.requireBody(context)
      const patch: Json = {}
      if (body.billingType !== undefined) patch.billingType = this.oneOf(body, 'billingType', BILLING_TYPES, true)
      if (body.cycle !== undefined) patch.cycle = this.oneOf(body, 'cycle', CYCLES, true)
      if (body.value !== undefined) patch.value = money(this.amount(body, 'value', { min: new Decimal(this.options.minimumChargeValue) }))
      if (body.nextDueDate !== undefined) patch.nextDueDate = this.date(body, 'nextDueDate', { required: true, notPast: true })
      if (body.endDate !== undefined) patch.endDate = this.date(body, 'endDate', { required: false })
      if (body.description !== undefined) patch.description = this.text(body, 'description', false, 500)
      if (body.externalReference !== undefined) patch.externalReference = this.text(body, 'externalReference', false, 100)
      if (body.status !== undefined) patch.status = this.oneOf(body, 'status', ['ACTIVE', 'INACTIVE'] as const, true)
      if (body.updatePendingPayments !== undefined && typeof body.updatePendingPayments !== 'boolean') badRequest('invalid_updatePendingPayments')
      Object.assign(patch, this.charges(body, subscription))
      Object.assign(subscription, patch)
      if (body.updatePendingPayments === true) {
        for (const payment of account.payments.values()) {
          if (payment.subscription !== id || payment.deleted === true || payment.status !== 'PENDING') continue
          if (patch.value !== undefined) Object.assign(payment, { value: patch.value, netValue: patch.value })
          if (patch.billingType !== undefined) payment.billingType = patch.billingType
          this.emit(account, 'PAYMENT_UPDATED', 'payment', payment)
        }
      }
      // VERIFICAR-SANDBOX: INACTIVE não remove cobranças já geradas (o dublê não tem efeito colateral).
      this.emit(account, patch.status === 'INACTIVE' ? 'SUBSCRIPTION_INACTIVATED' : 'SUBSCRIPTION_UPDATED', 'subscription', subscription)
      return { status: 200, body: structuredClone(subscription) }
    }
    if (context.method === 'DELETE') {
      if (!this.options.allowSubscriptionDelete) {
        this.forbiddenLog.push({ method: 'DELETE', path: '/subscriptions/' + id })
        throw new FakeHttpError(405, 'subscription_delete_forbidden')
      }
      subscription.deleted = true
      // VERIFICAR-SANDBOX: remover a assinatura remove as cobranças pendentes e vencidas.
      for (const payment of account.payments.values()) {
        if (payment.subscription === id && payment.deleted !== true && ['PENDING', 'OVERDUE'].includes(String(payment.status))) {
          payment.deleted = true
          this.emit(account, 'PAYMENT_DELETED', 'payment', payment)
        }
      }
      this.emit(account, 'SUBSCRIPTION_DELETED', 'subscription', subscription)
      return { status: 200, body: this.template('deleted', { id }) }
    }
    return notFound()
  }

  private webhookConfig(body: Json, current: Json | null): { config: Json; authToken: string | null | undefined } {
    const partial = current !== null
    const read = <T>(field: string, reader: () => T): T | undefined => (partial && body[field] === undefined ? undefined : reader())
    const url = read('url', () => this.text(body, 'url', true, 500)!)
    if (url !== undefined) {
      let parsed: URL | null = null
      try {
        parsed = new URL(url)
      } catch {
        badRequest('invalid_url')
      }
      // VERIFICAR-SANDBOX: produção exige https.
      if (!parsed || (parsed.protocol !== 'https:' && !(this.environment === 'sandbox' && parsed.protocol === 'http:'))) badRequest('invalid_url')
    }
    const events = read('events', () => {
      const value = body.events
      // VERIFICAR-SANDBOX: recusa de nome de evento desconhecido.
      if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !/^[A-Z][A-Z_]*[A-Z]$/.test(item))) return badRequest('invalid_events')
      return [...new Set(value as string[])]
    })
    const authToken = body.authToken === undefined ? undefined : body.authToken === null ? null : (() => {
      const value = body.authToken
      // VERIFICAR-SANDBOX: tamanho e caracteres aceitos no authToken (32 a 255, sem espaço).
      if (typeof value !== 'string' || !/^\S{32,255}$/.test(value)) return badRequest('invalid_authToken')
      return value
    })()
    if (body.apiVersion !== undefined && body.apiVersion !== 3) badRequest('invalid_apiVersion')
    for (const field of ['enabled', 'interrupted'] as const) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') badRequest('invalid_' + field)
    }
    const values: Json = {}
    const name = read('name', () => this.text(body, 'name', true, 100))
    if (name !== undefined) values.name = name
    if (url !== undefined) values.url = url
    const email = read('email', () => this.email(body, 'email', false))
    if (email !== undefined) values.email = email
    const sendType = read('sendType', () => this.oneOf(body, 'sendType', SEND_TYPES, true))
    if (sendType !== undefined) values.sendType = sendType
    if (events !== undefined) values.events = events
    if (body.enabled !== undefined) values.enabled = body.enabled
    if (body.interrupted !== undefined) values.interrupted = body.interrupted
    if (!partial) Object.assign(values, { apiVersion: 3, enabled: values.enabled ?? true, interrupted: values.interrupted ?? false })
    return { config: values, authToken }
  }

  private storeWebhook(account: FakeAccount, values: Json, authToken: string | null | undefined): Json {
    const config = this.template('webhook', { ...values, id: this.uuid('b000'), hasAuthToken: Boolean(authToken) })
    account.webhooks.set(String(config.id), { config, authToken: authToken ?? null })
    return config
  }

  private webhooksRoute(context: Context): Result {
    const [, id] = context.segments
    const account = context.account
    if (!id) {
      if (context.method === 'GET') return { status: 200, body: this.page([...account.webhooks.values()].map((hook) => hook.config), context.query) }
      if (context.method !== 'POST') return notFound()
      const parsed = this.webhookConfig(this.requireBody(context), null)
      // O authToken nunca volta na resposta: só `hasAuthToken`.
      return { status: 200, body: structuredClone(this.storeWebhook(account, parsed.config, parsed.authToken)) }
    }
    const hook = account.webhooks.get(id)
    if (!hook || context.segments.length !== 2) return notFound()
    if (context.method === 'GET') return { status: 200, body: structuredClone(hook.config) }
    if (context.method === 'PUT') {
      const parsed = this.webhookConfig(this.requireBody(context), hook.config)
      Object.assign(hook.config, parsed.config)
      if (parsed.authToken !== undefined) {
        hook.authToken = parsed.authToken
        hook.config.hasAuthToken = Boolean(parsed.authToken)
      }
      return { status: 200, body: structuredClone(hook.config) }
    }
    if (context.method === 'DELETE') {
      account.webhooks.delete(id)
      return { status: 200, body: this.template('deleted', { id }) }
    }
    return notFound()
  }
}

export function createFakeAsaas(options: FakeAsaasOptions = {}): FakeAsaas {
  return new FakeAsaas(options)
}
