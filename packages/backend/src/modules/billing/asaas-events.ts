import { fromAsaasAmount, type Money } from './asaas-amount'
import {
  asaasPath,
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasCredential,
  type AsaasEnvironment,
  type AsaasFetch,
  type AsaasHttpLogger,
} from './asaas-http'

// ---------------------------------------------------------------------------------------------
// Status de cobrança
// ---------------------------------------------------------------------------------------------

/** Status documentados de `payment.status`, mais os que a integração já tratava. */
export const ASAAS_PAYMENT_STATUSES = Object.freeze([
  'PENDING',
  'RECEIVED',
  'CONFIRMED',
  'OVERDUE',
  'REFUNDED',
  'RECEIVED_IN_CASH',
  'REFUND_REQUESTED',
  'REFUND_IN_PROGRESS',
  'REFUND_DENIED',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
  'DUNNING_REQUESTED',
  'DUNNING_RECEIVED',
  'AWAITING_RISK_ANALYSIS',
  'CANCELLED',
  'AUTHORIZED',
  'APPROVED_BY_RISK_ANALYSIS',
  'REPROVED_BY_RISK_ANALYSIS',
  'CREDIT_CARD_CAPTURE_REFUSED',
] as const)
export type AsaasPaymentStatus = (typeof ASAAS_PAYMENT_STATUSES)[number]
export type TenantPaymentStatus =
  'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'

export function isAsaasPaymentStatus(
  value: unknown
): value is AsaasPaymentStatus {
  return (
    typeof value === 'string' &&
    (ASAAS_PAYMENT_STATUSES as readonly string[]).includes(value)
  )
}

export function mapAsaasStatus(
  status: AsaasPaymentStatus
): TenantPaymentStatus {
  switch (status) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'paid'
    case 'OVERDUE':
      return 'overdue'
    case 'CANCELLED':
      return 'cancelled'
    case 'REFUNDED':
      return 'refunded'
    case 'REFUND_IN_PROGRESS':
    case 'REFUND_REQUESTED':
    case 'REFUND_DENIED':
      return 'paid'
    default:
      return 'pending'
  }
}

function safeAmount(value: unknown): Money | undefined {
  try {
    return fromAsaasAmount(value)
  } catch {
    return undefined
  }
}

/** Leitura legada do corpo do webhook de pagamento (consumidor de boleto). Nunca lança. */
export function parseAsaasWebhook(body: unknown): {
  transactionId?: string
  status?: TenantPaymentStatus
  paidAt?: Date
  amount?: Money
} {
  const event = (body as { event?: unknown } | null | undefined)?.event
  const payment = (
    body as { payment?: Record<string, unknown> } | null | undefined
  )?.payment

  if (
    !payment ||
    typeof payment !== 'object' ||
    typeof payment.id !== 'string' ||
    !payment.id
  ) {
    return {}
  }

  const mappedStatus =
    typeof payment.status === 'string' && payment.status
      ? mapAsaasStatus(payment.status as AsaasPaymentStatus)
      : undefined

  // `paymentDate`/`clientPaymentDate` só-dia são datas civis de São Paulo (nunca meia-noite UTC,
  // que cairia no dia anterior); forma que o Asaas não usa fica sem data.
  const rawDate = payment.clientPaymentDate || payment.paymentDate
  const paidAt = parseAsaasDate(rawDate) ?? undefined

  // Em alguns eventos de estorno sem payment.status, usar o tipo de evento
  const fallbackStatus =
    event === 'PAYMENT_REFUNDED'
      ? 'refunded'
      : event === 'PAYMENT_OVERDUE'
        ? 'overdue'
        : undefined

  const amount =
    payment.value === undefined ? undefined : safeAmount(payment.value)
  return {
    transactionId: payment.id,
    status: mappedStatus || fallbackStatus,
    paidAt,
    ...(amount ? { amount } : {}),
  }
}

/**
 * Lê uma cobrança só com a credencial explícita da integração da locadora (sem credencial global).
 * `amount` é o número da borda HTTP, validado com no máximo 2 casas; compare com `sameAmount`.
 */
export async function readAsaasPayment(
  paymentId: string,
  config: {
    apiKey: AsaasCredential
    environment: AsaasEnvironment
    fetch?: AsaasFetch
    timeoutMs?: number
    logger?: AsaasHttpLogger
    reconciliation?: boolean
  }
): Promise<{
  status: TenantPaymentStatus
  paidAt?: Date
  amount: number
  billingType?: 'PIX' | 'BOLETO'
}> {
  if (!paymentId || !['sandbox', 'production'].includes(config.environment))
    throw new BillingProviderError('UNAVAILABLE')
  const http = createAsaasHttpClient({
    credential: config.apiKey,
    environment: config.environment,
    ...(config.fetch ? { fetch: config.fetch } : {}),
    ...(config.timeoutMs ? { timeoutMs: config.timeoutMs } : {}),
    ...(config.logger ? { logger: config.logger } : {}),
  })
  const raw = await http.request({
    method: 'GET',
    path: asaasPath`/payments/${paymentId}`,
  })
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new BillingProviderError('INVALID_RESPONSE')
  const payment = raw as Record<string, unknown>
  if (
    payment.id !== paymentId ||
    typeof payment.status !== 'string' ||
    typeof payment.value !== 'number' ||
    safeAmount(payment.value)?.isNegative() !== false
  )
    throw new BillingProviderError('INVALID_RESPONSE')
  // Data do pagamento como data civil de São Paulo (`parseAsaasDate`); forma desconhecida é resposta inválida.
  const date = payment.clientPaymentDate || payment.paymentDate
  const paidAt = date ? parseAsaasDate(date) : null
  if (date && !paidAt) throw new BillingProviderError('INVALID_RESPONSE')
  let status = mapAsaasStatus(payment.status as AsaasPaymentStatus)
  if (config.reconciliation) {
    // A recovery read is evidence, not the legacy fallback for an unknown/risk status.
    if (
      ![
        'PENDING',
        'OVERDUE',
        'RECEIVED',
        'CONFIRMED',
        'RECEIVED_IN_CASH',
        'REFUNDED',
        'CANCELLED',
      ].includes(payment.status) ||
      !['PIX', 'BOLETO'].includes(String(payment.billingType)) ||
      (payment.deleted !== undefined && typeof payment.deleted !== 'boolean') ||
      (payment.subscription !== undefined && payment.subscription !== null) ||
      (status === 'paid' && !paidAt)
    )
      throw new BillingProviderError('INVALID_RESPONSE')
    if (payment.deleted === true) {
      if (status === 'paid' || status === 'refunded')
        throw new BillingProviderError('INVALID_RESPONSE')
      status = 'cancelled'
    }
  }
  return {
    status,
    amount: payment.value,
    ...(paidAt ? { paidAt } : {}),
    ...(config.reconciliation
      ? { billingType: payment.billingType as 'PIX' | 'BOLETO' }
      : {}),
  }
}

// ---------------------------------------------------------------------------------------------
// Datas do Asaas
// ---------------------------------------------------------------------------------------------

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
const ISO_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * Datas do Asaas: `YYYY-MM-DD`, `YYYY-MM-DD HH:mm:ss` (horário de Brasília, UTC-3) ou ISO com
 * fuso. Qualquer outra forma vira `null`.
 */
export function parseAsaasDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  let iso: string | null = null
  // VERIFICAR-SANDBOX: fuso das datas sem offset (assumido America/Sao_Paulo, UTC-3 sem horário de verão).
  if (DATE_ONLY.test(value)) iso = value + 'T00:00:00-03:00'
  else if (DATE_TIME.test(value)) iso = value.replace(' ', 'T') + '-03:00'
  else if (ISO_WITH_ZONE.test(value)) iso = value
  if (!iso) return null
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  // Recusa datas que o `Date` "corrige" (ex.: 2026-02-31).
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const local = new Date(date.getTime() - 3 * 3_600_000)
  if (
    !ISO_WITH_ZONE.test(value) &&
    (local.getUTCFullYear() !== year ||
      local.getUTCMonth() + 1 !== month ||
      local.getUTCDate() !== day)
  )
    return null
  return date
}

// ---------------------------------------------------------------------------------------------
// Situação da conta (subconta ou conta conectada)
// ---------------------------------------------------------------------------------------------

export const ASAAS_APPROVAL_STATUSES = Object.freeze([
  'APPROVED',
  'AWAITING_APPROVAL',
  'PENDING',
  'REJECTED',
] as const)
export type AsaasApprovalStatus = (typeof ASAAS_APPROVAL_STATUSES)[number]
/** `UNKNOWN` quando o Asaas devolve um valor fora do contrato conhecido. */
export type AsaasApprovalValue = AsaasApprovalStatus | 'UNKNOWN'
export type AsaasAccountStatusField =
  'commercialInfo' | 'bankAccountInfo' | 'documentation' | 'general'
export interface AsaasAccountStatus {
  readonly id: string | null
  readonly commercialInfo: AsaasApprovalValue | null
  readonly bankAccountInfo: AsaasApprovalValue | null
  readonly documentation: AsaasApprovalValue | null
  readonly general: AsaasApprovalValue | null
}

function approval(value: unknown): AsaasApprovalValue | null {
  if (value === undefined || value === null) return null
  return typeof value === 'string' &&
    (ASAAS_APPROVAL_STATUSES as readonly string[]).includes(value)
    ? (value as AsaasApprovalStatus)
    : 'UNKNOWN'
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function accountStatusOf(row: Record<string, unknown>): AsaasAccountStatus {
  return {
    id: text(row.id),
    commercialInfo: approval(row.commercialInfo),
    bankAccountInfo: approval(row.bankAccountInfo),
    documentation: approval(row.documentation),
    general: approval(row.general),
  }
}

/** Resposta de `GET /v3/myAccount/status`. */
export function parseAsaasAccountStatus(body: unknown): AsaasAccountStatus {
  const row = record(body)
  if (!row || row.general === undefined)
    throw new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
    })
  return accountStatusOf(row)
}

// ---------------------------------------------------------------------------------------------
// Eventos de webhook
// ---------------------------------------------------------------------------------------------

export const ASAAS_PAYMENT_EVENTS = Object.freeze([
  'PAYMENT_CREATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
  'PAYMENT_ANTICIPATED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUND_DENIED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  'PAYMENT_DUNNING_RECEIVED',
  'PAYMENT_DUNNING_REQUESTED',
  'PAYMENT_BANK_SLIP_VIEWED',
  'PAYMENT_CHECKOUT_VIEWED',
  'PAYMENT_SPLIT_CANCELLED',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
  'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
] as const)
export const ASAAS_SUBSCRIPTION_EVENTS = Object.freeze([
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED',
  'SUBSCRIPTION_SPLIT_DISABLED',
  'SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK',
  'SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED',
] as const)
export const ASAAS_ACCOUNT_STATUS_EVENTS = Object.freeze([
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING',
  'ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
  'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED',
  'ACCOUNT_STATUS_DOCUMENT_APPROVED',
  'ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_DOCUMENT_PENDING',
  'ACCOUNT_STATUS_DOCUMENT_REJECTED',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING',
  'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
] as const)
// VERIFICAR-SANDBOX: nomes e corpo dos eventos de chave de API.
export const ASAAS_ACCESS_TOKEN_EVENTS = Object.freeze([
  'ACCESS_TOKEN_CREATED',
  'ACCESS_TOKEN_DELETED',
  'ACCESS_TOKEN_DISABLED',
  'ACCESS_TOKEN_ENABLED',
  'ACCESS_TOKEN_EXPIRED',
  'ACCESS_TOKEN_EXPIRING_SOON',
] as const)

export type AsaasPaymentEventType = (typeof ASAAS_PAYMENT_EVENTS)[number]
export type AsaasSubscriptionEventType =
  (typeof ASAAS_SUBSCRIPTION_EVENTS)[number]
export type AsaasAccountStatusEventType =
  (typeof ASAAS_ACCOUNT_STATUS_EVENTS)[number]
export type AsaasAccessTokenEventType =
  (typeof ASAAS_ACCESS_TOKEN_EVENTS)[number]
export type AsaasEventCategory =
  'PAYMENT' | 'SUBSCRIPTION' | 'ACCOUNT_STATUS' | 'ACCESS_TOKEN' | 'OTHER'

/** A categoria vem do prefixo: um evento novo do Asaas cai na categoria certa sem mudar o parser. */
export function asaasEventCategory(type: string): AsaasEventCategory {
  if (type.startsWith('PAYMENT_')) return 'PAYMENT'
  if (type.startsWith('SUBSCRIPTION_')) return 'SUBSCRIPTION'
  if (type.startsWith('ACCOUNT_STATUS_')) return 'ACCOUNT_STATUS'
  if (type.startsWith('ACCESS_TOKEN_')) return 'ACCESS_TOKEN'
  return 'OTHER'
}

export function isKnownAsaasEvent(type: string): boolean {
  return (
    [
      ASAAS_PAYMENT_EVENTS,
      ASAAS_SUBSCRIPTION_EVENTS,
      ASAAS_ACCOUNT_STATUS_EVENTS,
      ASAAS_ACCESS_TOKEN_EVENTS,
    ] as readonly (readonly string[])[]
  ).some((list) => list.includes(type))
}

export interface AsaasPaymentResource {
  readonly id: string
  readonly status: string | null
  readonly value: Money | null
  readonly netValue: Money | null
  readonly billingType: string | null
  readonly customer: string | null
  readonly subscription: string | null
  readonly externalReference: string | null
  readonly dueDate: string | null
  readonly paymentDate: string | null
  readonly clientPaymentDate: string | null
  readonly invoiceUrl: string | null
  readonly deleted: boolean
}
export interface AsaasSubscriptionResource {
  readonly id: string
  readonly status: string | null
  readonly value: Money | null
  readonly cycle: string | null
  readonly billingType: string | null
  readonly customer: string | null
  readonly nextDueDate: string | null
  readonly externalReference: string | null
  readonly deleted: boolean
}
/** Nunca inclui a chave: um `apiKey` no corpo do evento é descartado. */
export interface AsaasAccessTokenResource {
  readonly id: string | null
  readonly name: string | null
  readonly enabled: boolean | null
  readonly expiresAt: Date | null
}
export interface AsaasAccountStatusChange {
  readonly field: AsaasAccountStatusField
  readonly status: AsaasApprovalStatus | 'EXPIRING_SOON' | 'EXPIRED'
}

interface AsaasEventEnvelope {
  /** Id do evento no Asaas (`evt_…`); `null` se ausente. */
  readonly id: string | null
  readonly dateCreated: string | null
  readonly createdAt: Date | null
  /** Conta de origem quando o evento chega à raiz em nome de uma subconta. VERIFICAR-SANDBOX. */
  readonly account: { readonly id: string } | null
}
export interface AsaasPaymentEvent extends AsaasEventEnvelope {
  readonly category: 'PAYMENT'
  readonly type: AsaasPaymentEventType | `PAYMENT_${string}`
  readonly payment: AsaasPaymentResource
}
export interface AsaasSubscriptionEvent extends AsaasEventEnvelope {
  readonly category: 'SUBSCRIPTION'
  readonly type: AsaasSubscriptionEventType | `SUBSCRIPTION_${string}`
  readonly subscription: AsaasSubscriptionResource
}
export interface AsaasAccountStatusEvent extends AsaasEventEnvelope {
  readonly category: 'ACCOUNT_STATUS'
  readonly type: AsaasAccountStatusEventType | `ACCOUNT_STATUS_${string}`
  /** Mudança deduzida do nome do evento; `null` para um evento desconhecido. */
  readonly change: AsaasAccountStatusChange | null
  /** Situação enviada no corpo, se houver (o consumidor relê `GET /v3/myAccount/status`). */
  readonly accountStatus: AsaasAccountStatus | null
}
export interface AsaasAccessTokenEvent extends AsaasEventEnvelope {
  readonly category: 'ACCESS_TOKEN'
  readonly type: AsaasAccessTokenEventType | `ACCESS_TOKEN_${string}`
  readonly accessToken: AsaasAccessTokenResource | null
}
export interface AsaasOtherEvent extends AsaasEventEnvelope {
  readonly category: 'OTHER'
  readonly type: string
}
export type AsaasWebhookEvent =
  | AsaasPaymentEvent
  | AsaasSubscriptionEvent
  | AsaasAccountStatusEvent
  | AsaasAccessTokenEvent
  | AsaasOtherEvent
export type AsaasEventRejection =
  | 'NOT_AN_OBJECT'
  | 'MISSING_EVENT_TYPE'
  | 'MISSING_RESOURCE'
  | 'INVALID_RESOURCE'
export type AsaasEventParseResult =
  | { readonly ok: true; readonly event: AsaasWebhookEvent }
  | { readonly ok: false; readonly reason: AsaasEventRejection }

const EVENT_TYPE = /^[A-Z][A-Z0-9_]{0,127}$/
const STATUS_FIELDS: ReadonlyArray<readonly [string, AsaasAccountStatusField]> =
  [
    ['ACCOUNT_STATUS_BANK_ACCOUNT_INFO_', 'bankAccountInfo'],
    ['ACCOUNT_STATUS_COMMERCIAL_INFO_', 'commercialInfo'],
    ['ACCOUNT_STATUS_DOCUMENT_', 'documentation'],
    ['ACCOUNT_STATUS_GENERAL_APPROVAL_', 'general'],
  ]

class InvalidResource extends Error {}

function optionalMoney(value: unknown): Money | null {
  if (value === undefined || value === null) return null
  try {
    return fromAsaasAmount(value)
  } catch {
    throw new InvalidResource()
  }
}

function paymentResource(value: unknown): AsaasPaymentResource | null {
  const row = record(value)
  if (!row || typeof row.id !== 'string' || !row.id) return null
  return {
    id: row.id,
    status: text(row.status),
    value: optionalMoney(row.value),
    netValue: optionalMoney(row.netValue),
    billingType: text(row.billingType),
    customer: text(row.customer),
    subscription: text(row.subscription),
    externalReference: text(row.externalReference),
    dueDate: text(row.dueDate),
    paymentDate: text(row.paymentDate),
    clientPaymentDate: text(row.clientPaymentDate),
    invoiceUrl: text(row.invoiceUrl),
    deleted: row.deleted === true,
  }
}

function subscriptionResource(
  value: unknown
): AsaasSubscriptionResource | null {
  const row = record(value)
  if (!row || typeof row.id !== 'string' || !row.id) return null
  return {
    id: row.id,
    status: text(row.status),
    value: optionalMoney(row.value),
    cycle: text(row.cycle),
    billingType: text(row.billingType),
    customer: text(row.customer),
    nextDueDate: text(row.nextDueDate),
    externalReference: text(row.externalReference),
    deleted: row.deleted === true,
  }
}

function accessTokenResource(value: unknown): AsaasAccessTokenResource | null {
  const row = record(value)
  if (!row) return null
  return {
    id: text(row.id),
    name: text(row.name),
    enabled: typeof row.enabled === 'boolean' ? row.enabled : null,
    expiresAt: parseAsaasDate(row.expirationDate),
  }
}

function statusChange(type: string): AsaasAccountStatusChange | null {
  for (const [prefix, field] of STATUS_FIELDS) {
    if (!type.startsWith(prefix)) continue
    const status = type.slice(prefix.length)
    if ((ASAAS_APPROVAL_STATUSES as readonly string[]).includes(status))
      return { field, status: status as AsaasApprovalStatus }
    if (
      field === 'commercialInfo' &&
      (status === 'EXPIRING_SOON' || status === 'EXPIRED')
    )
      return { field, status }
  }
  return null
}

/**
 * Lê o corpo de um webhook do Asaas já autenticado. Nunca lança: devolve o evento tipado ou o
 * motivo da recusa. Valores monetários vêm como Decimal.
 */
export function parseAsaasEvent(body: unknown): AsaasEventParseResult {
  const row = record(body)
  if (!row) return { ok: false, reason: 'NOT_AN_OBJECT' }
  const type = row.event
  if (typeof type !== 'string' || !EVENT_TYPE.test(type))
    return { ok: false, reason: 'MISSING_EVENT_TYPE' }
  const accountRow = record(row.account)
  const envelope: AsaasEventEnvelope = {
    id: text(row.id),
    dateCreated: text(row.dateCreated),
    createdAt: parseAsaasDate(row.dateCreated),
    account:
      accountRow && typeof accountRow.id === 'string' && accountRow.id
        ? { id: accountRow.id }
        : null,
  }
  try {
    switch (asaasEventCategory(type)) {
      case 'PAYMENT': {
        const payment = paymentResource(row.payment)
        if (!payment) return { ok: false, reason: 'MISSING_RESOURCE' }
        return {
          ok: true,
          event: {
            ...envelope,
            category: 'PAYMENT',
            type: type as AsaasPaymentEvent['type'],
            payment,
          },
        }
      }
      case 'SUBSCRIPTION': {
        const subscription = subscriptionResource(row.subscription)
        if (!subscription) return { ok: false, reason: 'MISSING_RESOURCE' }
        return {
          ok: true,
          event: {
            ...envelope,
            category: 'SUBSCRIPTION',
            type: type as AsaasSubscriptionEvent['type'],
            subscription,
          },
        }
      }
      case 'ACCOUNT_STATUS': {
        // VERIFICAR-SANDBOX: nome do objeto (`accountStatus`) no corpo dos eventos ACCOUNT_STATUS_*.
        const status = record(row.accountStatus)
        return {
          ok: true,
          event: {
            ...envelope,
            category: 'ACCOUNT_STATUS',
            type: type as AsaasAccountStatusEvent['type'],
            change: statusChange(type),
            accountStatus: status ? accountStatusOf(status) : null,
          },
        }
      }
      case 'ACCESS_TOKEN':
        return {
          ok: true,
          event: {
            ...envelope,
            category: 'ACCESS_TOKEN',
            type: type as AsaasAccessTokenEvent['type'],
            accessToken: accessTokenResource(row.accessToken),
          },
        }
      default:
        return { ok: true, event: { ...envelope, category: 'OTHER', type } }
    }
  } catch (error) {
    if (error instanceof InvalidResource)
      return { ok: false, reason: 'INVALID_RESOURCE' }
    throw error
  }
}
