import {
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
  type AsaasSecret,
} from './asaas-http'
import {
  ASAAS_PAYMENT_EVENTS,
  ASAAS_ACCOUNT_STATUS_EVENTS,
  ASAAS_ACCESS_TOKEN_EVENTS,
} from './asaas-events'

export const ACCOUNT_WEBHOOK_EVENTS: readonly string[] = Object.freeze([
  ...ASAAS_PAYMENT_EVENTS,
  ...ASAAS_ACCOUNT_STATUS_EVENTS,
  ...ASAAS_ACCESS_TOKEN_EVENTS,
])
export type AccountWebhook = {
  id: string
  name: string
  url: string
  enabled: boolean
  interrupted: boolean
  apiVersion: number
  sendType: string
  events: readonly string[]
}
type WebhookInput = {
  name: string
  url: string
  email: string
  token: AsaasSecret
}
const invalid = (): never => {
  throw new BillingProviderError('INVALID_RESPONSE', {
    reason: 'UNEXPECTED_SHAPE',
  })
}
function parse(value: unknown): AccountWebhook {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid()
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) ||
    typeof row.name !== 'string' ||
    typeof row.url !== 'string' ||
    typeof row.enabled !== 'boolean' ||
    typeof row.interrupted !== 'boolean' ||
    !Number.isSafeInteger(row.apiVersion) ||
    typeof row.sendType !== 'string' ||
    !Array.isArray(row.events) ||
    row.events.some((event) => typeof event !== 'string')
  )
    return invalid()
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled,
    interrupted: row.interrupted,
    apiVersion: row.apiVersion as number,
    sendType: row.sendType,
    events: [...new Set(row.events as string[])],
  }
}
/** Shared by standalone webhook configuration and atomic subaccount creation. Plaintext is for the immediate HTTP body only. */
export function asaasAccountWebhookBody(input: WebhookInput) {
  let url: URL
  try {
    url = new URL(input.url)
  } catch {
    throw new BillingProviderError('REJECTED', { reason: 'INVALID_REQUEST' })
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !input.name ||
    input.name.length > 160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
  )
    throw new BillingProviderError('REJECTED', { reason: 'INVALID_REQUEST' })
  return input.token.use((authToken) => {
    if (!/^[A-Za-z0-9_-]{32,255}$/.test(authToken))
      throw new BillingProviderError('REJECTED', {
        reason: 'INVALID_REQUEST',
      })
    return {
      name: input.name,
      url: input.url,
      authToken,
      enabled: true,
      interrupted: false,
      sendType: 'SEQUENTIALLY',
      events: [...ACCOUNT_WEBHOOK_EVENTS],
    }
  })
}
/** No authToken is retained from provider responses; list is bounded and must be complete. */
export function createAsaasAccountWebhooks(config: AsaasHttpClientConfig) {
  const http = createAsaasHttpClient(config)
  return {
    async list() {
      const value = await http.request({
        method: 'GET',
        path: '/webhooks',
        query: { offset: 0, limit: 100 },
      })
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return invalid()
      const page = value as {
        data?: unknown
        hasMore?: unknown
        totalCount?: unknown
      }
      if (
        page.hasMore !== false ||
        !Array.isArray(page.data) ||
        page.data.length > 100 ||
        (page.totalCount != null && page.totalCount !== page.data.length)
      )
        return invalid()
      const rows = page.data.map(parse)
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        return invalid()
      return rows
    },
    async create(input: WebhookInput) {
      return parse(
        await http.request({
          method: 'POST',
          path: '/webhooks',
          body: {
            ...asaasAccountWebhookBody(input),
            email: input.email,
            apiVersion: 3,
          },
        })
      )
    },
    async configure(id: string, input: WebhookInput) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
        throw new BillingProviderError('REJECTED', {
          reason: 'INVALID_REQUEST',
        })
      const result = parse(
        await http.request({
          method: 'PUT',
          path: '/webhooks/' + id,
          body: asaasAccountWebhookBody(input),
        })
      )
      if (result.id !== id) return invalid()
      return result
    },
  }
}
