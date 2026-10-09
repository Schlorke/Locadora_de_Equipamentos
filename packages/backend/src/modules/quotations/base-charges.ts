import { Prisma, type OperationType, type Payment } from '@prisma/client'
import {
  calculateTaxBreakdown,
  resolveTaxDocumentType,
} from '@gb-locacoes/domain/financeiro'
import { planQuoteBaseCharges } from '@gb-locacoes/domain/orcamento'
import { RentalMutationError } from '../rentals/index'
import { getCurrentTaxSettings } from './taxes'

/** Cobranças da obrigação do orçamento (as demais — multa, dano — são obrigações próprias). */
const BASE_CHARGE_TYPES = ['RENTAL', 'DEPOSIT'] as const

export const PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION =
  'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION'

/** Onde estão as cobranças base do orçamento, como o consumidor do boleto as procura. */
export type BaseChargeOwner = {
  quoteId: string
  /** Orçamento convertido: as cobranças passaram à locação (e a locação é dona delas). */
  convertedToRentalId?: string | null
}

/** Cobranças base vivas travadas e o que fazer com elas para a nova obrigação. */
export type BaseChargePlan = {
  charges: Payment[]
  reprice: { payment: Payment; amount: Prisma.Decimal } | null
}

/**
 * Trava uma a uma (chave da emissão, `:issue:` + id) as cobranças base vivas
 * (RENTAL/DEPOSIT, fora CANCELLED/REFUNDED) do orçamento — ou da locação, se
 * convertido — relê cada uma e decide pela regra do domínio
 * (`planQuoteBaseCharges`): cobrança paga nunca muda (o saldo é cobrado à
 * parte), a única PENDING nunca emitida passa a cobrar o saldo e qualquer
 * cobrança emitida ou vencida responde 409
 * `PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION` antes de qualquer escrita: o
 * valor de um boleto/PIX vivo no provedor nunca muda por aqui.
 */
export async function planBaseCharges(
  tx: Prisma.TransactionClient,
  tenantId: string,
  owner: BaseChargeOwner,
  obligation: Prisma.Decimal.Value,
  refusal: string
): Promise<BaseChargePlan> {
  const payments = await tx.payment.findMany({
    where: {
      tenantId,
      ...(owner.convertedToRentalId
        ? {
            OR: [
              { quoteId: owner.quoteId },
              { rentalId: owner.convertedToRentalId },
            ],
          }
        : { quoteId: owner.quoteId }),
      type: { in: [...BASE_CHARGE_TYPES] },
      status: { notIn: ['CANCELLED', 'REFUNDED'] },
    },
    orderBy: { id: 'asc' },
  })
  const charges: Payment[] = []
  const issued: boolean[] = []
  for (const payment of payments) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':issue:' + payment.id}, 0))`
    const current = await tx.payment.findFirst({
      where: { id: payment.id, tenantId },
      include: { attempts: { select: { id: true } } },
    })
    // Anulada entre a leitura e a trava: fica no histórico, fora da obrigação.
    if (!current || ['CANCELLED', 'REFUNDED'].includes(current.status)) continue
    const { attempts, ...row } = current
    charges.push(row)
    issued.push(
      Boolean(
        row.transactionId ||
        row.boletoIssuedAt ||
        row.pixCode ||
        attempts.length
      )
    )
  }
  const plan = planQuoteBaseCharges(
    String(obligation),
    charges.map((charge, index) => ({
      status: charge.status,
      amount: charge.amount,
      issued: issued[index]!,
    })),
    { repriceable: !owner.convertedToRentalId }
  )
  if (plan.kind === 'refuse')
    throw new RentalMutationError(
      refusal,
      409,
      PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION
    )
  return {
    charges,
    reprice:
      plan.kind === 'reprice'
        ? {
            payment: charges[plan.index]!,
            amount: new Prisma.Decimal(plan.amount.toString()),
          }
        : null,
  }
}

/**
 * Aplica o plano (`planBaseCharges`): a cobrança PENDING nunca emitida passa a
 * cobrar o saldo, em centavos, com o detalhamento tributário recalculado na
 * mesma transação. Cobranças pagas não são tocadas.
 */
export async function repriceBaseCharges(
  tx: Prisma.TransactionClient,
  tenantId: string,
  quote: {
    serviceAmount: Prisma.Decimal | null
    operationType: OperationType | null
    cpf: string | null
    cnpj: string | null
  },
  plan: BaseChargePlan
): Promise<void> {
  if (!plan.reprice) return
  const { payment, amount } = plan.reprice
  const settings = await getCurrentTaxSettings(tx, tenantId)
  const serviceAmount = new Prisma.Decimal(
    quote.serviceAmount?.toString() ?? 0
  ).clampedTo(0, amount)
  const rentalAmount = amount.minus(serviceAmount)
  const taxDocumentType =
    payment.taxDocumentType ?? resolveTaxDocumentType(quote)
  const operationType =
    payment.operationType ?? quote.operationType ?? 'PURE_RENTAL'
  const breakdown = calculateTaxBreakdown({
    grossAmount: amount,
    operationType,
    rentalAmount,
    serviceAmount,
    taxDocumentType,
    settings,
  })
  await tx.payment.update({
    where: { id: payment.id, tenantId },
    data: {
      amount,
      grossAmount: breakdown.grossAmount,
      netAmount: breakdown.netAmount,
      taxRate: breakdown.effectiveTaxRate,
      taxDocumentType,
      operationType,
      rentalAmount,
      serviceAmount,
      taxRegimeSnapshot: settings.taxRegime,
      issAmount: breakdown.issAmount,
      irpjAmount: breakdown.irpjAmount,
      csllAmount: breakdown.csllAmount,
      pisCofinsAmount: breakdown.pisCofinsAmount,
      simplesAmount: breakdown.simplesAmount,
      taxBreakdown: breakdown.summary,
    },
  })
}

/** Justificativa do reajuste que preserva a diferença de um valor final legado. */
export const LEGACY_FINAL_TOTAL_JUSTIFICATION = 'Ajuste anterior do valor final'

/**
 * Registra como reajuste vigente (OTHER) a diferença entre o valor que o
 * orçamento cobra hoje e a regra única (`quoteObligationResidual`), para que a
 * edição recalcule sem descartar em silêncio um valor final legado. Devolve o
 * reajuste registrado (ou `null` quando não há diferença).
 */
export async function preserveLegacyResidual(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string
    quoteId: string
    userId: string
    residual: Prisma.Decimal.Value
  }
): Promise<{ category: 'OTHER'; amount: Prisma.Decimal } | null> {
  const amount = new Prisma.Decimal(String(input.residual))
  if (amount.isZero()) return null
  await tx.quoteAdjustment.create({
    data: {
      tenantId: input.tenantId,
      quoteId: input.quoteId,
      category: 'OTHER',
      amount,
      justification: LEGACY_FINAL_TOTAL_JUSTIFICATION,
      createdBy: input.userId,
    },
  })
  return { category: 'OTHER', amount }
}
