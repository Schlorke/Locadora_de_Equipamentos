import { z } from 'zod'
import { escapeEmailHtml } from './tenant-branding'

export const platformMailEnvelopeSchema = z
  .object({
    from: z.string(),
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
    text: z.string(),
  })
  .strict()

export type PlatformMailEnvelope = z.infer<typeof platformMailEnvelopeSchema>

/** Rendering only: the owning module selects recipients and delivery eligibility. */
export function platformEmail(input: {
  platform: string
  organization: string
  heading: string
  message: string
  actionUrl: string
  actionLabel?: string
}) {
  const url = new URL(input.actionUrl)
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('INVALID_PLATFORM_MAIL_URL')
  const e = escapeEmailHtml
  return {
    subject: input.heading + ' — ' + input.platform,
    text: [
      input.organization,
      input.heading,
      input.message,
      url.href,
      input.platform,
    ].join('\n\n'),
    html: `<h1>${e(input.heading)}</h1><p>${e(input.organization)}</p><p>${e(input.message)}</p><p><a href="${e(url.href)}">${e(input.actionLabel ?? 'Acessar painel ou fatura')}</a></p><p>${e(input.platform)}</p>`,
  }
}
