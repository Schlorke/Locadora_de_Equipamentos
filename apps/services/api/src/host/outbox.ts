import { createScheduledOutbox } from '@gb-locacoes/backend/outbox'
import {
  createPaymentIssuance,
  createBoletoReissueWorker,
} from '@gb-locacoes/backend/billing'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { withTenantTransaction } from './tenant-transaction'
import { resolveIntegrationCredential } from './webhook-authentication'
import { processPayment, runWebhookInboxEffect } from './payment-webhooks'
import { ensureQuoteBoletoPayment } from './payments'
import { convertPaidQuotePayment } from './quotations'
import {
  runContractSignatureEffect,
  runContractSignedArchiveEffect,
} from './contracts'
import {
  runQuoteStatusEffects,
  runQuoteCreatedEffects,
  runQuoteAdjustmentEffects,
  runPaymentMailEffects,
} from './notification-effects'

const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
const { issueTenantPayment, scheduleIssuanceReconciliation } =
  createPaymentIssuance({
    withTenantTransaction,
    withRentalTransaction,
    resolveIntegrationCredential,
  })
const { runBoletoReissue } = createBoletoReissueWorker({
  withRentalTransaction,
  processPayment,
  resolveIntegrationCredential,
})
export const { dispatchScheduledOutbox } = createScheduledOutbox({
  getDatabase: () => getDatabaseRuntime().prisma,
  withTenantTransaction,
  scheduleIssuanceReconciliation,
  runWebhookInboxEffect,
  runBoletoReissue,
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
})
