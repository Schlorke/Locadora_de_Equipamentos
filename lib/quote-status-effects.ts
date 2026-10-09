import { createQuoteStatusEffects } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
import { loadTenantBranding } from '@/lib/email-branding'
import getResend from '@/lib/resend'
import { generateQuoteStatusChangeEmailHTML } from '@/lib/email-templates'
export const { runQuoteStatusEffects } = createQuoteStatusEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail: () => process.env.FROM_EMAIL,
  generateQuoteStatusChangeEmailHTML,
})
