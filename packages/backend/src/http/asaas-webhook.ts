import { parseAsaasEvent, isKnownAsaasEvent } from '../modules/billing/index'
import type { AuthenticatedTenantWebhook } from '../modules/identity/index'
import type { PlatformAsaasReceipt } from '../modules/platform-webhooks/index'

/** Classification is shared; hosts supply existing tenant/platform persistence ports. */
export function createAsaasWebhookReceiver({
  acceptTenant,
  acceptPlatform,
}: {
  acceptTenant: (
    event: AuthenticatedTenantWebhook,
    ignored: boolean
  ) => Promise<Response>
  acceptPlatform: (event: PlatformAsaasReceipt) => Promise<Response>
}) {
  return (event: AuthenticatedTenantWebhook): Promise<Response> => {
    const parsed = parseAsaasEvent(event.body)
    if (
      parsed.ok &&
      ['ACCOUNT_STATUS', 'ACCESS_TOKEN'].includes(parsed.event.category)
    )
      return acceptPlatform({ ...event, source: 'ASAAS_ACCOUNT' })
    const ignored =
      !parsed.ok ||
      parsed.event.category !== 'PAYMENT' ||
      !isKnownAsaasEvent(parsed.event.type)
    return acceptTenant(event, ignored)
  }
}
