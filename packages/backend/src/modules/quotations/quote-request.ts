import { Prisma } from '@prisma/client'
import { admitRentalCommand } from '../entitlements/command-admission'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  buildQuotePricing,
  calculateFreight,
} from '@gb-locacoes/domain/orcamento'
import {
  getAutoRentalDateRange,
  roundToCents,
} from '@gb-locacoes/domain/locacao'
import { enqueueOutbox } from '../outbox/index'
import {
  assertTenantCustomer,
  RentalMutationError,
  type RentalAvailability,
  type RentalTransaction,
} from '../rentals/index'
import { generateNextQuoteCode } from './quote-code'

/** Pedido de orçamento já validado pelo adaptador (contrato público de entrada). */
export type QuoteRequestInput = {
  customerName: string
  customerEmail: string
  customerPhone: string
  cpf?: string
  cnpj?: string
  cep?: string
  customerCompany?: string
  message?: string
  deliveryType?: 'DELIVERY' | 'PICKUP'
  deliveryAddress?: {
    cep: string
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    estado: string
  }
  items: Array<{
    equipmentId: string
    quantity: number
    days: number
    startDate?: string | Date
    endDate?: string | Date
    includeWeekends?: boolean
  }>
}

/**
 * Criação do orçamento na locadora explícita: preço e disponibilidade são
 * decididos na mesma transação e sob o lock de mutação de locação.
 */
export function createQuoteRequests({
  withRentalTransaction,
  assertRentalItemsAvailability,
}: {
  withRentalTransaction: RentalTransaction
  assertRentalItemsAvailability: RentalAvailability['assertRentalItemsAvailability']
}) {
  function createQuoteRequest(
    context: TenantContext,
    input: QuoteRequestInput,
    userId?: string
  ) {
    return withRentalTransaction(context, async (tx) => {
      if (userId) await assertTenantCustomer(tx, context, userId)
      await admitRentalCommand(tx, context, {})
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: context.tenantId },
      })
      if (input.deliveryType === 'DELIVERY' && !organization.postalCode)
        throw new RentalMutationError(
          'Locadora ainda não configurou CEP de origem para entrega',
          409,
          'DELIVERY_ORIGIN_NOT_CONFIGURED'
        )
      const requestDate = new Date()
      const items = []
      for (const item of input.items) {
        if (!Number.isInteger(item.days) || item.days <= 0)
          throw new RentalMutationError(
            'Dias de locação devem ser inteiros positivos'
          )
        const equipment = await tx.equipment.findFirst({
          where: { id: item.equipmentId, tenantId: context.tenantId },
        })
        if (!equipment)
          throw new RentalMutationError(
            'Equipamento não encontrado na locadora',
            404
          )
        const pricing = buildQuotePricing(equipment, item.days, item.quantity)
        const dates =
          item.startDate && item.endDate
            ? {
                startDate: new Date(item.startDate),
                endDate: new Date(item.endDate),
              }
            : getAutoRentalDateRange({
                requestDate,
                days: item.days,
                includeWeekends: item.includeWeekends ?? false,
              })
        items.push({
          tenantId: context.tenantId,
          equipmentId: equipment.id,
          quantity: item.quantity,
          days: item.days,
          pricePerDay: pricing.pricePerDay,
          total: pricing.total,
          ...dates,
          includeWeekends: item.includeWeekends ?? false,
          appliedDiscount: pricing.pricingConfig.useDirectValue
            ? null
            : pricing.pricingConfig.discount || null,
          appliedPeriod: pricing.appliedPeriod || null,
          useDirectValue: pricing.pricingConfig.useDirectValue || false,
          directValue: pricing.pricingConfig.useDirectValue
            ? pricing.pricingConfig.directValue || null
            : null,
        })
      }
      await assertRentalItemsAvailability(context, items, { db: tx })
      let deliveryFee: number | undefined
      if (input.deliveryType === 'DELIVERY') {
        if (!input.deliveryAddress?.cep)
          throw new RentalMutationError('CEP de entrega obrigatório')
        const freight = await calculateFreight({
          fromCEP: organization.postalCode!,
          toCEP: input.deliveryAddress.cep,
          equipmentIds: items.map((item) => item.equipmentId),
          quantities: items.map((item) => item.quantity),
        })
        deliveryFee = freight.shippingOptions[0]?.price
        if (deliveryFee === undefined)
          throw new RentalMutationError(
            'Não foi possível calcular o frete com os CEPs informados'
          )
      }
      // Total em centavos, somado em Decimal (nunca float): é o valor que o provedor cobra.
      const total = new Prisma.Decimal(
        roundToCents(
          items.reduce(
            (sum, item) => sum.plus(String(item.total)),
            new Prisma.Decimal(String(deliveryFee ?? 0))
          )
        )
      )
      const quoteCode = await generateNextQuoteCode(context, tx, requestDate)
      const validUntil = new Date(requestDate)
      validUntil.setDate(validUntil.getDate() + 7)
      const quote = await tx.quote.create({
        data: {
          tenantId: context.tenantId,
          quoteCode,
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone,
          cpf: input.cpf,
          cnpj: input.cnpj,
          cep: input.cep,
          company: input.customerCompany,
          message: input.message,
          total,
          originalTotal: total,
          status: 'PENDING',
          paymentTerms: 'UPFRONT',
          userId,
          startDate: new Date(
            Math.min(...items.map((item) => item.startDate.getTime()))
          ),
          endDate: new Date(
            Math.max(...items.map((item) => item.endDate.getTime()))
          ),
          validUntil,
          deliveryType: input.deliveryType,
          deliveryAddress: input.deliveryAddress,
          deliveryFee,
          items: { create: items },
        },
        include: {
          items: {
            include: {
              equipment: {
                select: { name: true, category: { select: { name: true } } },
              },
            },
          },
        },
      })
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'quote.created.notify',
        aggregateId: quote.id,
        payload: { quoteId: quote.id },
        dedupeKey: `quote-created:${quote.id}`,
      })
      return quote
    })
  }
  return { createQuoteRequest }
}

export type QuoteRequests = ReturnType<typeof createQuoteRequests>
