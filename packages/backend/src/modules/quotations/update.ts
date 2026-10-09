import { Prisma, type QuotePaymentTerms } from '@prisma/client'
import { admitRentalCommand } from '../entitlements/command-admission'
import { formatCurrency } from '@gb-locacoes/domain/formatting'
import { countRentalDays, roundToCents } from '@gb-locacoes/domain/locacao'
import {
  quoteItemsAndFreight,
  quoteObligation,
  quoteObligationResidual,
} from '@gb-locacoes/domain/orcamento'
import type { TenantPrincipal } from '../identity/index'
import { enqueueOutbox } from '../outbox/index'
import {
  assertTenantCustomer,
  RentalMutationError,
  type QuoteConversion,
  type RentalAvailability,
  type RentalTransaction,
  type TenantTransactionRunner,
} from '../rentals/index'
import {
  planBaseCharges,
  preserveLegacyResidual,
  repriceBaseCharges,
  type BaseChargePlan,
} from './base-charges'

const Decimal = Prisma.Decimal

/** Valor gravado ou cobrado em centavos (2 casas, ROUND_HALF_UP), como o provedor cobra. */
const cents = (value: Prisma.Decimal.Value) => new Decimal(roundToCents(value))

/** Valor monetário do corpo em centavos; ausente, não numérico ou negativo é recusado com 400. */
function centsInput(value: unknown, error: string): Prisma.Decimal {
  const reject = () => new QuoteUpdateRejected(400, { error })
  if (typeof value !== 'number' && typeof value !== 'string') throw reject()
  let parsed: Prisma.Decimal
  try {
    parsed = cents(value)
  } catch {
    throw reject()
  }
  if (parsed.isNegative()) throw reject()
  return parsed
}

const RECONCILIATION_REFUSAL =
  'Cobrança emitida ou paga requer reconciliação antes de alterar o valor do orçamento'

/**
 * Recusa de regra da atualização administrativa: o adaptador HTTP responde
 * `body` com `status` (contrato legado, mensagens preservadas byte a byte).
 */
export class QuoteUpdateRejected extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : 'Quote update rejected')
    this.name = 'QuoteUpdateRejected'
    this.status = status
    this.body = body
  }
}

/**
 * Corpo JSON da atualização como recebido pelo adaptador. A validação é feita
 * aqui, como no contrato legado: campos fora da lista permitida são recusados
 * e os demais são validados antes de qualquer escrita.
 */
export type QuoteUpdateBody = {
  status?: string
  paymentTerms?: string
  finalTotal?: Prisma.Decimal.Value
  priceAdjustmentReason?: string
  lateFee?: Prisma.Decimal.Value
  lateFeeApproved?: boolean
  rejectionReason?: string
  removeApproval?: boolean
  removeItemId?: string
  updateItemDates?: {
    itemId?: string
    startDate?: string
    endDate?: string
    includeWeekends?: boolean
  }
  operationType?: string
  serviceAmount?: number | string | null
  includeWeekends?: boolean
  deliveryFee?: Prisma.Decimal.Value | null
  pickupFee?: Prisma.Decimal.Value | null
  [field: string]: unknown
}

/**
 * Atualização administrativa do orçamento (aprovação, rejeição, ajustes de
 * valor, multa, itens, datas e frete). Toda decisão roda sob o lock de
 * mutação da locadora com o orçamento travado (`FOR UPDATE`); a conversão
 * AT_END acontece na mesma transação e os efeitos externos saem pela outbox.
 */
export function createQuoteUpdates({
  withTenantTransaction,
  withRentalTransaction,
  convertQuoteToRentalInTransaction,
  isEquipmentAvailableForRental,
  autoGenerateBoletoOnApproval,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
  convertQuoteToRentalInTransaction: QuoteConversion['convertQuoteToRentalInTransaction']
  isEquipmentAvailableForRental: RentalAvailability['isEquipmentAvailableForRental']
  /** Lido a cada aprovação (configuração do runtime fornecida pela composição). */
  autoGenerateBoletoOnApproval: () => boolean
}) {
  async function updateQuote(
    principal: TenantPrincipal,
    id: string,
    body: QuoteUpdateBody
  ) {
    const {
      status,
      paymentTerms,
      finalTotal,
      priceAdjustmentReason,
      lateFee,
      lateFeeApproved,
      rejectionReason,
      removeApproval,
      removeItemId,
      updateItemDates: rawUpdateItemDates,
      operationType: rawOperationType,
      serviceAmount: rawServiceAmount,
      includeWeekends: bodyIncludeWeekends,
      ...updateData
    } = body

    const allowedUpdateFields = new Set([
      'name',
      'email',
      'phone',
      'company',
      'message',
      'cep',
      'cnpj',
      'cpf',
      'adminNotes',
      'deliveryAddress',
      'deliveryFee',
      'deliveryType',
      'deposit',
      'discount',
      'endDate',
      'internalNotes',
      'pickupFee',
      'priority',
      'startDate',
      'subtotal',
      'taxes',
      'total',
      'validUntil',
      'damages',
      'misuse',
      'userId',
    ])
    if (Object.keys(updateData).some((key) => !allowedUpdateFields.has(key)))
      throw new QuoteUpdateRejected(400, {
        error: 'Campo não editável no orçamento',
      })
    // Valores que compõem a obrigação entram em centavos (Decimal, ROUND_HALF_UP), nunca crus.
    if ('total' in updateData)
      updateData.total = centsInput(updateData.total, 'Valor total inválido')
    for (const fee of ['deliveryFee', 'pickupFee'] as const)
      if (fee in updateData && updateData[fee] !== null)
        updateData[fee] = centsInput(updateData[fee], 'Valor de frete inválido')
    const requestedLateFee =
      lateFee === undefined
        ? undefined
        : centsInput(lateFee, 'Valor de multa inválido')
    let shouldGenerateBoleto = false
    let shouldRefreshBoleto = false
    let shouldConvertAtEnd = false
    let emailStatusOverride: 'APPROVED' | 'REJECTED' | 'COMPLETED' | null = null

    const mutation = await withRentalTransaction(principal, async (tx) => {
      await tx.$executeRaw`SELECT id FROM quotes WHERE id = ${id} AND "tenantId" = ${principal.tenantId} FOR UPDATE`
      if (typeof updateData.userId === 'string')
        await assertTenantCustomer(tx, principal, updateData.userId)
      // Buscar orçamento atual para verificar se já foi convertido
      const currentQuote = await tx.quote.findUnique({
        where: { id: id, tenantId: principal.tenantId },
        include: {
          items: {
            include: {
              equipment: true,
            },
          },
          user: true,
          payments: true,
        },
      })

      if (!currentQuote) {
        throw new QuoteUpdateRejected(404, { error: 'Quote not found' })
      }
      await admitRentalCommand(tx, principal, {})

      if (
        currentQuote.convertedToRentalId &&
        status &&
        !['COMPLETED', 'REJECTED'].includes(status)
      )
        throw new RentalMutationError(
          'Orçamento convertido não pode voltar a um estado anterior',
          409
        )
      if (
        currentQuote.convertedToRentalId &&
        (removeItemId ||
          rawUpdateItemDates ||
          finalTotal !== undefined ||
          paymentTerms !== undefined ||
          bodyIncludeWeekends !== undefined ||
          [
            'total',
            'startDate',
            'endDate',
            'deliveryFee',
            'pickupFee',
            'items',
            'userId',
            'convertedToRentalId',
          ].some((key) => key in updateData))
      ) {
        throw new RentalMutationError(
          'Orçamento convertido exige ajuste próprio; a locação e o contrato existentes são preservados',
          409
        )
      }

      const requestedPaymentTerms =
        typeof paymentTerms === 'string' ? paymentTerms.toUpperCase() : null

      if (
        requestedPaymentTerms &&
        !['UPFRONT', 'ON_DELIVERY', 'AT_END'].includes(requestedPaymentTerms)
      ) {
        throw new QuoteUpdateRejected(400, { error: 'paymentTerms inválido' })
      }

      const effectivePaymentTerms = (requestedPaymentTerms ||
        currentQuote.paymentTerms ||
        'UPFRONT') as QuotePaymentTerms

      // Validate operationType if provided
      const validOperationTypes = ['PURE_RENTAL', 'RENTAL_WITH_SERVICE']
      if (
        rawOperationType &&
        typeof rawOperationType === 'string' &&
        !validOperationTypes.includes(rawOperationType)
      ) {
        throw new QuoteUpdateRejected(400, { error: 'operationType inválido' })
      }

      // Preparar dados de atualização
      const updateQuoteData: Prisma.QuoteUncheckedUpdateInput = {
        // Campos já restritos à lista permitida; valores validados pelo Prisma.
        ...(updateData as Prisma.QuoteUncheckedUpdateInput),
        updatedAt: new Date(),
      }

      if (requestedPaymentTerms) {
        updateQuoteData.paymentTerms =
          requestedPaymentTerms as QuotePaymentTerms
      }

      // Sistema de ajuste de valor final com justificativa. O valor manual vira
      // um reajuste vigente (OTHER), para que a regra única o preserve nas
      // edições seguintes; a obrigação é recalculada mais abaixo.
      let manualFinalTotal: Prisma.Decimal | null = null
      if (finalTotal !== undefined) {
        // Validar que justificativa é obrigatória
        if (!priceAdjustmentReason || priceAdjustmentReason.trim() === '') {
          throw new QuoteUpdateRejected(400, {
            error:
              'Justificativa é obrigatória ao editar o valor final do orçamento',
          })
        }

        let finalTotalDecimal: Prisma.Decimal
        try {
          finalTotalDecimal = cents(finalTotal)
        } catch {
          throw new QuoteUpdateRejected(400, {
            error: 'Valor final deve ser maior que zero',
          })
        }

        if (finalTotalDecimal.lte(0)) {
          throw new QuoteUpdateRejected(400, {
            error: 'Valor final deve ser maior que zero',
          })
        }

        // Se não existe originalTotal, usar o total atual como original
        if (!currentQuote.originalTotal) {
          updateQuoteData.originalTotal = currentQuote.total
        }

        manualFinalTotal = finalTotalDecimal
        updateQuoteData.priceAdjustmentReason = priceAdjustmentReason.trim()
        updateQuoteData.priceAdjustedAt = new Date()
        if (principal.userId) {
          updateQuoteData.priceAdjustedBy = principal.userId
        }
      }

      // Sistema de multa por atraso
      if (requestedLateFee !== undefined) {
        updateQuoteData.lateFee = requestedLateFee
      }

      if (lateFeeApproved !== undefined) {
        if (lateFeeApproved === true) {
          // Validar que existe valor de multa calculado
          const feeToApprove =
            requestedLateFee !== undefined
              ? requestedLateFee
              : currentQuote.lateFee
                ? cents(currentQuote.lateFee)
                : null

          if (!feeToApprove || feeToApprove.lte(0)) {
            throw new QuoteUpdateRejected(400, {
              error:
                'Não é possível aprovar multa sem valor calculado ou com valor zero',
            })
          }

          updateQuoteData.lateFeeApproved = true
          // Aprovar de novo (retry, clique duplo) não muda quem nem quando aprovou.
          if (currentQuote.lateFeeApproved !== true) {
            updateQuoteData.lateFeeApprovedAt = new Date()
            if (principal.userId) {
              updateQuoteData.lateFeeApprovedBy = principal.userId
            }
          }

          // Se nao ha justificativa de ajuste, criar uma para a multa
          if (
            updateQuoteData.priceAdjustmentReason === undefined &&
            !currentQuote.priceAdjustmentReason
          ) {
            updateQuoteData.priceAdjustmentReason = `Multa por atraso aprovada: ${formatCurrency(feeToApprove.toNumber())}`
            updateQuoteData.priceAdjustedAt = new Date()
            if (principal.userId) {
              updateQuoteData.priceAdjustedBy = principal.userId
            }
          }
        } else {
          updateQuoteData.lateFeeApproved = false
          updateQuoteData.lateFeeApprovedAt = null
          updateQuoteData.lateFeeApprovedBy = null
        }
      }

      // Remover aprovação do orçamento

      if (removeApproval === true && currentQuote.approvedAt) {
        updateQuoteData.approvedAt = null
        updateQuoteData.approvedBy = null
        // Se o status estava como PENDING mas tinha aprovação, garantir que permaneça PENDING
        // (não alterar status para não afetar fluxos que dependem dele)
      }

      // Registro de aprovacao do admin: sempre define status APPROVED para mover
      // o orçamento da coluna "Pendente" para "Aprovado" no Kanban.
      if (status === 'APPROVED') {
        updateQuoteData.status = 'APPROVED'

        // Validar disponibilidade antes de aprovar
        for (const item of currentQuote.items) {
          const itemStart = item.startDate || currentQuote.startDate
          const itemEnd = item.endDate || currentQuote.endDate

          if (!itemStart || !itemEnd) {
            throw new QuoteUpdateRejected(400, {
              error: 'Orcamento deve ter datas de inicio e fim definidas',
            })
          }

          const availability = await isEquipmentAvailableForRental(
            principal,
            item.equipmentId,
            itemStart,
            itemEnd,
            item.quantity,
            {
              db: tx,
              excludeRentalId: currentQuote.convertedToRentalId ?? undefined,
            }
          )

          if (!availability.available) {
            throw new QuoteUpdateRejected(400, {
              error: `Equipamento ${item.equipment?.name || item.equipmentId}: ${availability.reason || 'Indisponivel'}`,
            })
          }
        }

        if (!currentQuote.approvedAt) {
          updateQuoteData.approvedAt = new Date()
          if (principal.userId) {
            updateQuoteData.approvedBy = principal.userId
          } else {
            // Remover approvedBy se nao houver usuario
            delete updateQuoteData.approvedBy
          }
        }

        if (effectivePaymentTerms === 'AT_END') {
          if (!currentQuote.userId && !currentQuote.user?.id) {
            throw new QuoteUpdateRejected(400, {
              error:
                'Fluxo AT_END requer orçamento vinculado a um cliente autenticado',
            })
          }

          // Fluxo Melnick: aprova operacionalmente e converte sem pagamento inicial.
          updateQuoteData.status = 'APPROVED'
          shouldGenerateBoleto = false
          shouldRefreshBoleto = false
          shouldConvertAtEnd = !currentQuote.convertedToRentalId
        } else {
          shouldGenerateBoleto = autoGenerateBoletoOnApproval()
        }
      }

      // Se está rejeitando o orçamento
      if (status === 'REJECTED' && currentQuote.status !== 'REJECTED') {
        updateQuoteData.status = 'REJECTED'
        updateQuoteData.rejectedAt = new Date()
        if (rejectionReason && rejectionReason.trim()) {
          updateQuoteData.rejectionReason = rejectionReason.trim()
        }
        if (principal.userId) {
          updateQuoteData.rejectedBy = principal.userId
        } else {
          // Remover rejectedBy se não houver usuário
          delete updateQuoteData.rejectedBy
        }

        await tx.rentals.updateMany({
          where: {
            tenantId: principal.tenantId,
            quoteId: id,
            status: { notIn: ['CANCELLED', 'COMPLETED'] },
          },
          data: { status: 'CANCELLED', updatedat: new Date() },
        })
      }

      // Itens como ficam depois desta edição (remoção e novas datas).
      let nextItems: Array<{ id: string; total: Prisma.Decimal.Value }> =
        currentQuote.items.map((item) => ({ id: item.id, total: item.total }))
      let itemsChanged = false

      // Remover item do orçamento (admin)
      if (
        removeItemId &&
        typeof removeItemId === 'string' &&
        removeItemId.trim() !== ''
      ) {
        const itemToRemove = currentQuote.items.find(
          (i) => i.id === removeItemId.trim()
        )
        if (!itemToRemove) {
          throw new QuoteUpdateRejected(400, {
            error: 'Item não encontrado neste orçamento',
          })
        }
        await tx.quoteItem.delete({
          where: {
            id: removeItemId.trim(),
            quoteId: id,
            tenantId: principal.tenantId,
          },
        })
        nextItems = nextItems.filter((i) => i.id !== removeItemId.trim())
        itemsChanged = true
      }

      // Atualizar datas de um item específico (admin)
      if (
        rawUpdateItemDates &&
        typeof rawUpdateItemDates === 'object' &&
        typeof rawUpdateItemDates.itemId === 'string' &&
        rawUpdateItemDates.itemId.trim() !== ''
      ) {
        const {
          itemId,
          startDate: startStr,
          endDate: endStr,
          includeWeekends,
        } = rawUpdateItemDates as {
          itemId: string
          startDate?: string
          endDate?: string
          includeWeekends?: boolean
        }
        const itemToUpdate = currentQuote.items.find(
          (i) => i.id === itemId.trim()
        )
        if (!itemToUpdate) {
          throw new QuoteUpdateRejected(400, {
            error: 'Item não encontrado neste orçamento',
          })
        }
        if (
          typeof startStr !== 'string' ||
          !startStr.trim() ||
          typeof endStr !== 'string' ||
          !endStr.trim()
        ) {
          throw new QuoteUpdateRejected(400, {
            error: 'Data início e data fim são obrigatórias',
          })
        }
        const startParts = startStr.trim().split(/[-T]/).map(Number)
        const endParts = endStr.trim().split(/[-T]/).map(Number)
        const startDate = new Date(
          startParts[0] ?? 0,
          (startParts[1] ?? 1) - 1,
          startParts[2] ?? 1
        )
        const endDate = new Date(
          endParts[0] ?? 0,
          (endParts[1] ?? 1) - 1,
          endParts[2] ?? 1
        )
        if (endDate < startDate) {
          throw new QuoteUpdateRejected(400, {
            error: 'Data fim deve ser igual ou posterior à data início',
          })
        }
        const includeWeekendsBool = includeWeekends === true
        const days = countRentalDays(startDate, endDate, includeWeekendsBool)
        const pricePerDay = new Decimal(itemToUpdate.pricePerDay.toString())
        const quantity = itemToUpdate.quantity
        const totalItem = cents(pricePerDay.times(quantity).times(days))

        await tx.quoteItem.update({
          where: {
            id: itemId.trim(),
            quoteId: id,
            tenantId: principal.tenantId,
          },
          data: {
            startDate,
            endDate,
            includeWeekends: includeWeekendsBool,
            days,
            total: totalItem,
          },
        })

        nextItems = nextItems.map((i) =>
          i.id === itemId.trim() ? { id: i.id, total: totalItem } : i
        )
        itemsChanged = true
      }

      // Regra única da obrigação: itens + frete + reajustes vigentes + multa
      // aprovada, em centavos, recalculada do estado atual por toda edição que
      // mexe no valor (nunca somada sobre um valor final que já tem a multa nem
      // sobre um originalTotal antigo).
      const freightInBody =
        'deliveryFee' in updateData || 'pickupFee' in updateData
      const nextDeliveryFee =
        'deliveryFee' in updateData
          ? (updateData.deliveryFee ?? null)
          : currentQuote.deliveryFee
      const nextPickupFee =
        'pickupFee' in updateData
          ? (updateData.pickupFee ?? null)
          : currentQuote.pickupFee
      // Itens, datas ou frete recalculam o total (itens + frete); orçamento legado sem itens mantém o seu.
      const structural =
        (itemsChanged || freightInBody) && currentQuote.items.length > 0
      const nextTotal = structural
        ? new Decimal(
            quoteItemsAndFreight({
              items: nextItems,
              deliveryFee: nextDeliveryFee,
              pickupFee: nextPickupFee,
            }).toString()
          )
        : 'total' in updateData
          ? new Decimal(String(updateData.total))
          : currentQuote.total
      if (structural) {
        updateQuoteData.total = nextTotal
        updateQuoteData.originalTotal = nextTotal
      }
      const moneyEdit =
        structural ||
        'total' in updateData ||
        manualFinalTotal !== null ||
        requestedLateFee !== undefined ||
        lateFeeApproved !== undefined
      let plan: BaseChargePlan | null = null
      if (moneyEdit) {
        const adjustments: Array<{ category: string; amount: Prisma.Decimal }> =
          await tx.quoteAdjustment.findMany({
            where: { quoteId: id, tenantId: principal.tenantId },
            select: { category: true, amount: true },
          })
        // Valor final legado (gravado antes da regra única) que a regra não explica vira reajuste
        // vigente antes do recálculo: a edição muda só o que ela mexe, nunca descarta esse valor.
        // A base é a mesma desta edição: itens + frete atuais quando ela recompõe o total.
        const legacy = await preserveLegacyResidual(tx, {
          tenantId: principal.tenantId,
          quoteId: id,
          userId: principal.userId,
          residual: quoteObligationResidual(currentQuote.finalTotal, {
            total: structural
              ? quoteItemsAndFreight({
                  items: currentQuote.items,
                  deliveryFee: currentQuote.deliveryFee,
                  pickupFee: currentQuote.pickupFee,
                })
              : currentQuote.total,
            adjustments,
            lateFee: currentQuote.lateFee,
            lateFeeApproved: currentQuote.lateFeeApproved,
          }).toString(),
        })
        if (legacy) adjustments.push(legacy)
        if (manualFinalTotal) {
          // O valor manual é a obrigação do orçamento editado, antes da mudança de multa desta mesma edição.
          const withoutManual = quoteObligation({
            total: nextTotal,
            adjustments,
            lateFee: currentQuote.lateFee,
            lateFeeApproved: currentQuote.lateFeeApproved,
          })
          const manual = manualFinalTotal.minus(withoutManual.toString())
          if (!manual.isZero()) {
            await tx.quoteAdjustment.create({
              data: {
                tenantId: principal.tenantId,
                quoteId: id,
                category: 'OTHER',
                amount: manual,
                justification: String(updateQuoteData.priceAdjustmentReason),
                createdBy: principal.userId,
              },
            })
            adjustments.push({ category: 'OTHER', amount: manual })
          }
        }
        const nextObligation = new Decimal(
          quoteObligation({
            total: nextTotal,
            adjustments,
            lateFee: requestedLateFee ?? currentQuote.lateFee,
            lateFeeApproved:
              lateFeeApproved ?? currentQuote.lateFeeApproved === true,
          }).toString()
        )
        if (
          manualFinalTotal ||
          currentQuote.finalTotal !== null ||
          !nextObligation.equals(nextTotal)
        )
          updateQuoteData.finalTotal = nextObligation
        const obligationChanged = !nextObligation.equals(
          cents(currentQuote.finalTotal ?? currentQuote.total)
        )
        // Cobrança base emitida ou vencida nunca muda de valor aqui (409, nada gravado); paga fica
        // como está e o saldo é cobrado à parte; a pendente nunca emitida passa a cobrar o saldo.
        if (obligationChanged)
          plan = await planBaseCharges(
            tx,
            principal.tenantId,
            {
              quoteId: id,
              convertedToRentalId: currentQuote.convertedToRentalId,
            },
            nextObligation,
            RECONCILIATION_REFUSAL
          )
      }
      // O ensure só atualiza um boleto que já existe e que o consumidor aceita: orçamento
      // aprovado, a única cobrança base é o boleto reprecificado (valor = obrigação). Sem
      // cobrança, nenhum boleto é criado por edição (isso é da aprovação ou de um pedido).
      const approvedAfter =
        ['APPROVED', 'COMPLETED'].includes(
          String(updateQuoteData.status ?? currentQuote.status)
        ) &&
        Boolean(
          updateQuoteData.approvedAt !== undefined
            ? updateQuoteData.approvedAt
            : currentQuote.approvedAt
        )
      shouldRefreshBoleto =
        approvedAfter &&
        !shouldConvertAtEnd &&
        plan?.reprice?.payment.method === 'BOLETO' &&
        plan.charges.length === 1

      // Construir objeto de update de forma explícita e segura
      const cleanUpdateData: Prisma.QuoteUncheckedUpdateInput = {
        updatedAt: new Date(),
      }

      // Adicionar campos do updateData se existirem
      if (updateData && typeof updateData === 'object') {
        Object.assign(cleanUpdateData, updateData)
      }

      // Adicionar campos específicos se foram definidos
      if (updateQuoteData.status) {
        cleanUpdateData.status = updateQuoteData.status
      }
      if (updateQuoteData.total !== undefined) {
        cleanUpdateData.total = updateQuoteData.total
      }
      if (updateQuoteData.originalTotal !== undefined) {
        cleanUpdateData.originalTotal = updateQuoteData.originalTotal
      }
      if (updateQuoteData.finalTotal !== undefined) {
        cleanUpdateData.finalTotal = updateQuoteData.finalTotal
      }
      if (updateQuoteData.priceAdjustmentReason !== undefined) {
        cleanUpdateData.priceAdjustmentReason =
          updateQuoteData.priceAdjustmentReason
      }
      if (updateQuoteData.priceAdjustedAt !== undefined) {
        cleanUpdateData.priceAdjustedAt = updateQuoteData.priceAdjustedAt
      }
      if (updateQuoteData.priceAdjustedBy !== undefined) {
        cleanUpdateData.priceAdjustedBy = updateQuoteData.priceAdjustedBy
      }
      if (updateQuoteData.lateFee !== undefined) {
        cleanUpdateData.lateFee = updateQuoteData.lateFee
      }
      if (updateQuoteData.lateFeeApproved !== undefined) {
        cleanUpdateData.lateFeeApproved = updateQuoteData.lateFeeApproved
      }
      if (updateQuoteData.lateFeeApprovedAt !== undefined) {
        cleanUpdateData.lateFeeApprovedAt = updateQuoteData.lateFeeApprovedAt
      }
      if (updateQuoteData.lateFeeApprovedBy !== undefined) {
        cleanUpdateData.lateFeeApprovedBy = updateQuoteData.lateFeeApprovedBy
      }
      if (updateQuoteData.approvedAt !== undefined) {
        cleanUpdateData.approvedAt = updateQuoteData.approvedAt
      }
      if (updateQuoteData.approvedBy !== undefined) {
        cleanUpdateData.approvedBy = updateQuoteData.approvedBy
      }
      if (updateQuoteData.paymentTerms !== undefined) {
        cleanUpdateData.paymentTerms = updateQuoteData.paymentTerms
      }
      if (updateQuoteData.rejectedAt) {
        cleanUpdateData.rejectedAt = updateQuoteData.rejectedAt
      }
      if (updateQuoteData.rejectedBy) {
        cleanUpdateData.rejectedBy = updateQuoteData.rejectedBy
      }
      if (updateQuoteData.rejectionReason) {
        cleanUpdateData.rejectionReason = updateQuoteData.rejectionReason
      }
      if (updateQuoteData.convertedToRentalId) {
        cleanUpdateData.convertedToRentalId =
          updateQuoteData.convertedToRentalId
      }

      // Operation type classification (for tax compliance)
      if (rawOperationType && validOperationTypes.includes(rawOperationType)) {
        cleanUpdateData.operationType = rawOperationType as
          'PURE_RENTAL' | 'RENTAL_WITH_SERVICE'
      }
      if (rawServiceAmount !== undefined) {
        cleanUpdateData.serviceAmount =
          rawServiceAmount != null ? Number(rawServiceAmount) : null
      }

      const quote = await tx.quote.update({
        where: { id: id, tenantId: principal.tenantId },
        data: cleanUpdateData,
        include: {
          items: {
            include: {
              equipment: {
                select: {
                  id: true,
                  name: true,
                  pricePerDay: true,
                  images: true,
                  category: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      // A cobrança base PENDING nunca emitida passa a cobrar o saldo da obrigação recalculada.
      if (plan) await repriceBaseCharges(tx, principal.tenantId, quote, plan)

      // Atualizar includeWeekends em todos os itens do orçamento (campo não existe no Quote)
      if (typeof bodyIncludeWeekends === 'boolean') {
        await tx.quoteItem.updateMany({
          where: { quoteId: id, tenantId: principal.tenantId },
          data: { includeWeekends: bodyIncludeWeekends },
        })
        // Recarregar quote com itens atualizados para retorno consistente
        const updatedQuote = await tx.quote.findUnique({
          where: { id: id, tenantId: principal.tenantId },
          include: {
            items: {
              include: {
                equipment: {
                  select: {
                    id: true,
                    name: true,
                    pricePerDay: true,
                    images: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        })
        if (updatedQuote) {
          Object.assign(quote, { items: updatedQuote.items })
        }
      }

      if (shouldConvertAtEnd) {
        await convertQuoteToRentalInTransaction(principal, tx, quote.id)
        emailStatusOverride = 'COMPLETED'
      }
      const eventStatus = emailStatusOverride || status || ''
      if (
        !shouldConvertAtEnd &&
        ['APPROVED', 'REJECTED', 'COMPLETED'].includes(eventStatus) &&
        currentQuote.status !== eventStatus
      ) {
        await enqueueOutbox(tx, {
          tenantId: principal.tenantId,
          topic: 'quote.status.notify',
          aggregateId: quote.id,
          payload: { quoteId: quote.id, status: eventStatus },
          dedupeKey: `quote-status:${quote.id}:${eventStatus}:${quote.updatedAt.toISOString()}`,
        })
      }
      if (
        (shouldGenerateBoleto || shouldRefreshBoleto) &&
        (currentQuote.user?.cpf ||
          currentQuote.user?.cnpj ||
          currentQuote.cpf ||
          currentQuote.cnpj ||
          updateData.cpf ||
          updateData.cnpj)
      ) {
        await enqueueOutbox(tx, {
          tenantId: principal.tenantId,
          topic: 'quote.boleto.ensure',
          aggregateId: quote.id,
          payload: { quoteId: quote.id },
          dedupeKey: `quote-boleto:${quote.id}:${quote.updatedAt.toISOString()}`,
        })
      }
      return quote
    })
    const quote = mutation

    const responseQuote = await withTenantTransaction(principal, (tx) =>
      tx.quote.findUnique({
        where: { id: id, tenantId: principal.tenantId },
        include: {
          items: {
            include: {
              equipment: {
                select: {
                  id: true,
                  name: true,
                  pricePerDay: true,
                },
              },
            },
          },
          payments: {
            orderBy: {
              dueDate: 'asc',
            },
          },
        },
      })
    )

    return responseQuote || quote
  }
  return { updateQuote }
}

export type QuoteUpdates = ReturnType<typeof createQuoteUpdates>
