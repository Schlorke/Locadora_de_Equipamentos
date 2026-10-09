import { normalizarDocumento } from '@gb-locacoes/domain/documento'
import {
  asaasPath,
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
} from './asaas-http'
import { readAsaasPlatformSubscription } from './asaas-platform-subscription'
import { toAsaasAmount, type Money } from './asaas-amount'

export type PlatformCustomer = {
  id: string
  cpfCnpj: string
  externalReference: string
  notificationDisabled: true
}
export type PlatformCustomerInput = {
  name: string
  cpfCnpj: string
  email: string
  externalReference: string
  notificationDisabled: true
}
export type PlatformRecurringInput = {
  customer: string
  amount: Money
  nextDueDate: string
  externalReference: string
  description: string
}
const invalid = (): never => {
  throw new BillingProviderError('INVALID_RESPONSE', {
    reason: 'UNEXPECTED_SHAPE',
  })
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid()
const customer = (value: unknown): PlatformCustomer => {
  const row = object(value)
  if (
    !text(row.id) ||
    !text(row.cpfCnpj) ||
    !text(row.externalReference) ||
    row.deleted === true ||
    row.notificationDisabled !== true
  )
    return invalid()
  return {
    id: row.id,
    cpfCnpj: normalizarDocumento(row.cpfCnpj),
    externalReference: row.externalReference,
    notificationDisabled: true,
  }
}
const unique = (value: unknown) => {
  const row = object(value)
  if (!Array.isArray(row.data) || typeof row.hasMore !== 'boolean')
    return invalid()
  if (row.hasMore || row.data.length > 1)
    throw new BillingProviderError('REJECTED', { reason: 'AMBIGUOUS_MATCH' })
  return row.data.length ? object(row.data[0]) : null
}

/** Injected root configuration; protected transport and a 60-second timeout on each creation. */
export function createAsaasPlatformIssuance(config: AsaasHttpClientConfig) {
  const client = createAsaasHttpClient(config)
  return {
    async findCustomer(
      input: Pick<PlatformCustomerInput, 'cpfCnpj' | 'externalReference'>
    ) {
      let row = unique(
        await client.request({
          method: 'GET',
          path: '/customers',
          query: {
            cpfCnpj: input.cpfCnpj,
            externalReference: input.externalReference,
            limit: 2,
          },
        })
      )
      if (!row)
        row = unique(
          await client.request({
            method: 'GET',
            path: '/customers',
            query: { externalReference: input.externalReference, limit: 2 },
          })
        )
      // A previously linked organization with changed document is a conflict, not another customer.
      if (!row) return null
      if (!text(row.id)) return invalid()
      return customer(
        await client.request({
          method: 'GET',
          path: asaasPath`/customers/${row.id}`,
        })
      )
    },
    async createCustomer(input: PlatformCustomerInput) {
      return customer(
        await client.request({
          method: 'POST',
          path: '/customers',
          body: input,
          timeoutMs: 60_000,
        })
      )
    },
    async findSubscription(reference: string) {
      const row = unique(
        await client.request({
          method: 'GET',
          path: '/subscriptions',
          query: { externalReference: reference, limit: 2 },
        })
      )
      if (!row) return null
      if (!text(row.id)) return invalid()
      return readAsaasPlatformSubscription(row.id, config)
    },
    async createSubscription(input: PlatformRecurringInput) {
      const row = object(
        await client.request({
          method: 'POST',
          path: '/subscriptions',
          timeoutMs: 60_000,
          body: {
            customer: input.customer,
            billingType: 'UNDEFINED',
            value: toAsaasAmount(input.amount),
            nextDueDate: input.nextDueDate,
            cycle: 'MONTHLY',
            externalReference: input.externalReference,
            description: input.description.slice(0, 500),
            fine: { value: 0 },
            interest: { value: 0 },
          },
        })
      )
      if (!text(row.id)) return invalid()
      try {
        return await readAsaasPlatformSubscription(row.id, config)
      } catch (error) {
        // POST succeeded; even a definitive GET failure cannot make another POST safe.
        throw new BillingProviderError('AMBIGUOUS', {
          reason:
            error instanceof BillingProviderError
              ? (error.reason ?? 'PROVIDER_ERROR')
              : 'NETWORK',
          maybeApplied: true,
        })
      }
    },
  }
}
