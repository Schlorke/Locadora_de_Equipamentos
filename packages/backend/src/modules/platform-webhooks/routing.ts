import type { Prisma } from '@prisma/client'
import { parseAsaasEvent } from '../billing/index'
import { isInboundIntegrationStatus } from '../identity/index'
import { ACCOUNT_WEBHOOK_TOPIC } from '../payment-accounts/index'
import {
  SUBSCRIPTION_INVOICE_TOPIC,
  SUBSCRIPTION_EVENT_TOPIC,
} from '../subscriptions/index'
import { resolveAsaasSubscription } from '../subscriptions/binding'
import type { PlatformAsaasReceipt } from './ingress'

export async function platformAsaasDestination(
  tx: Prisma.TransactionClient,
  input: PlatformAsaasReceipt,
  environment: string
) {
  const parsed = parseAsaasEvent(input.body)
  if (input.source === 'ASAAS_ACCOUNT') {
    const verified = input.integration
    if (!verified || verified.provider !== 'ASAAS')
      throw new Error('INVALID_ACCOUNT_WEBHOOK')
    const integration = await tx.tenantIntegration.findUnique({
      where: { id: verified.id },
    })
    if (
      !integration ||
      integration.tenantId !== verified.tenantId ||
      integration.provider !== 'ASAAS' ||
      !isInboundIntegrationStatus(integration.status)
    )
      throw new Error('INVALID_ACCOUNT_WEBHOOK')
    return { tenantId: integration.tenantId, routeKey: integration.id }
  }
  if (!parsed.ok) return null
  const event = parsed.event
  const sub = await resolveAsaasSubscription(
    tx,
    {
      providerId:
        event.category === 'PAYMENT'
          ? event.payment.subscription
          : event.category === 'SUBSCRIPTION'
            ? event.subscription.id
            : null,
      reference:
        event.category === 'PAYMENT'
          ? event.payment.externalReference
          : event.category === 'SUBSCRIPTION'
            ? event.subscription.externalReference
            : null,
    },
    environment
  )
  if (sub) return { tenantId: sub.tenantId, routeKey: null }
  if (event.account) {
    const account = await tx.paymentAccount.findUnique({
      where: { providerAccountId: event.account.id },
    })
    if (account?.environment === environment)
      return { tenantId: account.tenantId, routeKey: account.integrationId }
  }
  return null
}

export function platformAsaasTopic(input: PlatformAsaasReceipt) {
  const parsed = parseAsaasEvent(input.body)
  if (
    parsed.ok &&
    ['ACCOUNT_STATUS', 'ACCESS_TOKEN'].includes(parsed.event.category)
  )
    return ACCOUNT_WEBHOOK_TOPIC
  if (parsed.ok && input.source === 'ASAAS_ROOT') {
    if (parsed.event.category === 'PAYMENT') return SUBSCRIPTION_INVOICE_TOPIC
    if (parsed.event.category === 'SUBSCRIPTION')
      return SUBSCRIPTION_EVENT_TOPIC
  }
  return 'platform.webhook.process'
}
