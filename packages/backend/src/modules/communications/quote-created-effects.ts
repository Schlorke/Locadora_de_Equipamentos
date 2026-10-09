import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { z } from 'zod'
import type { MailEffectPorts } from './mail-effect-ports'
import {
  generateQuoteEmailHTML as defaultgenerateQuoteEmailHTML,
  generateContactEmailHTML as defaultgenerateContactEmailHTML,
  generateCustomerQuoteConfirmationEmailHTML as defaultgenerateCustomerQuoteConfirmationEmailHTML,
} from './email-templates'

const Payload = z.object({
  quoteId: z.string().min(1),
  kind: z.enum(['quote', 'contact']).optional(),
})

export function createQuoteCreatedEffects({
  withTenantTransaction,
  loadTenantBranding,
  getResend,
  fromEmail,
  generateQuoteEmailHTML = defaultgenerateQuoteEmailHTML,
  generateContactEmailHTML = defaultgenerateContactEmailHTML,
  generateCustomerQuoteConfirmationEmailHTML = defaultgenerateCustomerQuoteConfirmationEmailHTML,
}: MailEffectPorts & {
  generateQuoteEmailHTML?: typeof defaultgenerateQuoteEmailHTML
  generateContactEmailHTML?: typeof defaultgenerateContactEmailHTML
  generateCustomerQuoteConfirmationEmailHTML?: typeof defaultgenerateCustomerQuoteConfirmationEmailHTML
}) {
  async function runQuoteCreatedEffects(
    context: TenantContext,
    eventId: string,
    payload: unknown
  ): Promise<void> {
    const { quoteId, kind } = Payload.parse(payload)
    const state = await withTenantTransaction(context, async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, tenantId: context.tenantId },
        include: {
          organization: true,
          items: { include: { equipment: { include: { category: true } } } },
        },
      })
      if (
        !quote ||
        quote.status !== 'PENDING' ||
        quote.organization?.status !== 'ACTIVE'
      )
        return null
      const members = await tx.membership.findMany({
        where: {
          tenantId: context.tenantId,
          role: { in: ['ADMIN', 'OPERATOR'] },
          status: 'ACTIVE',
        },
        select: { userId: true, user: { select: { email: true } } },
      })
      for (const member of members) {
        const id = `outbox_${eventId}_${member.userId}`
        await tx.notification.upsert({
          where: { id, tenantId: context.tenantId },
          update: {},
          create: {
            id,
            tenantId: context.tenantId,
            userId: member.userId,
            type: 'QUOTE',
            priority: 'HIGH',
            title: 'Novo orçamento',
            message: `${quote.name} solicitou um orçamento.`,
            actionUrl: '/admin/orcamentos',
            metadata: { quoteId, outboxEventId: eventId },
          },
        })
      }
      return { quote, members }
    })
    if (!state) return
    const brand = await loadTenantBranding(context)
    const resend = getResend()
    const from = fromEmail()
    if (!resend || !from) throw new Error('Email delivery is not configured')
    const { quote, members } = state
    const organizationName = quote.organization!.name
    const equipment = quote.items.map((item) => ({
      name: item.equipment.name,
      category: item.equipment.category.name,
      quantity: item.quantity,
      days: item.days,
      pricePerDay: Number(item.pricePerDay),
      total: Number(item.total),
      image: item.equipment.images[0] ?? null,
      appliedPeriod: item.appliedPeriod ?? undefined,
      appliedDiscount: item.appliedDiscount
        ? Number(item.appliedDiscount)
        : undefined,
      useDirectValue: item.useDirectValue,
      directValue: item.directValue ? Number(item.directValue) : undefined,
      startDate: item.startDate ?? undefined,
      endDate: item.endDate ?? undefined,
      includeWeekends: item.includeWeekends,
    }))
    for (const member of members) {
      const response = await resend.emails.send(
        {
          from: from,
          to: member.user.email,
          subject: `Novo Orçamento ${quote.quoteCode ?? quote.id} - ${organizationName}`,
          html:
            kind === 'contact'
              ? generateContactEmailHTML(
                  brand,
                  {
                    name: quote.name,
                    email: quote.email,
                    phone: quote.phone,
                    message: quote.message || '',
                    cpf: quote.cpf || undefined,
                    cnpj: quote.cnpj || undefined,
                    cep: quote.cep || undefined,
                    company: quote.company || undefined,
                  },
                  quote.id
                )
              : generateQuoteEmailHTML(
                  brand,
                  {
                    customerName: quote.name,
                    customerEmail: quote.email,
                    customerPhone: quote.phone,
                    cpf: quote.cpf,
                    cnpj: quote.cnpj,
                    cep: quote.cep,
                    customerCompany: quote.company,
                    message: quote.message,
                  },
                  equipment,
                  Number(quote.total),
                  quote.id
                ),
        },
        { idempotencyKey: `quote-created-${eventId}-${member.userId}` }
      )
      if (response.error)
        throw new Error(`Quote admin email failed: ${response.error.name}`)
    }
    if (kind === 'contact') return
    const response = await resend.emails.send(
      {
        from: from,
        to: quote.email,
        subject: `Orçamento Recebido - ${organizationName}`,
        html: generateCustomerQuoteConfirmationEmailHTML(
          brand,
          { customerName: quote.name, quoteId: quote.id },
          equipment,
          Number(quote.total),
          quote.deliveryType,
          quote.deliveryAddress as Record<string, string> | null,
          quote.deliveryFee == null ? null : Number(quote.deliveryFee),
          quote.pickupFee == null ? null : Number(quote.pickupFee),
          quote.message,
          quote.validUntil
        ),
      },
      { idempotencyKey: `quote-created-${eventId}-customer` }
    )
    if (response.error)
      throw new Error(`Quote customer email failed: ${response.error.name}`)
  }
  return { runQuoteCreatedEffects }
}
