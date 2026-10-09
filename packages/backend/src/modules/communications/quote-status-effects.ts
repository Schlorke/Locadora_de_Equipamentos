import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { z } from 'zod'
import type { MailEffectPorts } from './mail-effect-ports'
import { generateQuoteStatusChangeEmailHTML as defaultgenerateQuoteStatusChangeEmailHTML } from './email-templates'

const EffectSchema = z.object({
  quoteId: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED', 'COMPLETED']),
})

/** Replays one committed status effect; delivery keys stay stable across attempts. */

export function createQuoteStatusEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail,
  generateQuoteStatusChangeEmailHTML = defaultgenerateQuoteStatusChangeEmailHTML,
}: MailEffectPorts & {
  generateQuoteStatusChangeEmailHTML?: typeof defaultgenerateQuoteStatusChangeEmailHTML
}) {
  async function runQuoteStatusEffects(
    context: TenantContext,
    eventId: string,
    payload: unknown
  ): Promise<void> {
    const effect = EffectSchema.parse(payload)
    const quote = await withTenantTransaction(context, async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: effect.quoteId, tenantId: context.tenantId },
        include: {
          organization: true,
          items: { include: { equipment: { include: { category: true } } } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      })
      if (
        !quote ||
        quote.status !== effect.status ||
        quote.organization?.status !== 'ACTIVE'
      )
        return
      const latest = await tx.outboxEvent.findFirst({
        where: {
          tenantId: context.tenantId,
          aggregateId: quote.id,
          topic: 'quote.status.notify',
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      })
      if (latest && latest.id !== eventId) return

      const equipmentName = quote.items[0]?.equipment.name ?? 'Equipamento(s)'
      const approved = effect.status === 'APPROVED'
      const rejected = effect.status === 'REJECTED'
      if (quote.userId) {
        const baseMessage = rejected
          ? `Seu orçamento para ${equipmentName} foi rejeitado.`
          : approved
            ? `Seu orçamento para ${equipmentName} foi aprovado e aguarda pagamento.`
            : `Seu orçamento para ${equipmentName} foi convertido em locação e aguarda retirada.`
        const message =
          rejected && quote.rejectionReason
            ? `${baseMessage}\nMotivo: ${quote.rejectionReason}`
            : baseMessage
        const id = `outbox_${eventId}_quote`
        await tx.notification.upsert({
          where: { id, tenantId: context.tenantId },
          update: {},
          create: {
            tenantId: context.tenantId,
            id,
            userId: quote.userId,
            type: 'QUOTE',
            title: rejected
              ? 'Orçamento Rejeitado'
              : approved
                ? 'Orçamento Aprovado!'
                : 'Locação Reservada',
            message,
            priority: rejected ? 'MEDIUM' : 'HIGH',
            actionUrl: `/area-cliente/historico/quote_${quote.id}`,
            metadata: { quoteId: quote.id, outboxEventId: eventId },
          },
        })
      }
      return quote
    })
    if (!quote) return
    const approved = effect.status === 'APPROVED'
    const rejected = effect.status === 'REJECTED'
    const brand = await loadTenantBranding(context)
    const resend = getResend()
    const from = fromEmail()
    if (!resend || !from) throw new Error('Email delivery is not configured')
    const payment = quote.payments.find(
      (item) =>
        item.method === 'BOLETO' &&
        !['CANCELLED', 'REFUNDED'].includes(item.status)
    )
    const metadata =
      payment?.metadata &&
      typeof payment.metadata === 'object' &&
      !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {}
    const boleto =
      approved && payment
        ? {
            amount: Number(payment.amount),
            dueDate: payment.dueDate,
            digitableLine:
              typeof metadata.digitableLine === 'string'
                ? metadata.digitableLine
                : null,
            pdfUrl:
              typeof metadata.pdfUrl === 'string' ? metadata.pdfUrl : null,
          }
        : null
    const items = rejected
      ? quote.items.map((item) => ({
          name: item.equipment.name,
          category: item.equipment.category.name,
          quantity: item.quantity,
          days: item.days,
          pricePerDay: Number(item.pricePerDay),
          total: Number(item.total),
          image: item.equipment.images[0] ?? null,
          appliedPeriod: item.appliedPeriod ?? null,
          appliedDiscount: item.appliedDiscount
            ? Number(item.appliedDiscount)
            : undefined,
          useDirectValue: item.useDirectValue,
          directValue: item.directValue ? Number(item.directValue) : undefined,
          startDate: item.startDate ?? undefined,
          endDate: item.endDate ?? undefined,
          includeWeekends: item.includeWeekends,
        }))
      : undefined
    const subject = approved
      ? '✅ Orcamento Aprovado - Pagamento Pendente'
      : rejected
        ? '❌ Orcamento Rejeitado'
        : '🎉 Orcamento Convertido'
    const response = await resend.emails.send(
      {
        from: from,
        to: quote.email,
        subject: `${subject} - ${quote.organization!.name}`,
        html: generateQuoteStatusChangeEmailHTML(
          brand,
          quote.name,
          quote.id,
          effect.status,
          Number(quote.originalTotal ?? quote.total),
          quote.finalTotal ? Number(quote.finalTotal) : null,
          quote.priceAdjustmentReason,
          quote.lateFee ? Number(quote.lateFee) : null,
          quote.lateFeeApproved ?? false,
          quote.rejectionReason,
          items,
          boleto
        ),
      },
      { idempotencyKey: `quote-status-${eventId}` }
    )
    if (response.error)
      throw new Error(`Status email delivery failed: ${response.error.name}`)
  }
  return { runQuoteStatusEffects }
}
