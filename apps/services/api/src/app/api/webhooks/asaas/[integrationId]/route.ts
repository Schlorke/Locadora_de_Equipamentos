import {
  authenticateTenantWebhook,
  type WebhookRoute,
} from '../../../../../host/webhook-authentication'
import { receiveAsaasWebhook } from '../../../../../host/asaas-webhook'

export async function POST(request: Request, route: WebhookRoute) {
  const authenticated = await authenticateTenantWebhook(request, 'ASAAS', route)
  if (!authenticated.ok) return authenticated.response
  return receiveAsaasWebhook(authenticated)
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
