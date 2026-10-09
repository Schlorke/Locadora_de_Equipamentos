import type { Resend } from 'resend'

/** Identity mail keeps the existing payload and error contract; the host supplies config. */
export function createIdentityMailSender(dependencies: {
  client(): Pick<Resend, 'emails'> | null
  from(): string | undefined
}) {
  return async (subject: string, email: string, url: string): Promise<void> => {
    const resend = dependencies.client()
    const from = dependencies.from()
    if (!resend || !from)
      throw new Error('Identity email delivery is unavailable')
    const result = await resend.emails.send({
      from,
      to: email,
      subject,
      text: `${subject}\n\n${url}`,
    })
    if (result.error) throw new Error('Identity email delivery failed')
  }
}
