import { createQuoteCreatedEffects } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
import { loadTenantBranding } from '@/lib/email-branding'
import getResend from '@/lib/resend'
import {
  generateQuoteEmailHTML,
  generateContactEmailHTML,
  generateCustomerQuoteConfirmationEmailHTML,
} from '@/lib/email-templates'
export const { runQuoteCreatedEffects } = createQuoteCreatedEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail: () => process.env.FROM_EMAIL,
  generateQuoteEmailHTML,
  generateContactEmailHTML,
  generateCustomerQuoteConfirmationEmailHTML,
})
