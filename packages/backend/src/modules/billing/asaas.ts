import { toAsaasAmount, toMoney, type Money, type MoneyInput } from './asaas-amount'
import { parseAsaasDate } from './asaas-events'
import {
  asaasPath,
  AsaasSecretValue,
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasCredential,
  type AsaasEgressFactory,
  type AsaasEnvironment,
  type AsaasFetch,
  type AsaasHttpLogger,
} from './asaas-http'
import type { CancellationGateway } from './cancel-attempt'

export type BillingMethod = 'PIX' | 'BOLETO'
/**
 * Cobrança como o Asaas a devolve. `value` é o número da borda HTTP: compare sempre com
 * `sameAmount`, nunca com `===`/`!==`.
 */
export type ProviderCharge = { id: string; value: number; externalReference: string; billingType: string; status: string; bankSlipUrl?: string; deleted?: boolean; paymentDate?: string }
export type ChargeRequest = {
  reference: string
  /** Decimal (preferido) ou string decimal; `number` só por compatibilidade. Até 2 casas. */
  amount: MoneyInput
  dueDate: string
  description: string
  method: BillingMethod
  customer: { name: string; email: string; document: string }
}
export type ChargeDetails = { pixCode?: string; pixQrCode?: string; barcode?: string; digitableLine?: string; pdfUrl?: string }
export interface BillingGateway {
  find(reference: string): Promise<ProviderCharge | null>
  /**
   * Cria a cobrança. O `maybeApplied` do erro fala da COBRANÇA: `true` só quando o POST /payments
   * pode ter sido aplicado. Falha antes dele (busca ou cadastro do cliente) sai sempre com
   * `maybeApplied=false`: nenhuma cobrança foi enviada, e o cadastro do cliente é idempotente (a
   * próxima tentativa busca o cliente por CPF/CNPJ antes de cadastrar).
   */
  create(input: ChargeRequest): Promise<ProviderCharge>
  details(charge: ProviderCharge): Promise<ChargeDetails>
}

function invalidRequest(): never {
  throw new BillingProviderError('REJECTED', { reason: 'INVALID_REQUEST' })
}
/**
 * De onde veio a resposta lida. `afterWrite`: resposta 2xx de uma escrita (POST/DELETE) que o Asaas
 * já aceitou — a operação pode ter sido aplicada, então uma forma inesperada sai com
 * `maybeApplied: true`, como o corpo ilegível no cliente HTTP, e nunca como prova de que nada
 * aconteceu. Resposta de leitura (GET) inválida não escreveu nada: `maybeApplied: false`.
 */
type ResponseOrigin = { readonly afterWrite?: boolean }

function invalidResponse(origin: ResponseOrigin = {}): never {
  throw new BillingProviderError('INVALID_RESPONSE', { reason: 'UNEXPECTED_SHAPE', maybeApplied: origin.afterWrite === true })
}
function object(value: unknown, origin: ResponseOrigin = {}): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(origin)
  return value as Record<string, unknown>
}
/**
 * Etapa anterior à escrita da cobrança (busca e cadastro do cliente). Um erro que diz "talvez
 * aplicado" fala do cadastro do CLIENTE — idempotente, pois a próxima tentativa busca por CPF/CNPJ
 * antes de cadastrar —, nunca da cobrança, que não foi enviada: sai com `maybeApplied=false`, e a
 * emissão devolve a tentativa à fila em vez de deixá-la UNKNOWN sem cobrança nenhuma no Asaas.
 */
async function beforeChargeWrite<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step()
  } catch (error) {
    if (!(error instanceof BillingProviderError) || !error.maybeApplied) throw error
    throw new BillingProviderError(error.code, {
      ...(error.reason ? { reason: error.reason } : {}),
      ...(error.status !== null ? { status: error.status } : {}),
      providerCodes: error.providerCodes,
      retryAfterSeconds: error.retryAfterSeconds,
      maybeApplied: false,
    })
  }
}
function charge(value: unknown, origin: ResponseOrigin = {}): ProviderCharge {
  const row = object(value, origin)
  if (typeof row.id !== 'string' || !row.id || typeof row.value !== 'number' || !Number.isFinite(row.value) ||
      typeof row.externalReference !== 'string' || typeof row.billingType !== 'string' || typeof row.status !== 'string') invalidResponse(origin)
  return { id: row.id, value: row.value, externalReference: row.externalReference, billingType: row.billingType, status: row.status,
    ...(typeof row.deleted === 'boolean' ? { deleted: row.deleted } : {}),
    ...(typeof row.paymentDate === 'string' ? { paymentDate: row.paymentDate } : {}),
    ...(typeof row.bankSlipUrl === 'string' ? { bankSlipUrl: row.bankSlipUrl } : {}) }
}

// ---------------------------------------------------------------------------------------------
// CPF/CNPJ (CNPJ alfanumérico preservado, ADR SaaS D21)
// ---------------------------------------------------------------------------------------------

/** Só pontuação de máscara sai; letras do CNPJ alfanumérico ficam (em maiúsculas). */
const DOCUMENT_FORMATTING = /[.\-/\s]/g
const CPF_SHAPE = /^\d{11}$/
const CNPJ_SHAPE = /^[0-9A-Z]{12}\d{2}$/

function documentForm(document: unknown): string {
  return typeof document === 'string' ? document.trim().replace(DOCUMENT_FORMATTING, '').toUpperCase() : ''
}

/**
 * CPF/CNPJ no formato enviado ao Asaas: sem máscara, com as letras do CNPJ alfanumérico em
 * maiúsculas. Confere só a forma (11 dígitos ou 12 alfanuméricos + 2 dígitos); os dígitos
 * verificadores são validados pelo domínio.
 */
export function normalizeAsaasDocument(document: string): string {
  const normalized = documentForm(document)
  if (!CPF_SHAPE.test(normalized) && !CNPJ_SHAPE.test(normalized)) invalidRequest()
  return normalized
}

// ---------------------------------------------------------------------------------------------
// Pedido de cobrança
// ---------------------------------------------------------------------------------------------

const DUE_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Valor da cobrança como Decimal, validado para o Asaas (positivo, até 2 casas). */
export function chargeAmount(input: Pick<ChargeRequest, 'amount'>): Money {
  const amount = toMoney(input.amount)
  toAsaasAmount(amount)
  if (!amount.isPositive() || amount.isZero()) invalidRequest()
  return amount
}

/**
 * Valida o pedido ANTES de qualquer rede ou reserva: um pedido inválido nunca sai da fila para
 * PROCESSING/UNKNOWN. Devolve os valores prontos para a borda HTTP.
 */
export function assertChargeRequest(input: ChargeRequest): { amount: Money; value: number; cpfCnpj: string } {
  if (!input || typeof input !== 'object') invalidRequest()
  if (typeof input.reference !== 'string' || !input.reference.trim()) invalidRequest()
  if (input.method !== 'PIX' && input.method !== 'BOLETO') invalidRequest()
  if (typeof input.dueDate !== 'string' || !DUE_DATE.test(input.dueDate) || parseAsaasDate(input.dueDate) === null) invalidRequest()
  if (typeof input.description !== 'string') invalidRequest()
  const customer = input.customer
  if (!customer || typeof customer.name !== 'string' || !customer.name.trim() ||
      typeof customer.email !== 'string' || !customer.email.trim()) invalidRequest()
  const amount = chargeAmount(input)
  return { amount, value: toAsaasAmount(amount), cpfCnpj: normalizeAsaasDocument(customer.document) }
}

// ---------------------------------------------------------------------------------------------
// Gateway de cobrança do cliente final (subconta ou conta conectada da locadora)
// ---------------------------------------------------------------------------------------------

export interface AsaasGatewayConfig {
  /** Chave da integração da locadora (string ou portador de segredo com `use`). */
  apiKey: AsaasCredential
  environment: AsaasEnvironment
  fetch?: AsaasFetch
  timeoutMs?: number
  logger?: AsaasHttpLogger
  egress?: AsaasEgressFactory
}

export function createAsaasGateway(config: AsaasGatewayConfig): BillingGateway & CancellationGateway {
  const http = createAsaasHttpClient({
    credential: config.apiKey,
    environment: config.environment,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    ...(config.timeoutMs ? { timeoutMs: config.timeoutMs } : {}),
    ...(config.logger ? { logger: config.logger } : {}),
    ...(config.egress ? { egress: config.egress } : {}),
  })
  return {
    async get(id) { return charge(await http.request({ method: 'GET', path: asaasPath`/payments/${id}` })) },
    async cancel(id) {
      const written = { afterWrite: true }
      const result = object(await http.request({ method: 'DELETE', path: asaasPath`/payments/${id}` }), written)
      if (result.deleted !== true || result.id !== id) invalidResponse(written)
    },
    async find(reference) {
      const page = object(await http.request({ method: 'GET', path: '/payments', query: { externalReference: reference, limit: '100' } }))
      if (!Array.isArray(page.data)) invalidResponse()
      const exact = page.data.map(row => charge(row)).filter(row => row.externalReference === reference)
      if (exact.length > 1 || page.hasMore === true) throw new BillingProviderError('AMBIGUOUS', { reason: 'AMBIGUOUS_MATCH' })
      return exact[0] ?? null
    },
    async create(input) {
      const prepared = assertChargeRequest(input)
      // Até o POST /payments nenhuma cobrança saiu: falha do cliente nunca deixa a cobrança incerta.
      const customerId = await beforeChargeWrite(async () => {
        // VERIFICAR-SANDBOX: busca e cadastro de cliente com CNPJ alfanumérico em /customers.
        const customers = object(await http.request({ method: 'GET', path: '/customers', query: { cpfCnpj: prepared.cpfCnpj, limit: '100' } }))
        if (!Array.isArray(customers.data)) invalidResponse()
        const matches = customers.data.map(row => object(row))
          .filter(row => row.deleted !== true && typeof row.cpfCnpj === 'string' && documentForm(row.cpfCnpj) === prepared.cpfCnpj)
        if (matches.length > 1 || customers.hasMore === true) throw new BillingProviderError('AMBIGUOUS', { reason: 'AMBIGUOUS_MATCH' })
        // Cliente achado na busca (leitura) ou cadastrado agora (escrita já aceita pelo Asaas).
        const origin = { afterWrite: matches[0] === undefined }
        const customer = matches[0] ?? object(await http.request({ method: 'POST', path: '/customers', body: {
          name: input.customer.name, email: input.customer.email, cpfCnpj: prepared.cpfCnpj, notificationDisabled: true,
        } }), origin)
        if (typeof customer.id !== 'string' || !customer.id) invalidResponse(origin)
        return customer.id
      })
      return charge(await http.request({ method: 'POST', path: '/payments', body: {
        customer: customerId, billingType: input.method, value: prepared.value, dueDate: input.dueDate,
        description: input.description, externalReference: input.reference,
      } }), { afterWrite: true })
    },
    async details(payment) {
      if (payment.billingType === 'PIX') {
        const data = object(await http.request({ method: 'GET', path: asaasPath`/payments/${payment.id}/pixQrCode` }))
        if (typeof data.payload !== 'string' || typeof data.encodedImage !== 'string') invalidResponse()
        return { pixCode: data.payload, pixQrCode: 'data:image/png;base64,' + data.encodedImage }
      }
      const data = object(await http.request({ method: 'GET', path: asaasPath`/payments/${payment.id}/identificationField` }))
      if (typeof data.identificationField !== 'string') invalidResponse()
      return {
        digitableLine: data.identificationField,
        ...(typeof data.barCode === 'string' ? { barcode: data.barCode } : {}),
        ...(payment.bankSlipUrl ? { pdfUrl: payment.bankSlipUrl } : {}),
      }
    },
  }
}

export const isChargePaid = (status: string) => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)

// ---------------------------------------------------------------------------------------------
// Criação de subconta (POST /v3/accounts)
// ---------------------------------------------------------------------------------------------

export interface AsaasIssuedApiKey {
  /** A chave nunca aparece em JSON, `String`, template ou `inspect`; só dentro de `use`. */
  readonly apiKey: AsaasSecretValue
  /** Onde a chave veio no corpo: formato legado (`apiKey`) ou novo (`accessToken.apiKey`). */
  readonly source: 'apiKey' | 'accessToken.apiKey'
  readonly accessTokenId: string | null
  readonly expiresAt: Date | null
  /** VERIFICAR-SANDBOX: expiração projetada por falta de uso. */
  readonly expiresByLackOfUseAt: Date | null
}
export interface AsaasCreatedAccount {
  readonly id: string
  readonly walletId: string | null
  /** `null` quando o Asaas não devolveu chave: o provisionamento vai para KEY_RECOVERY_REQUIRED. */
  readonly credential: AsaasIssuedApiKey | null
}

const API_KEY_SHAPE = /^[\x21-\x7e]{16,4096}$/

function apiKeyOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !API_KEY_SHAPE.test(value)) invalidResponse()
  return value
}

/**
 * Lê a resposta de criação de subconta aceitando a chave em `apiKey` (legado) ou em
 * `accessToken.apiKey` (com id e datas de expiração). Chaves diferentes nos dois lugares são
 * ambíguas e recusadas. O corpo bruto nunca deve ser registrado por quem chama.
 */
export function parseAsaasAccountCreation(body: unknown): AsaasCreatedAccount {
  const row = object(body)
  if (typeof row.id !== 'string' || !row.id) invalidResponse()
  const walletId = typeof row.walletId === 'string' && row.walletId ? row.walletId : null
  const legacy = apiKeyOrNull(row.apiKey)
  // VERIFICAR-SANDBOX: forma do objeto `accessToken` (id, apiKey, expirationDate, projectedExpirationDateByLackOfUse).
  const token = row.accessToken === undefined || row.accessToken === null ? null : object(row.accessToken)
  const current = token ? apiKeyOrNull(token.apiKey) : null
  if (legacy && current && legacy !== current) throw new BillingProviderError('INVALID_RESPONSE', { reason: 'AMBIGUOUS_MATCH' })
  const key = current ?? legacy
  if (!key) return { id: row.id, walletId, credential: null }
  return {
    id: row.id,
    walletId,
    credential: {
      apiKey: new AsaasSecretValue(key),
      source: current ? 'accessToken.apiKey' : 'apiKey',
      accessTokenId: token && typeof token.id === 'string' && token.id ? token.id : null,
      expiresAt: token ? parseAsaasDate(token.expirationDate) : null,
      expiresByLackOfUseAt: token ? parseAsaasDate(token.projectedExpirationDateByLackOfUse) : null,
    },
  }
}
