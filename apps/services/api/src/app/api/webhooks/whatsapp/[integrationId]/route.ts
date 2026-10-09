import { NextResponse } from 'next/server'
import { secretsMatch } from '@gb-locacoes/backend/identity'
import { resolveWebhookIntegration } from '../../../../../host/webhook-authentication'
import { NextRequest } from 'next/server'
import {
  authenticateTenantWebhook,
  type WebhookRoute,
} from '../../../../../host/webhook-authentication'
import { acceptTenantWebhook } from '../../../../../host/payment-webhooks'
import { consumeWhatsAppWebhook as consumeWebhook } from '../../../../../host/whatsapp-write'
export async function POST(request: NextRequest, route: WebhookRoute) {
  const authenticated = await authenticateTenantWebhook(
    request,
    'WHATSAPP',
    route
  )
  if (!authenticated.ok) return authenticated.response
  return acceptTenantWebhook(authenticated, consumeWebhook)
}

export async function GET(request: NextRequest, route?: WebhookRoute) {
  if (!route)
    return NextResponse.json(
      { error: 'Integration-specific webhook URL required' },
      { status: 410 }
    )
  const resolved = await resolveWebhookIntegration('WHATSAPP', route)
  if (!resolved?.credential.verifyToken)
    return NextResponse.json(
      { error: 'Webhook authentication unavailable' },
      { status: 503 }
    )
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !challenge) {
    return NextResponse.json(
      { error: 'Missing hub.mode or hub.challenge' },
      { status: 400 }
    )
  }

  if (!secretsMatch(token, resolved.credential.verifyToken)) {
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 })
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
