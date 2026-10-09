import { createPaymentMailEffects } from '@gb-locacoes/backend/communications'
import { withTenantTransaction } from '@/lib/tenant'
import { loadTenantBranding } from '@/lib/email-branding'
import getResend from '@/lib/resend'
import { generateBoletoEmailHTML } from '@/lib/email-templates'
export const { runPaymentMailEffects } = createPaymentMailEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail: () => process.env.FROM_EMAIL,
  generateBoletoEmailHTML,
})
