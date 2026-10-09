import { fromAsaasAmount, type Money } from './asaas-amount'
import {
  asaasPath,
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
} from './asaas-http'
import {
  parseAsaasPlatformInvoice,
  readAsaasPlatformInvoice,
  type AsaasPlatformInvoice,
} from './asaas-platform-invoice'

export type AsaasPlatformSubscription = {
  id: string
  customer: string
  externalReference: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
  cycle: string
  amount: Money
}
export type AsaasSubscriptionSnapshot = {
  subscription: AsaasPlatformSubscription | null
  invoices: AsaasPlatformInvoice[]
}
const invalid = (): never => {
  throw new BillingProviderError('INVALID_RESPONSE', {
    reason: 'UNEXPECTED_SHAPE',
  })
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128
function parseSubscription(
  id: string,
  value: unknown
): AsaasPlatformSubscription {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  const row = value as Record<string, unknown>
  if (
    row.id !== id ||
    !text(row.customer) ||
    !text(row.cycle) ||
    !['ACTIVE', 'INACTIVE', 'EXPIRED'].includes(String(row.status)) ||
    row.deleted === true ||
    (row.externalReference != null && !text(row.externalReference))
  )
    return invalid()
  const amount = fromAsaasAmount(row.value)
  if (amount.isNegative()) return invalid()
  return {
    id,
    customer: row.customer,
    cycle: row.cycle,
    status: row.status as AsaasPlatformSubscription['status'],
    externalReference:
      row.externalReference == null ? null : (row.externalReference as string),
    amount,
  }
}

export async function readAsaasPlatformSubscription(
  id: string,
  config: AsaasHttpClientConfig
) {
  return parseSubscription(
    id,
    await createAsaasHttpClient(config).request({
      method: 'GET',
      path: asaasPath`/subscriptions/${id}`,
    })
  )
}

/** Paged standard payment endpoint; every returned item must belong to the requested subscription. */
export async function readAsaasSubscriptionSnapshot(
  target: {
    id: string | null
    reference: string
    knownPaymentIds: readonly string[]
  },
  config: AsaasHttpClientConfig
): Promise<AsaasSubscriptionSnapshot> {
  const client = createAsaasHttpClient(config)
  let id = target.id
  let subscription: AsaasPlatformSubscription
  if (!id) {
    const raw = await client.request({
      method: 'GET',
      path: '/subscriptions',
      query: { externalReference: target.reference, limit: 2 },
    })
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid()
    const list = raw as { data?: unknown; hasMore?: unknown }
    if (
      !Array.isArray(list.data) ||
      typeof list.hasMore !== 'boolean' ||
      list.hasMore ||
      list.data.length > 1
    )
      return invalid()
    if (list.data.length === 0) return { subscription: null, invoices: [] }
    const candidate = list.data[0] as Record<string, unknown> | null
    if (!candidate || !text(candidate.id)) return invalid()
    id = candidate.id
  }
  subscription = await readAsaasPlatformSubscription(id, config)
  const invoices: AsaasPlatformInvoice[] = [],
    seen = new Set<string>()
  let offset = 0
  for (let page = 0; page < 10; page++) {
    const raw = await client.request({
      method: 'GET',
      path: '/payments',
      query: { subscription: id, offset, limit: 100 },
    })
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid()
    const list = raw as { data?: unknown; hasMore?: unknown }
    if (
      !Array.isArray(list.data) ||
      typeof list.hasMore !== 'boolean' ||
      list.data.length > 100 ||
      (list.hasMore && list.data.length === 0)
    )
      return invalid()
    for (const row of list.data) {
      if (
        !row ||
        typeof row !== 'object' ||
        !text((row as Record<string, unknown>).id)
      )
        return invalid()
      const paymentId = (row as { id: string }).id
      if (seen.has(paymentId)) return invalid()
      const invoice = parseAsaasPlatformInvoice(paymentId, row)
      if (invoice.subscription !== id) return invalid()
      seen.add(paymentId)
      invoices.push(invoice)
    }
    if (!list.hasMore) {
      // Deleted invoices can disappear from listings: absence alone never cancels a charge.
      for (const paymentId of target.knownPaymentIds)
        if (!seen.has(paymentId)) {
          const invoice = await readAsaasPlatformInvoice(paymentId, config)
          if (invoice.subscription !== null && invoice.subscription !== id)
            return invalid()
          invoices.push(invoice)
          seen.add(paymentId)
        }
      return { subscription, invoices }
    }
    offset += list.data.length
  }
  return invalid()
}

/** Only changes recurrence status. Consumer confirms with GET and never deletes the subscription. */
export async function setAsaasPlatformSubscriptionInactive(
  id: string,
  config: AsaasHttpClientConfig
) {
  await createAsaasHttpClient(config).request({
    method: 'PUT',
    path: asaasPath`/subscriptions/${id}`,
    body: { status: 'INACTIVE' },
  })
}
export async function deleteAsaasPlatformInvoice(
  id: string,
  config: AsaasHttpClientConfig
) {
  const result = await createAsaasHttpClient(config).request({
    method: 'DELETE',
    path: asaasPath`/payments/${id}`,
  })
  const row = result as Record<string, unknown>
  if (row.id !== id || row.deleted !== true)
    throw new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
      maybeApplied: true,
    })
}
