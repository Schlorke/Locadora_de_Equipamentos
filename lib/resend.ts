import type { Resend } from 'resend'
import { createResendClient } from '@gb-locacoes/backend/runtime'

export function getResend(): Resend | null {
  return createResendClient(process.env.RESEND_API_KEY)
}
export default getResend
