import type { Resend } from 'resend'
import type { ScheduledTransaction } from '../../runtime/scheduled-job'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { EmailBranding } from './tenant-branding'
export type MailEffectPorts = {
  withTenantTransaction: ScheduledTransaction
  loadTenantBranding: (context: TenantContext) => Promise<EmailBranding>
  getResend: () => Pick<Resend, 'emails'> | null
  fromEmail: () => string | undefined
}
