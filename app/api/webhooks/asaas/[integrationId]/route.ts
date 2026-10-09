import {
  authenticateTenantWebhook,
  type WebhookRoute,
} from '@/lib/security/tenant-webhook'
import { receiveAsaasWebhook } from '@/lib/security/asaas-webhook'

export async function POST(request: Request, route: WebhookRoute) {
  const authenticated = await authenticateTenantWebhook(request, 'ASAAS', route)
  if (!authenticated.ok) return authenticated.response
  return receiveAsaasWebhook(authenticated)
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
