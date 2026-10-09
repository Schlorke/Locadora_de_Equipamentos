import { NextRequest } from 'next/server'
import {
  authenticateTenantWebhook,
  type WebhookRoute,
} from '@/lib/security/tenant-webhook'
import { acceptTenantWebhook } from '@/lib/security/webhook-inbox'
import { consumeWebhook } from '@/lib/security/webhook-consumers/boleto'
export async function POST(request: NextRequest, route: WebhookRoute) {
  const authenticated = await authenticateTenantWebhook(request, 'ASAAS', route)
  if (!authenticated.ok) return authenticated.response
  return acceptTenantWebhook(authenticated, consumeWebhook)
}
