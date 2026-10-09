import { createQuoteAdjustmentEffects } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
import { loadTenantBranding } from '@/lib/email-branding'
import getResend from '@/lib/resend'
import { generateQuoteStatusChangeEmailHTML } from '@/lib/email-templates'
export const { runQuoteAdjustmentEffects } = createQuoteAdjustmentEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail: () => process.env.FROM_EMAIL,
  generateQuoteStatusChangeEmailHTML,
})
