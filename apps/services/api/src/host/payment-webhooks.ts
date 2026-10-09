import {
  createPaymentProcessor,
  createPixWebhookConsumer,
  createBoletoWebhookConsumer,
  createTenantBoletoVerifier,
  createBoletoVerificationService,
} from '@gb-locacoes/backend/billing'
import { consumeZapSignWebhook } from './contracts'
import { consumeWhatsAppWebhook } from './whatsapp-write'
import { createWebhookInbox } from '@gb-locacoes/backend/outbox'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from './tenant-transaction'
import {
  resolveWebhookResource,
  resolveIntegrationCredential,
} from './webhook-authentication'
import { convertPaidQuotePayment } from './quotations'
const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
export const { processPayment } = createPaymentProcessor({
  withRentalTransaction,
})
export const { consumeWebhook: consumePixWebhook } = createPixWebhookConsumer({
  withTenantTransaction,
  processPayment,
  resolveWebhookResource,
})
export const { consumeWebhook: consumeBoletoWebhook } =
  createBoletoWebhookConsumer({
    withTenantTransaction,
    processPayment,
    resolveWebhookResource,
    convertPaidQuotePayment,
  })
export const {
  acceptTenantWebhook,
  acceptQueuedAsaasWebhook,
  runWebhookInboxEffect,
} = createWebhookInbox({
  withTenantTransaction,
  consumers: {
    ZAPSIGN: async () => ({ consumeWebhook: consumeZapSignWebhook }),
    PIX: async () => ({ consumeWebhook: consumePixWebhook }),
    ASAAS: async () => ({ consumeWebhook: consumeBoletoWebhook }),
    WHATSAPP: async () => ({ consumeWebhook: consumeWhatsAppWebhook }),
  },
})
export const { verifyTenantBoleto } = createTenantBoletoVerifier({
  withTenantTransaction,
  resolveIntegrationCredential,
})
export const { verifyBoletoPayment } = createBoletoVerificationService({
  withTenantTransaction,
  withRentalTransaction,
  verifyTenantBoleto,
  processPayment,
  convertPaidQuotePayment,
})
