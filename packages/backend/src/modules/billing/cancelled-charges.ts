import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { enqueueOutbox } from '../outbox/index'
import { sameAmount } from './asaas-amount'
import { isChargePaid, type ProviderCharge } from './asaas'
import { BillingProviderError } from './asaas-http'

/**
 * Critério de prova de fim no provedor para cobranças PIX/boleto anuladas só no
 * sistema (onda 4, política aceita no lote "dinheiro"). Uma linha `CANCELLED`
 * com `transactionId` só deixa de ser cobrança viva com prova: tentativa desse
 * `transactionId` em `CANCELLED` ou com cancelamento `CONFIRMED`. Sem prova, a
 * cobrança é lida no provedor FORA de SQL e conciliada antes de qualquer
 * cobrança nova:
 *
 * - removida e não paga: grava a prova (tentativa `CANCELLED`/`CONFIRMED`);
 * - aberta com o mesmo valor e meio: a linha volta a ser a cobrança vigente;
 * - já paga: volta a ser a vigente e a confirmação segue pela outbox
 *   (`payment.provider.confirmed`);
 * - qualquer divergência (valor, meio, id, estorno, chargeback, 404, mais de uma
 *   aberta, outra cobrança vigente): nada muda e a resposta é conciliação.
 */

/** Cobrança lida no provedor e a integração ativa da locadora que a leu. */
export type ProviderChargeRead = {
  integrationId: string
  charge: ProviderCharge
}

/**
 * Leitura (sem efeito) de uma cobrança no provedor pela integração ativa da
 * locadora — por exemplo `createAsaasGateway(...).get(externalId)`. Fornecida
 * pela composição e chamada sempre fora de transação SQL.
 */
export type ProviderChargeReader = (
  _context: TenantContext,
  _externalId: string
) => Promise<ProviderChargeRead>

/** Meios cobrados pelo provedor: só eles deixam uma cobrança viva fora do sistema. */
const PROVIDER_METHODS: ReadonlySet<string> = new Set(['PIX', 'BOLETO'])

/** Cobrança local anulada (CANCELLED) cujo fim no provedor ainda não foi provado. */
export type UnverifiedCancelledCharge = {
  paymentId: string
  externalId: string
  method: string
  amount: Prisma.Decimal
  dueDate: Date
}

/** Linha de cobrança da obrigação, como o Prisma a devolve. */
export type ObligationChargeRow = {
  id: string
  method: string
  status: string
  transactionId: string | null
  amount: Prisma.Decimal
  dueDate: Date
}

/**
 * Por que a cobrança anterior impede uma nova: sem leitor do provedor
 * (`UNVERIFIED`), divergência a conciliar (`RECONCILE`), provedor indisponível
 * (`UNAVAILABLE`) ou provedor que recusou a consulta ou respondeu fora do
 * contrato (`GATEWAY`). Em todos os casos nenhuma cobrança nova sai.
 */
export type CancelledChargeFailure =
  'UNVERIFIED' | 'RECONCILE' | 'UNAVAILABLE' | 'GATEWAY'
export type CancelledChargeErrorFactory = (
  _failure: CancelledChargeFailure
) => Error

/** Status HTTP e mensagem de cada falha, iguais para PIX e boleto. */
export const CANCELLED_CHARGE_FAILURES: Readonly<
  Record<CancelledChargeFailure, { status: number; message: string }>
> = Object.freeze({
  UNVERIFIED: {
    status: 409,
    message:
      'Cobrança anterior cancelada só no sistema; confirme o cancelamento no provedor antes de emitir outra cobrança',
  },
  RECONCILE: {
    status: 409,
    message:
      'Cobrança anterior ainda consta no provedor; concilie a cobrança antes de emitir outra',
  },
  UNAVAILABLE: {
    status: 503,
    message:
      'Não foi possível confirmar a cobrança anterior no provedor; tente novamente',
  },
  GATEWAY: {
    status: 502,
    message:
      'O provedor recusou a consulta da cobrança anterior; verifique a integração de cobrança da locadora',
  },
})

type Verdict =
  | { kind: 'extinct' }
  | { kind: 'open'; overdue: boolean; paid: boolean }
  | { kind: 'reconcile' }

/**
 * O que o provedor diz da cobrança: `extinct` só com a cobrança removida e não
 * paga; `open` quando ainda pode ser (ou já foi) paga, com o mesmo valor e meio;
 * qualquer divergência (id, meio, valor, estorno, chargeback…) exige conciliação.
 */
export function cancelledChargeVerdict(
  row: Pick<UnverifiedCancelledCharge, 'externalId' | 'method' | 'amount'>,
  charge: ProviderCharge
): Verdict {
  if (charge.id !== row.externalId || charge.billingType !== row.method)
    return { kind: 'reconcile' }
  if (charge.deleted === true)
    return ['PENDING', 'OVERDUE'].includes(charge.status)
      ? { kind: 'extinct' }
      : { kind: 'reconcile' }
  if (!sameAmount(charge.value, row.amount)) return { kind: 'reconcile' }
  if (['PENDING', 'OVERDUE'].includes(charge.status))
    return { kind: 'open', overdue: charge.status === 'OVERDUE', paid: false }
  if (isChargePaid(charge.status))
    return { kind: 'open', overdue: false, paid: true }
  return { kind: 'reconcile' }
}

function reconciliationKey(
  context: TenantContext,
  paymentId: string,
  externalId: string
) {
  return `${context.tenantId}:payment:${paymentId}:reconcile:${externalId}`
}

/**
 * Linhas PIX/boleto `CANCELLED` com `transactionId` e sem prova de fim no
 * provedor. Sem `transactionId` a cobrança nunca foi emitida; `REFUNDED`
 * encerra a cobrança (foi paga e estornada).
 */
export async function findUnverifiedCancelledCharges(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  rows: ReadonlyArray<ObligationChargeRow>
): Promise<UnverifiedCancelledCharge[]> {
  const pending: UnverifiedCancelledCharge[] = []
  for (const row of rows) {
    if (
      row.status !== 'CANCELLED' ||
      !row.transactionId ||
      !PROVIDER_METHODS.has(row.method)
    )
      continue
    const proof = await tx.paymentAttempt.findFirst({
      where: {
        tenantId: context.tenantId,
        paymentId: row.id,
        externalId: row.transactionId,
        OR: [{ status: 'CANCELLED' }, { cancellationStatus: 'CONFIRMED' }],
      },
      select: { id: true },
    })
    if (!proof)
      pending.push({
        paymentId: row.id,
        externalId: row.transactionId,
        method: row.method,
        amount: row.amount,
        dueDate: row.dueDate,
      })
  }
  return pending
}

type CancelledChargeRead = {
  row: UnverifiedCancelledCharge
} & ProviderChargeRead

/** Lê no provedor cada cobrança anulada não verificada (fora de SQL). */
async function readCancelledCharges(
  reader: ProviderChargeReader | undefined,
  context: TenantContext,
  rows: ReadonlyArray<UnverifiedCancelledCharge>,
  failure: CancelledChargeErrorFactory
): Promise<CancelledChargeRead[]> {
  if (!reader) throw failure('UNVERIFIED')
  const reads: CancelledChargeRead[] = []
  for (const row of rows) {
    try {
      reads.push({ row, ...(await reader(context, row.externalId)) })
    } catch (error) {
      if (error instanceof BillingProviderError) {
        if (error.code === 'UNAVAILABLE') throw failure('UNAVAILABLE')
        if (
          error.code === 'INVALID_RESPONSE' ||
          (error.code === 'REJECTED' &&
            (error.reason === 'AUTHENTICATION' || error.reason === 'FORBIDDEN'))
        )
          throw failure('GATEWAY')
      }
      // Um 404 ou qualquer outra recusa nunca prova cancelamento.
      throw failure('RECONCILE')
    }
  }
  return reads
}

/**
 * Grava o que o provedor provou, sob o lock da emissão do chamador e só se a
 * linha ainda estiver como lida. Com divergência, só as provas de remoção são
 * gravadas e a resposta é `diverged`.
 */
async function reconcileCancelledCharges(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  reads: ReadonlyArray<CancelledChargeRead>,
  failure: CancelledChargeErrorFactory
): Promise<{ diverged: boolean }> {
  const verdicts = reads.map((read) => ({
    ...read,
    verdict: cancelledChargeVerdict(read.row, read.charge),
  }))
  const open = verdicts.filter((read) => read.verdict.kind === 'open')
  const diverged =
    open.length > 1 ||
    verdicts.some((read) => read.verdict.kind === 'reconcile')
  for (const read of verdicts) {
    if (diverged && read.verdict.kind !== 'extinct') continue
    const { row, integrationId, charge, verdict } = read
    const integration = await tx.tenantIntegration.findFirst({
      where: {
        id: integrationId,
        tenantId: context.tenantId,
        provider: 'ASAAS',
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    if (!integration) throw failure('RECONCILE')
    const current = await tx.payment.findFirst({
      where: {
        id: row.paymentId,
        tenantId: context.tenantId,
        status: 'CANCELLED',
        transactionId: row.externalId,
      },
      select: { quoteId: true, rentalId: true },
    })
    // Outra execução já conciliou esta linha: nada a gravar.
    if (!current) continue
    const attempt = await tx.paymentAttempt.findFirst({
      where: {
        tenantId: context.tenantId,
        integrationId,
        externalId: row.externalId,
      },
    })
    // Tentativa de outra cobrança, ou já paga/estornada aqui, contradiz o provedor.
    if (
      attempt &&
      (attempt.paymentId !== row.paymentId ||
        ['PAID', 'REFUNDED'].includes(attempt.status))
    )
      throw failure('RECONCILE')
    if (verdict.kind === 'extinct') {
      const cancelled = {
        cancellationStatus: 'CONFIRMED' as const,
        cancelledAt: new Date(),
      }
      if (attempt)
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { ...cancelled, status: 'CANCELLED' },
        })
      else
        await tx.paymentAttempt.create({
          data: {
            tenantId: context.tenantId,
            paymentId: row.paymentId,
            integrationId,
            provider: 'ASAAS',
            externalId: row.externalId,
            idempotencyKey: reconciliationKey(
              context,
              row.paymentId,
              row.externalId
            ),
            status: 'CANCELLED',
            ...cancelled,
            amount: row.amount,
            dueDate: row.dueDate,
            response: { reconciledFrom: 'PROVIDER_READ', deleted: true },
          },
        })
      continue
    }
    if (verdict.kind !== 'open') continue
    // A cobrança viva volta a ser a vigente só se nenhuma outra cobrança vigente surgiu.
    const competing = await tx.payment.findFirst({
      where: {
        tenantId: context.tenantId,
        id: { not: row.paymentId },
        type: { in: ['RENTAL', 'DEPOSIT'] },
        status: { in: ['PENDING', 'OVERDUE', 'PAID'] },
        ...(current.rentalId
          ? { rentalId: current.rentalId }
          : { quoteId: current.quoteId }),
      },
      select: { id: true },
    })
    if (competing) throw failure('RECONCILE')
    const registry = await tx.externalResourceTenant.upsert({
      where: {
        integrationId_resourceType_externalId: {
          integrationId,
          resourceType: 'PAYMENT',
          externalId: row.externalId,
        },
      },
      create: {
        integrationId,
        tenantId: context.tenantId,
        provider: 'ASAAS',
        resourceType: 'PAYMENT',
        externalId: row.externalId,
        resourceId: row.paymentId,
      },
      update: {},
    })
    if (
      registry.tenantId !== context.tenantId ||
      registry.resourceId !== row.paymentId ||
      registry.provider !== 'ASAAS'
    )
      throw failure('RECONCILE')
    const issued = verdict.overdue ? ('OVERDUE' as const) : ('ISSUED' as const)
    const reopened = attempt
      ? await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: issued, cancellationStatus: 'NONE' },
        })
      : await tx.paymentAttempt.create({
          data: {
            tenantId: context.tenantId,
            paymentId: row.paymentId,
            integrationId,
            provider: 'ASAAS',
            externalId: row.externalId,
            idempotencyKey: reconciliationKey(
              context,
              row.paymentId,
              row.externalId
            ),
            status: issued,
            amount: row.amount,
            dueDate: row.dueDate,
            response: {
              reconciledFrom: 'PROVIDER_READ',
              providerStatus: charge.status,
            },
          },
        })
    const reopenedPayment = await tx.payment.updateMany({
      where: {
        id: row.paymentId,
        tenantId: context.tenantId,
        status: 'CANCELLED',
        transactionId: row.externalId,
      },
      data: {
        status: verdict.overdue ? 'OVERDUE' : 'PENDING',
        billingStatus: verdict.overdue ? 'UNPAID' : 'AWAITING_PAYMENT',
        settledAt: null,
      },
    })
    if (reopenedPayment.count !== 1) throw failure('RECONCILE')
    if (verdict.paid)
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'payment.provider.confirmed',
        aggregateId: row.paymentId,
        payload: { paymentId: row.paymentId, externalId: row.externalId },
        dedupeKey: 'payment.provider.confirmed:' + reopened.id,
      })
  }
  return { diverged }
}

/** Resultado da preparação: pronto, ou cobranças anuladas a provar no provedor. */
export type CancelledChargeGate<T> =
  | { kind: 'ready'; value: T }
  | { kind: 'verify'; rows: UnverifiedCancelledCharge[] }

/**
 * Roda `prepare` (que decide e grava sob o lock do chamador) e, quando ela
 * encontra cobranças anuladas sem prova, lê o provedor entre duas transações e
 * concilia antes de preparar de novo. Nenhuma chamada ao provedor roda em SQL.
 * Depois de uma conciliação, uma segunda pendência significa que outra escrita
 * mudou o histórico: responde conciliação em vez de repetir.
 */
export async function withCancelledChargeProof<T>({
  context,
  transaction,
  lock,
  prepare,
  reader,
  failure,
}: {
  context: TenantContext
  transaction: <R>(
    _operation: (_tx: Prisma.TransactionClient) => Promise<R>
  ) => Promise<R>
  /** Lock de emissão da obrigação, o mesmo tomado por `prepare`. */
  lock: (_tx: Prisma.TransactionClient) => Promise<void>
  prepare: (_tx: Prisma.TransactionClient) => Promise<CancelledChargeGate<T>>
  /** Sem leitor, uma cobrança anulada sem prova responde `UNVERIFIED` (409). */
  reader: ProviderChargeReader | undefined
  failure: CancelledChargeErrorFactory
}): Promise<T> {
  for (let pass = 0; ; pass++) {
    const prepared = await transaction(prepare)
    if (prepared.kind === 'ready') return prepared.value
    if (pass > 0) throw failure('RECONCILE')
    const reads = await readCancelledCharges(
      reader,
      context,
      prepared.rows,
      failure
    )
    const { diverged } = await transaction(async (tx) => {
      await lock(tx)
      return reconcileCancelledCharges(tx, context, reads, failure)
    })
    if (diverged) throw failure('RECONCILE')
  }
}
