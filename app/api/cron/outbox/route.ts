import { createScheduledOutbox } from '@gb-locacoes/backend/outbox'
import { purgeExpiredPlatformRateLimits } from '@gb-locacoes/backend/directory'
import { prisma } from '@/lib/prisma'
import { requireCronAuthorization } from '@/lib/security/external-request-auth'
import {
  issueTenantPayment,
  scheduleIssuanceReconciliation,
} from '@/lib/payment-issuance'
import { ensureQuoteBoletoPayment } from '@/lib/quote-boleto'
import { runQuoteStatusEffects } from '@/lib/quote-status-effects'
import { runQuoteCreatedEffects } from '@/lib/quote-created-effects'
import { runWebhookInboxEffect } from '@/lib/security/webhook-inbox'
import { runBoletoReissue } from '@/lib/payment-reissue'
import { processPayment } from '@/lib/payment-processor'
import { withTenantTransaction } from '@/lib/tenant'
import { runPaymentMailEffects } from '@/lib/payment-mail-effects'
import { runQuoteAdjustmentEffects } from '@/lib/quote-adjustment-effects'
import { convertPaidQuotePayment } from '@/lib/quote-payment-conversion'
import {
  runContractSignatureEffect,
  runContractSignedArchiveEffect,
} from '@/lib/contract-signature-effects'
export const runtime = 'nodejs'
export const maxDuration = 300
export async function GET(request: Request) {
  const denied = requireCronAuthorization(request)
  if (denied) return denied
  return Response.json(
    await createScheduledOutbox({
      getDatabase: () => prisma,
      purgeExpiredPlatformRateLimits,
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
    }).dispatchScheduledOutbox()
  )
}
