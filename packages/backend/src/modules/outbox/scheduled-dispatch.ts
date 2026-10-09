import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { purgeExpiredPlatformRateLimits as defaultPurge } from '../directory/index'
import { createPrismaOutboxRepository } from './adapters/prisma-outbox'
import { dispatchOutbox, PermanentDeliveryError } from './dispatch'
import type { ScheduledTransaction } from '../../runtime/scheduled-job'
import type { createPaymentIssuance } from '../billing/payment-issuance'
import type { createWebhookInbox } from '../outbox/webhook-inbox'
import type { createBoletoReissueWorker } from '../billing/boleto-reissue'
import type { createPaymentProcessor } from '../billing/payment-processor'
import type { createQuoteBoletos } from '../quotations/boleto'
import type { createQuoteStatusEffects } from '../communications/quote-status-effects'
import type { createQuoteCreatedEffects } from '../communications/quote-created-effects'
import type { createQuoteAdjustmentEffects } from '../communications/quote-adjustment-effects'
import type { createQuoteConversion } from '../rentals/conversion'
import type { createContractSignatureEffects } from '../documents/contract-signature-effects'
import type { createPaymentMailEffects } from '../communications/payment-mail-effects'
function idFrom(payload: unknown, field: string): string {
  if (!payload || typeof payload !== 'object' || !(field in payload))
    throw new PermanentDeliveryError('INVALID_PAYLOAD')
  const id = (payload as Record<string, unknown>)[field]
  if (typeof id !== 'string' || !id)
    throw new PermanentDeliveryError('INVALID_PAYLOAD')
  return id
}
export function createScheduledOutbox({
  getDatabase,
  purgeExpiredPlatformRateLimits = defaultPurge,
  scheduleIssuanceReconciliation,
  runWebhookInboxEffect,
  runBoletoReissue,
  withTenantTransaction,
  processPayment,
  issueTenantPayment,
  ensureQuoteBoletoPayment,
  runQuoteStatusEffects,
  runQuoteCreatedEffects,
  runQuoteAdjustmentEffects,
  convertPaidQuotePayment,
  runContractSignatureEffect,
  runContractSignedArchiveEffect,
  runPaymentMailEffects,
}: {
  getDatabase: () => PrismaClient
  purgeExpiredPlatformRateLimits?: typeof defaultPurge
  scheduleIssuanceReconciliation: ReturnType<
    typeof createPaymentIssuance
  >['scheduleIssuanceReconciliation']
  runWebhookInboxEffect: ReturnType<
    typeof createWebhookInbox
  >['runWebhookInboxEffect']
  runBoletoReissue: ReturnType<
    typeof createBoletoReissueWorker
  >['runBoletoReissue']
  withTenantTransaction: ScheduledTransaction
  processPayment: ReturnType<typeof createPaymentProcessor>['processPayment']
  issueTenantPayment: ReturnType<
    typeof createPaymentIssuance
  >['issueTenantPayment']
  ensureQuoteBoletoPayment: ReturnType<
    typeof createQuoteBoletos
  >['ensureQuoteBoletoPayment']
  runQuoteStatusEffects: ReturnType<
    typeof createQuoteStatusEffects
  >['runQuoteStatusEffects']
  runQuoteCreatedEffects: ReturnType<
    typeof createQuoteCreatedEffects
  >['runQuoteCreatedEffects']
  runQuoteAdjustmentEffects: ReturnType<
    typeof createQuoteAdjustmentEffects
  >['runQuoteAdjustmentEffects']
  convertPaidQuotePayment: ReturnType<
    typeof createQuoteConversion
  >['convertPaidQuotePayment']
  runContractSignatureEffect: ReturnType<
    typeof createContractSignatureEffects
  >['runContractSignatureEffect']
  runContractSignedArchiveEffect: ReturnType<
    typeof createContractSignatureEffects
  >['runContractSignedArchiveEffect']
  runPaymentMailEffects: ReturnType<
    typeof createPaymentMailEffects
  >['runPaymentMailEffects']
}) {
  async function dispatchScheduledOutbox() {
    const start = Date.now()
    // Janelas de rate limit vencidas (platform_rate_limits, global). Uma falha aqui não segura a outbox.
    const rateLimitsPurged = await purgeExpiredPlatformRateLimits(
      getDatabase(),
      start
    ).catch((error: unknown) => {
      console.error(
        '[cron/outbox] Falha ao limpar platform_rate_limits:',
        error
      )
      return null
    })
    const organizations = await getDatabase().organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    const result = { completed: 0, retried: 0, failed: 0, lostLease: 0 }
    let issuanceReconciliations = 0
    const offset = organizations.length
      ? Math.floor(start / 60000) % organizations.length
      : 0
    const ordered = organizations
      .slice(offset)
      .concat(organizations.slice(0, offset))
    for (const organization of ordered) {
      if (Date.now() - start > 120000) break
      const context = { tenantId: organization.id }
      // Emissões paradas além da janela (UNKNOWN, PROCESSING abandonada, QUEUED sem evento vivo, cobrança
      // aberta cujo pedido de emissão esgotou antes de criar a tentativa) ganham um `payment.issue` de
      // conciliação ou de religação (só banco). Uma falha aqui não segura a entrega.
      const reconciliation = await scheduleIssuanceReconciliation(
        context
      ).catch((error: unknown) => {
        console.error(
          '[cron/outbox] Falha ao agendar a conciliação das emissões incertas:',
          error
        )
        return null
      })
      issuanceReconciliations += reconciliation?.scheduled ?? 0
      const delivery = await dispatchOutbox({
        repository: createPrismaOutboxRepository(
          getDatabase(),
          organization.id
        ),
        workerId: randomUUID(),
        limit: 5,
        minRemainingMs: 60000,
        budgetMs: Math.max(0, 180000 - (Date.now() - start)),
        handlers: {
          'webhook.process': (event) =>
            runWebhookInboxEffect(context, event.id, event.payload),
          'payment.boleto.reissue': (event) =>
            runBoletoReissue(context, event.payload),
          'payment.provider.confirmed': async (event) => {
            const paymentId = idFrom(event.payload, 'paymentId')
            const externalId = idFrom(event.payload, 'externalId')
            const current = await withTenantTransaction(context, (tx) =>
              tx.payment.findFirst({
                where: {
                  id: paymentId,
                  tenantId: context.tenantId,
                  transactionId: externalId,
                },
              })
            )
            if (!current)
              throw new PermanentDeliveryError(
                'PAYMENT_RECONCILIATION_REQUIRED'
              )
            await processPayment(context, paymentId, {
              status: 'PAID',
              externalId,
            })
          },
          'payment.issue': (event) =>
            issueTenantPayment(context, idFrom(event.payload, 'paymentId')),
          'payment.boleto.issue': (event) =>
            issueTenantPayment(context, idFrom(event.payload, 'paymentId')),
          'quote.boleto.ensure': async (event) => {
            await ensureQuoteBoletoPayment(
              context,
              idFrom(event.payload, 'quoteId')
            )
          },
          'quote.status.notify': (event) =>
            runQuoteStatusEffects(context, event.id, event.payload),
          'quote.created.notify': (event) =>
            runQuoteCreatedEffects(context, event.id, event.payload),
          'quote.adjustment.notify': (event) =>
            runQuoteAdjustmentEffects(context, event.id, event.payload),
          'quote.payment.convert': async (event) => {
            await convertPaidQuotePayment(
              context,
              idFrom(event.payload, 'paymentId')
            )
          },
          'contract.signature.request': (event) =>
            runContractSignatureEffect(context, event.id, event.payload),
          'contract.signed.archive': (event) =>
            runContractSignedArchiveEffect(context, event.id, event.payload),
          'payment.boleto.notify': (event) =>
            runPaymentMailEffects(
              context,
              event.id,
              idFrom(event.payload, 'paymentId'),
              idFrom(event.payload, 'externalId')
            ),
        },
      })
      for (const key of [
        'completed',
        'retried',
        'failed',
        'lostLease',
      ] as const)
        result[key] += delivery[key]
    }
    return { ...result, rateLimitsPurged, issuanceReconciliations }
  }
  return { dispatchScheduledOutbox }
}
