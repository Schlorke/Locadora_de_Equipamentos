import {
  SubscriptionSummarySchema,
  PlatformInvoicesResponseSchema,
  type SubscriptionSummary,
  type PlatformInvoice,
} from '@gb-locacoes/contracts/subscription'
import type { HttpClient, HttpJsonResponse } from '../../../shared/api'

export type OwnerReadProblem = 'owner' | 'session' | 'selection' | 'unavailable'
export class OwnerReadError extends Error {
  constructor(public readonly problem: OwnerReadProblem) {
    super('Não foi possível consultar a assinatura.')
  }
}
function codeOf(data: unknown): unknown {
  return data && typeof data === 'object' && 'code' in data ? data.code : null
}
function check(response: HttpJsonResponse<unknown>) {
  if (response.ok) return
  if (response.status === 401) throw new OwnerReadError('session')
  if (response.status === 403) throw new OwnerReadError('owner')
  if (response.status === 409 && codeOf(response.data) === 'TENANT_REQUIRED')
    throw new OwnerReadError('selection')
  throw new OwnerReadError('unavailable')
}
async function summary(
  client: HttpClient
): Promise<SubscriptionSummary | null> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/admin/subscription',
    { responseType: 'json-response' }
  )
  if (
    response.status === 404 &&
    codeOf(response.data) === 'SUBSCRIPTION_NOT_FOUND'
  )
    return null
  check(response)
  const parsed = SubscriptionSummarySchema.safeParse(response.data)
  if (!parsed.success) throw new OwnerReadError('unavailable')
  return parsed.data
}
async function invoices(client: HttpClient): Promise<PlatformInvoice[]> {
  const response = await client.request<HttpJsonResponse<unknown>>(
    '/api/admin/subscription/invoices',
    { responseType: 'json-response' }
  )
  check(response)
  const parsed = PlatformInvoicesResponseSchema.safeParse(response.data)
  if (!parsed.success) throw new OwnerReadError('unavailable')
  return parsed.data.invoices
}

/** Sem cache global: o cliente é capturado pelo ciclo da locadora/identidade. */
export async function readOwnerAccount(
  client: HttpClient,
  includeInvoices: boolean
) {
  const [subscription, history] = await Promise.all([
    summary(client),
    includeInvoices ? invoices(client) : Promise.resolve(null),
  ])
  return { summary: subscription, invoices: history }
}
