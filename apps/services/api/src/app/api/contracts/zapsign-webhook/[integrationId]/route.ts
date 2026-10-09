export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
import { NextRequest } from 'next/server'
import {
  authenticateTenantWebhook,
  type WebhookRoute,
} from '../../../../../host/webhook-authentication'
import { acceptTenantWebhook } from '../../../../../host/payment-webhooks'
import { consumeZapSignWebhook as consumeWebhook } from '../../../../../host/contracts'
export async function POST(request: NextRequest, route: WebhookRoute) {
  const authenticated = await authenticateTenantWebhook(
    request,
    'ZAPSIGN',
    route
  )
  if (!authenticated.ok) return authenticated.response
  return acceptTenantWebhook(authenticated, consumeWebhook)
}
