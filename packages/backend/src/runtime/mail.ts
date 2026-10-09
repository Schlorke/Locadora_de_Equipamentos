import { Resend } from 'resend'
import type { PlatformMailEnvelope } from '../modules/communications/index'

// All SDK requests delegate here, including sends with an idempotency key.
class BoundedResend extends Resend {
  override fetchRequest<T>(path: string, options: RequestInit = {}) {
    const timeout = AbortSignal.timeout(15000)
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout
    return super.fetchRequest<T>(path, { ...options, signal })
  }
}

export function createResendClient(apiKey: string | undefined): Resend | null {
  return apiKey ? new BoundedResend(apiKey) : null
}

/** Platform emails use the existing bounded transport; no tenant SMTP/branding fallback. */
export function createPlatformMailer(apiKey: string) {
  const resend = createResendClient(apiKey)!
  return async (mail: PlatformMailEnvelope, idempotencyKey: string) => {
    const result = await resend.emails.send(mail, { idempotencyKey })
    if (result.error || !result.data?.id)
      throw new Error('PLATFORM_MAIL_DELIVERY_FAILED')
  }
}
