import type { MailEffectPorts } from './mail-effect-ports'
import { PermanentDeliveryError } from '../outbox/index'
import { generateBoletoEmailHTML as defaultgenerateBoletoEmailHTML } from './email-templates'

export function createPaymentMailEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail,
  generateBoletoEmailHTML = defaultgenerateBoletoEmailHTML,
}: MailEffectPorts & {
  generateBoletoEmailHTML?: typeof defaultgenerateBoletoEmailHTML
}) {
  async function runPaymentMailEffects(
    context: { tenantId: string },
    eventId: string,
    paymentId: string,
    externalId: string
  ) {
    const payment = await withTenantTransaction(context, (tx) =>
      tx.payment.findFirst({
        where: {
          id: paymentId,
          tenantId: context.tenantId,
          transactionId: externalId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        include: {
          quote: true,
          rental: { include: { quote: true } },
          attempts: {
            where: {
              tenantId: context.tenantId,
              externalId,
              cancellationStatus: 'NONE',
              status: { in: ['ISSUED', 'OVERDUE'] },
            },
          },
        },
      })
    )
    // An event for a replaced, cancelled or paid charge must never send its old payment link.
    if (!payment || payment.attempts.length !== 1) return
    const quote = payment.quote ?? payment.rental?.quote
    if (!quote) throw new PermanentDeliveryError('PAYMENT_QUOTE_MISSING')
    const brand = await loadTenantBranding(context)
    const resend = getResend()
    const from = fromEmail()
    if (!resend || !from) throw new Error('MAIL_TRANSPORT_UNAVAILABLE')
    const metadata =
      payment.metadata &&
      typeof payment.metadata === 'object' &&
      !Array.isArray(payment.metadata)
        ? payment.metadata
        : {}
    const result = await resend.emails.send(
      {
        from: from,
        to: quote.email,
        subject: 'Boleto disponível — ' + brand.name,
        html: generateBoletoEmailHTML(brand, {
          customerName: quote.name,
          quoteId: quote.id,
          amount: payment.amount.toNumber(),
          dueDate: payment.dueDate,
          digitableLine:
            typeof metadata.digitableLine === 'string'
              ? metadata.digitableLine
              : null,
          barcode:
            typeof metadata.barcode === 'string' ? metadata.barcode : null,
          pdfUrl: typeof metadata.pdfUrl === 'string' ? metadata.pdfUrl : null,
        }),
      },
      { idempotencyKey: 'payment-mail-' + eventId }
    )
    if (result.error) throw new Error('MAIL_DELIVERY_FAILED')
    await withTenantTransaction(context, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':issue:' + paymentId}, 0))`
      const current = await tx.payment.findFirst({
        where: {
          id: paymentId,
          tenantId: context.tenantId,
          transactionId: externalId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
      })
      if (!current) return
      const fresh =
        current.metadata &&
        typeof current.metadata === 'object' &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {}
      await tx.payment.updateMany({
        where: {
          id: paymentId,
          tenantId: context.tenantId,
          transactionId: externalId,
        },
        data: {
          metadata: {
            ...fresh,
            boletoSentAt: new Date().toISOString(),
            boletoSentEmail: quote.email,
          },
        },
      })
      if (quote.userId)
        await tx.notification.upsert({
          where: { id: 'payment_mail_' + eventId },
          create: {
            id: 'payment_mail_' + eventId,
            tenantId: context.tenantId,
            userId: quote.userId,
            type: 'PAYMENT',
            title: 'Boleto disponível',
            message: 'O boleto do seu orçamento está disponível.',
            actionUrl: '/area-cliente',
          },
          update: {},
        })
    })
  }
  return { runPaymentMailEffects }
}
