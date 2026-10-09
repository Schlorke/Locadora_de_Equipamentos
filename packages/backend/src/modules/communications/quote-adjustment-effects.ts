import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { z } from 'zod'
import type { MailEffectPorts } from './mail-effect-ports'
import { generateQuoteStatusChangeEmailHTML as defaultgenerateQuoteStatusChangeEmailHTML } from './email-templates'

const Payload = z.object({
  quoteId: z.string().min(1),
  adjustedAt: z.string().datetime(),
  adjustmentId: z.string().optional(),
  sendEmail: z.boolean().default(true),
})

export function createQuoteAdjustmentEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail,
  generateQuoteStatusChangeEmailHTML = defaultgenerateQuoteStatusChangeEmailHTML,
}: MailEffectPorts & {
  generateQuoteStatusChangeEmailHTML?: typeof defaultgenerateQuoteStatusChangeEmailHTML
}) {
  async function runQuoteAdjustmentEffects(
    context: TenantContext,
    eventId: string,
    payload: unknown
  ): Promise<void> {
    const effect = Payload.parse(payload)
    const quote = await withTenantTransaction(context, async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: effect.quoteId, tenantId: context.tenantId },
        include: { organization: true },
      })
      if (
        !quote ||
        quote.organization?.status !== 'ACTIVE' ||
        quote.status === 'REJECTED' ||
        quote.priceAdjustedAt?.toISOString() !== effect.adjustedAt
      )
        return null
      if (!quote.priceAdjustmentReason || quote.finalTotal === null) return null
      if (quote.userId) {
        const id = `outbox_${eventId}_adjustment`
        await tx.notification.upsert({
          where: { id, tenantId: context.tenantId },
          update: {},
          create: {
            id,
            tenantId: context.tenantId,
            userId: quote.userId,
            type: 'QUOTE',
            priority: 'HIGH',
            title: 'Orçamento ajustado',
            message: quote.priceAdjustmentReason,
            actionUrl: `/area-cliente/historico/quote_${quote.id}`,
            metadata: { quoteId: quote.id, outboxEventId: eventId },
          },
        })
      }
      return quote
    })
    if (!quote || !effect.sendEmail) return
    const brand = await loadTenantBranding(context)
    const resend = getResend()
    const from = fromEmail()
    if (!resend || !from) throw new Error('Email delivery is not configured')
    const response = await resend.emails.send(
      {
        from: from,
        to: quote.email,
        subject: `Orçamento ajustado ${quote.quoteCode || quote.id} - ${brand.name}`,
        html: generateQuoteStatusChangeEmailHTML(
          brand,
          quote.name,
          quote.id,
          'ADJUSTED',
          Number(quote.originalTotal ?? quote.total),
          Number(quote.finalTotal),
          quote.priceAdjustmentReason,
          quote.lateFee === null ? null : Number(quote.lateFee),
          Boolean(quote.lateFeeApproved),
          null
        ),
      },
      { idempotencyKey: `quote-adjusted-${eventId}` }
    )
    if (response.error)
      throw new Error(`Adjustment email failed: ${response.error.name}`)
    if (effect.adjustmentId)
      await withTenantTransaction(context, (tx) =>
        tx.quoteAdjustment.updateMany({
          where: {
            id: effect.adjustmentId,
            quoteId: quote.id,
            tenantId: context.tenantId,
          },
          data: { sentEmailAt: new Date(), sentEmailTo: quote.email },
        })
      )
  }
  return { runQuoteAdjustmentEffects }
}
