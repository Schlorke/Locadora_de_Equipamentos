import {
  AsaasHostedUrlSchema,
  InvoiceBillingTypeSchema,
} from '@gb-locacoes/contracts/subscription'
import { validarDiaCivil } from '@gb-locacoes/domain/assinatura'
import { fromAsaasAmount, type Money } from './asaas-amount'
import {
  asaasPath,
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
} from './asaas-http'
import { parseAsaasDate } from './asaas-events'
import type { PlatformInvoiceStatus } from '@prisma/client'

export type AsaasPlatformInvoice = {
  id: string
  providerStatus: string
  status: PlatformInvoiceStatus
  unknownStatus: boolean
  amount: Money
  dueDate: string
  subscription: string | null
  customer: string
  externalReference: string | null
  billingType: string | null
  invoiceUrl: string | null
  paidAt: Date | null
}

/** Separate from the legacy/customer payment mapping. No tenant credential lookup. */
export async function readAsaasPlatformInvoice(
  id: string,
  config: AsaasHttpClientConfig
): Promise<AsaasPlatformInvoice> {
  const raw = await createAsaasHttpClient(config).request({
    method: 'GET',
    path: asaasPath`/payments/${id}`,
  })
  return parseAsaasPlatformInvoice(id, raw)
}

/** Same minimal, validated facts for point reads and subscription reconciliation. */
export function parseAsaasPlatformInvoice(
  id: string,
  raw: unknown
): AsaasPlatformInvoice {
  const fail = (): never => {
    throw new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
    })
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const row = raw as Record<string, unknown>
  const text = (value: unknown) =>
    typeof value === 'string' && value.length > 0 && value.length <= 128
      ? value
      : null
  if (
    row.id !== id ||
    !text(row.customer) ||
    !text(row.status) ||
    !/^[A-Z_]+$/.test(String(row.status)) ||
    typeof row.deleted !== 'boolean' ||
    typeof row.dueDate !== 'string'
  )
    return fail()
  try {
    validarDiaCivil(row.dueDate)
  } catch {
    return fail()
  }
  const amount = fromAsaasAmount(row.value)
  if (amount.isNegative()) return fail()
  const providerStatus = row.status as string
  const paid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(
    providerStatus
  )
  const chargeback = [
    'CHARGEBACK_REQUESTED',
    'CHARGEBACK_DISPUTE',
    'AWAITING_CHARGEBACK_REVERSAL',
  ].includes(providerStatus)
  const refunded =
    providerStatus === 'REFUNDED' || providerStatus.startsWith('REFUND_')
  const known =
    paid ||
    chargeback ||
    refunded ||
    ['PENDING', 'OVERDUE', 'CANCELLED'].includes(providerStatus)
  const status = chargeback
    ? 'CHARGEBACK'
    : refunded
      ? 'REFUNDED'
      : paid
        ? 'PAID'
        : row.deleted || providerStatus === 'CANCELLED'
          ? 'CANCELED'
          : providerStatus === 'OVERDUE'
            ? 'OVERDUE'
            : 'PENDING'
  const date = row.clientPaymentDate || row.paymentDate || row.confirmedDate
  const paidAt = date ? parseAsaasDate(date) : null
  if (date && !paidAt) return fail()
  const url =
    row.invoiceUrl == null
      ? null
      : AsaasHostedUrlSchema.safeParse(row.invoiceUrl)
  const billing =
    row.billingType == null
      ? null
      : InvoiceBillingTypeSchema.safeParse(row.billingType)
  if ((url && !url.success) || (billing && !billing.success)) return fail()
  if (row.subscription != null && !text(row.subscription)) return fail()
  if (row.externalReference != null && !text(row.externalReference))
    return fail()
  return {
    id,
    providerStatus,
    status,
    unknownStatus: !known && !row.deleted,
    amount,
    dueDate: row.dueDate,
    customer: row.customer as string,
    subscription: text(row.subscription),
    externalReference: text(row.externalReference),
    invoiceUrl: url?.success ? url.data : null,
    billingType: billing?.success ? billing.data : null,
    paidAt,
  }
}
