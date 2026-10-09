import {
  createTenantBranding,
  createQuoteStatusEffects,
  createQuoteCreatedEffects,
  createQuoteAdjustmentEffects,
  createPaymentMailEffects,
} from '@gb-locacoes/backend/communications'
import { createResendClient } from '@gb-locacoes/backend/runtime'
import { withTenantTransaction } from './tenant-transaction'
const { loadTenantBranding } = createTenantBranding({ withTenantTransaction })
const ports = {
  withTenantTransaction,
  loadTenantBranding,
  getResend: () => createResendClient(process.env.RESEND_API_KEY),
  fromEmail: () => process.env.FROM_EMAIL,
}
export const { runQuoteStatusEffects } = createQuoteStatusEffects(ports)
export const { runQuoteCreatedEffects } = createQuoteCreatedEffects(ports)
export const { runQuoteAdjustmentEffects } = createQuoteAdjustmentEffects(ports)
export const { runPaymentMailEffects } = createPaymentMailEffects(ports)
