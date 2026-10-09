import { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { getBoletoDueDate } from '@gb-locacoes/domain/pagamento'
import { roundToCents } from '@gb-locacoes/domain/locacao'
import {
  calculateTaxBreakdown,
  resolveTaxDocumentType,
} from '@gb-locacoes/domain/financeiro'
import {
  assertReceivingAccountReady,
  CANCELLED_CHARGE_FAILURES,
  findUnverifiedCancelledCharges,
  ReceivingAccountNotReadyError,
  withCancelledChargeProof,
  type CancelledChargeGate,
  type ProviderChargeRead,
  type ProviderChargeReader,
} from '../billing/index'
import { enqueueOutbox } from '../outbox/index'
import type { TenantPrincipal } from '../identity/index'
import type {
  RentalTransaction,
  TenantTransactionRunner,
} from '../rentals/index'
import { getCurrentTaxSettings } from './taxes'
import type { AccessError } from '@gb-locacoes/contracts/entitlements'
import {
  createSubscriptionCommandAccess,
  SubscriptionCommandError,
} from '../entitlements/command-admission'

export type QuoteBoletoInfo = {
  paymentId: string
  amount: number
  dueDate: Date
  status: string
  created: boolean
  processing: 'PENDING' | 'ISSUED'
  metadata: {
    barcode?: string
    digitableLine?: string
    pdfUrl?: string
    instructions?: string[]
  }
}

/**
 * Erro de obrigação de cobrança do contrato de billing (status HTTP e
 * mensagem), fornecido pela composição para preservar a classe pública.
 */
export type ObligationErrorFactory = (
  _status: number,
  _message: string,
  _policy?: AccessError | { error: string }
) => Error

/** Cobrança lida no provedor e a integração ativa da locadora que a leu. */
export type QuoteBoletoProviderRead = ProviderChargeRead

/**
 * Leitura (sem efeito) de uma cobrança no provedor pela integração ativa da
 * locadora — por exemplo `createAsaasGateway(...).get(externalId)`. Fornecida
 * pela composição e chamada sempre fora de transação SQL.
 */
export type QuoteBoletoChargeReader = ProviderChargeReader

export function createQuoteBoletos({
  withTenantTransaction,
  withRentalTransaction,
  obligationError,
  readProviderCharge,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
  obligationError: ObligationErrorFactory
  /**
   * Sem leitor, uma cobrança PIX/boleto CANCELLED com cobrança externa não
   * provada extinta bloqueia a emissão (409) em vez de gerar uma segunda viva.
   */
  readProviderCharge?: QuoteBoletoChargeReader
}) {
  async function lockQuoteBoleto(
    tx: Prisma.TransactionClient,
    context: TenantContext,
    quoteId: string
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':quote-boleto:' + quoteId}, 0))`
  }

  async function prepareQuoteBoleto(
    context: TenantContext,
    tx: Prisma.TransactionClient,
    quoteId: string,
    manual: boolean
  ): Promise<CancelledChargeGate<QuoteBoletoInfo>> {
    await lockQuoteBoleto(tx, context, quoteId)
    const quote = await tx.quote.findFirst({
      where: { id: quoteId, tenantId: context.tenantId },
    })
    if (!quote) throw obligationError(404, 'Orçamento não encontrado')
    if (!quote.approvedAt || !['APPROVED', 'COMPLETED'].includes(quote.status))
      throw obligationError(409, 'Orçamento precisa estar aprovado')
    if (manual) await admitManualQuoteBoleto(context, tx, quoteId)
    const reference = quote.convertedToRentalId
      ? { rentalId: quote.convertedToRentalId }
      : { quoteId }
    // O boleto cobra a obrigação em centavos: o provedor não aceita frações de centavo.
    const total = new Prisma.Decimal(
      roundToCents(quote.finalTotal ?? quote.total ?? 0)
    )
    if (total.lte(0)) throw obligationError(409, 'Orçamento sem valor válido')
    const obligations = await tx.payment.findMany({
      where: {
        tenantId: context.tenantId,
        ...reference,
        type: { in: ['RENTAL', 'DEPOSIT'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    // CANCELLED/REFUNDED ficam intocadas como histórico e não são reaproveitadas.
    const existing = obligations.find(
      (row) =>
        row.method === 'BOLETO' &&
        !['CANCELLED', 'REFUNDED'].includes(row.status)
    )
    if (
      obligations.some(
        (row) =>
          row.method !== 'BOLETO' &&
          ['PENDING', 'OVERDUE', 'PAID'].includes(row.status)
      )
    ) {
      throw obligationError(
        409,
        'Já existe cobrança ou pagamento por outro meio; concilie a obrigação antes de emitir boleto'
      )
    }
    if (
      existing &&
      !existing.amount.equals(total) &&
      existing.status !== 'PAID'
    ) {
      throw obligationError(
        409,
        'Cobrança existente exige ajuste ou conciliação; o histórico foi preservado'
      )
    }
    if (!existing) {
      // Um boleto novo só sai quando nenhuma cobrança anterior pode continuar viva no provedor.
      const unverified = await findUnverifiedCancelledCharges(
        tx,
        context,
        obligations
      )
      if (unverified.length) return { kind: 'verify', rows: unverified }
    }
    const profile = quote.userId
      ? await tx.clientProfile.findFirst({
          where: { tenantId: context.tenantId, userId: quote.userId },
        })
      : null
    const document = profile?.document ?? quote.cpf ?? quote.cnpj
    if (!document)
      throw obligationError(
        409,
        'Documento do titular nesta locadora não informado'
      )
    const taxSettings = await getCurrentTaxSettings(tx, context.tenantId)
    const taxDocumentType = resolveTaxDocumentType({
      cnpj: document.replace(/\D/g, '').length === 14 ? document : null,
      cpf: document.replace(/\D/g, '').length !== 14 ? document : null,
    })
    const operationType = quote.operationType ?? 'PURE_RENTAL'
    const serviceAmount = new Prisma.Decimal(String(quote.serviceAmount ?? 0))
    const rentalAmount = total.minus(serviceAmount).clampedTo(0, total)
    const breakdown = calculateTaxBreakdown({
      grossAmount: total,
      operationType,
      rentalAmount,
      serviceAmount,
      taxDocumentType,
      settings: taxSettings,
    })
    const payment =
      existing ??
      (await tx.payment.create({
        data: {
          tenantId: context.tenantId,
          ...reference,
          amount: total,
          method: 'BOLETO',
          type: 'RENTAL',
          status: 'PENDING',
          dueDate: getBoletoDueDate(),
          billingStatus: 'AWAITING_PAYMENT',
          grossAmount: breakdown.grossAmount,
          netAmount: breakdown.netAmount,
          taxRate: breakdown.effectiveTaxRate,
          taxDocumentType,
          operationType,
          rentalAmount,
          serviceAmount,
          taxRegimeSnapshot: taxSettings.taxRegime,
          issAmount: breakdown.issAmount,
          irpjAmount: breakdown.irpjAmount,
          csllAmount: breakdown.csllAmount,
          pisCofinsAmount: breakdown.pisCofinsAmount,
          simplesAmount: breakdown.simplesAmount,
          taxBreakdown: breakdown.summary,
        },
      }))
    if (!payment.transactionId && payment.status !== 'PAID')
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'payment.issue',
        aggregateId: payment.id,
        payload: { paymentId: payment.id },
        dedupeKey: 'payment.issue:' + payment.id,
      })
    const raw =
      payment.metadata &&
      typeof payment.metadata === 'object' &&
      !Array.isArray(payment.metadata)
        ? payment.metadata
        : {}
    return {
      kind: 'ready',
      value: {
        paymentId: payment.id,
        amount: payment.amount.toNumber(),
        dueDate: payment.dueDate,
        status: payment.status,
        created: !existing,
        processing:
          payment.transactionId || payment.status === 'PAID'
            ? 'ISSUED'
            : 'PENDING',
        metadata: {
          ...(typeof raw.barcode === 'string' ? { barcode: raw.barcode } : {}),
          ...(typeof raw.digitableLine === 'string'
            ? { digitableLine: raw.digitableLine }
            : {}),
          ...(typeof raw.pdfUrl === 'string' ? { pdfUrl: raw.pdfUrl } : {}),
        },
      },
    }
  }

  /**
   * Cria a obrigação e o pedido durável de emissão. Nenhuma chamada ao provedor
   * roda em SQL: cobranças anuladas sem prova de fim no provedor são lidas entre
   * duas transações e conciliadas antes de qualquer emissão nova.
   */
  async function admitManualQuoteBoleto(
    context: TenantContext,
    tx: Prisma.TransactionClient,
    quoteId: string
  ) {
    try {
      await createSubscriptionCommandAccess()(tx, context, {
        feature: 'onlinePayments',
        payment: { quoteId },
      })
    } catch (error) {
      if (!(error instanceof SubscriptionCommandError)) throw error
      throw obligationError(error.status, error.message, error.body)
    }
    // Charge barrier of the receiving account (ADR SaaS B.7.6): a subaccount not yet approved never issues.
    try {
      await assertReceivingAccountReady(tx, context.tenantId)
    } catch (error) {
      if (!(error instanceof ReceivingAccountNotReadyError)) throw error
      throw obligationError(error.status, error.message, error.body)
    }
  }

  function preparePayment(
    context: TenantContext,
    quoteId: string,
    manual: boolean
  ): Promise<QuoteBoletoInfo> {
    return withCancelledChargeProof({
      context,
      transaction: (operation) => withRentalTransaction(context, operation),
      lock: (tx) => lockQuoteBoleto(tx, context, quoteId),
      prepare: (tx) => prepareQuoteBoleto(context, tx, quoteId, manual),
      reader: readProviderCharge,
      failure: (kind) =>
        obligationError(
          CANCELLED_CHARGE_FAILURES[kind].status,
          CANCELLED_CHARGE_FAILURES[kind].message
        ),
    })
  }

  /** Accepted background work: its original admission remains valid. */
  function ensureQuoteBoletoPayment(context: TenantContext, quoteId: string) {
    return preparePayment(context, quoteId, false)
  }

  /** Manual HTTP commands must revalidate in every preparation transaction. */
  function requestQuoteBoletoPayment(
    principal: TenantPrincipal,
    quoteId: string
  ) {
    return preparePayment(principal, quoteId, true)
  }

  /**
   * Envio do boleto ao cliente: garante a obrigação, exige tentativa emitida e
   * não cancelada e enfileira uma notificação por tentativa (efeito fora do SQL).
   */
  async function requestQuoteBoletoDelivery(
    principal: TenantPrincipal,
    quoteId: string
  ) {
    const boleto = await requestQuoteBoletoPayment(principal, quoteId)
    await withTenantTransaction(principal, async (tx) => {
      // Issuance may have committed earlier. This new notification is a separate manual command.
      await admitManualQuoteBoleto(principal, tx, quoteId)
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          tenantId: principal.tenantId,
          paymentId: boleto.paymentId,
          status: { in: ['ISSUED', 'OVERDUE'] },
          cancellationStatus: 'NONE',
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!attempt?.externalId)
        throw obligationError(
          409,
          'Aguarde a emissão do boleto antes de solicitar o envio'
        )
      return enqueueOutbox(tx, {
        tenantId: principal.tenantId,
        topic: 'payment.boleto.notify',
        aggregateId: boleto.paymentId,
        payload: {
          paymentId: boleto.paymentId,
          externalId: attempt.externalId,
          requestedBy: principal.userId,
        },
        dedupeKey: 'payment.boleto.notify:' + attempt.id,
      })
    })
    return boleto
  }

  return {
    ensureQuoteBoletoPayment,
    requestQuoteBoletoPayment,
    requestQuoteBoletoDelivery,
  }
}

export type QuoteBoletos = ReturnType<typeof createQuoteBoletos>
