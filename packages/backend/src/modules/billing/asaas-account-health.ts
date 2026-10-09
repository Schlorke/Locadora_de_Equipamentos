import {
  BillingProviderError,
  createAsaasHttpClient,
  type AsaasHttpClientConfig,
} from './asaas-http'
import {
  parseAsaasAccountStatus,
  parseAsaasDate,
  type AsaasAccountStatus,
} from './asaas-events'

export type AsaasAccountHealth = {
  status: AsaasAccountStatus | null
  commercialInfoExpired: boolean | null
  commercialInfoExpiresAt: Date | null
}

/** Annual expiry is independent of general approval. Never retain commercial personal data. */
export async function readAsaasAccountHealth(
  config: AsaasHttpClientConfig & { subaccount: boolean }
): Promise<AsaasAccountHealth> {
  const http = createAsaasHttpClient(config)
  let commercialInfoExpired: boolean | null = null
  let commercialInfoExpiresAt: Date | null = null
  if (config.subaccount) {
    const body = await http.request({
      method: 'GET',
      path: '/myAccount/commercialInfo/',
    })
    const expiration = (body as { commercialInfoExpiration?: unknown } | null)
      ?.commercialInfoExpiration
    if (
      !expiration ||
      typeof expiration !== 'object' ||
      typeof (expiration as { isExpired?: unknown }).isExpired !== 'boolean'
    )
      throw new BillingProviderError('INVALID_RESPONSE', {
        reason: 'UNEXPECTED_SHAPE',
      })
    const value = expiration as { isExpired: boolean; scheduledDate?: unknown }
    commercialInfoExpired = value.isExpired
    commercialInfoExpiresAt = parseAsaasDate(value.scheduledDate)
    if (value.scheduledDate != null && !commercialInfoExpiresAt)
      throw new BillingProviderError('INVALID_RESPONSE', {
        reason: 'UNEXPECTED_SHAPE',
      })
  }
  // Only commercialInfo remains accessible when annual confirmation has expired.
  const status = commercialInfoExpired
    ? null
    : parseAsaasAccountStatus(
        await http.request({ method: 'GET', path: '/myAccount/status/' })
      )
  return { status, commercialInfoExpired, commercialInfoExpiresAt }
}
