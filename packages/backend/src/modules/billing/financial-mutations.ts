import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantPrincipal } from '../identity/index'
import {
  RentalMutationError,
  type RentalTransaction,
  type TenantTransactionRunner,
} from '../rentals/index'
import type {
  FinancialSettingsInput,
  FinancialStatusInput,
} from '@gb-locacoes/contracts/financial'
import { financialSettingNumber as toNum } from './financial-rates'
import { processPaymentInTransaction } from './payment-processor'
import { admitRentalCommand } from '../entitlements/command-admission'

export function createFinancialMutations({
  withTenantTransaction,
  withRentalTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
}) {
  function updateFinancialSettings(
    context: TenantPrincipal,
    readPayload: () => Promise<FinancialSettingsInput>
  ) {
    return withTenantTransaction(context, async (prisma) => {
      const payload = await readPayload()
      const saved = await prisma.financialSetting.create({
        data: {
          tenantId: context.tenantId,
          cpfRate: payload.cpfRate,
          cnpjRate: payload.cnpjRate,
          cniRate: payload.cniRate,
          taxRegime: payload.taxRegime,
          issRate: payload.issRate,
          issExemptRental: payload.issExemptRental,
          irpjPresumidoRate: payload.irpjPresumidoRate,
          csllPresumidoRate: payload.csllPresumidoRate,
          pisCofinsRate: payload.pisCofinsRate,
          simplesAnexo: payload.simplesAnexo,
          simplesAliquota: payload.simplesAliquota,
          ibsCbsRate: payload.ibsCbsRate,
          ibsCbsActive: payload.ibsCbsActive,
          updatedBy: context.userId,
        },
      })

      return {
        settings: {
          id: saved.id,
          cpfRate: Number(saved.cpfRate),
          cnpjRate: Number(saved.cnpjRate),
          cniRate: Number(saved.cniRate),
          taxRegime: saved.taxRegime,
          issRate: Number(saved.issRate),
          issExemptRental: saved.issExemptRental,
          irpjPresumidoRate: toNum(saved.irpjPresumidoRate),
          csllPresumidoRate: toNum(saved.csllPresumidoRate),
          pisCofinsRate: toNum(saved.pisCofinsRate),
          simplesAnexo: saved.simplesAnexo,
          simplesAliquota: toNum(saved.simplesAliquota),
          ibsCbsRate: toNum(saved.ibsCbsRate),
          ibsCbsActive: saved.ibsCbsActive,
          updatedAt: saved.updatedAt,
          updatedBy: saved.updatedBy,
        },
      }
    })
  }
  function updateFinancialStatus(
    context: TenantPrincipal,
    id: string,
    input: FinancialStatusInput
  ) {
    return withRentalTransaction(context, async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { id, tenantId: context.tenantId },
      })
      if (!existing)
        throw new RentalMutationError(
          'Lançamento financeiro não encontrado',
          404
        )
      await admitRentalCommand(tx, context, { settlement: input })
      if (
        ['PAID', 'CANCELLED', 'REFUNDED'].includes(existing.status) &&
        ['UNPAID', 'AWAITING_PAYMENT'].includes(input.billingStatus)
      )
        throw new RentalMutationError(
          'Pagamento confirmado ou encerrado não pode ser reaberto',
          409,
          'PAYMENT_RECONCILIATION_REQUIRED'
        )
      if (
        input.billingStatus === 'PAID' &&
        ['CANCELLED', 'REFUNDED'].includes(existing.status)
      )
        throw new RentalMutationError(
          'Pagamento encerrado requer conciliação',
          409,
          'PAYMENT_RECONCILIATION_REQUIRED'
        )
      if (
        input.billingStatus === 'AWAITING_PAYMENT' &&
        existing.status === 'OVERDUE'
      )
        throw new RentalMutationError(
          'Reemita a cobrança com novo vencimento antes de reabrir',
          409,
          'PAYMENT_REISSUE_REQUIRED'
        )
      if (input.billingStatus === 'PAID' || input.billingStatus === 'UNPAID')
        await processPaymentInTransaction(context, tx, id, {
          status: input.billingStatus === 'PAID' ? 'PAID' : 'OVERDUE',
          paidAt: input.paidAt ?? undefined,
        })
      return tx.payment.update({
        where: { id, tenantId: context.tenantId },
        data: {
          billingStatus: input.billingStatus,
          invoiceNumber: input.invoiceNumber ?? undefined,
          invoiceIssuedAt: input.invoiceIssuedAt ?? undefined,
          boletoIssuedAt: input.boletoIssuedAt ?? undefined,
          ...(input.billingStatus === 'SETTLED'
            ? { settledAt: new Date() }
            : {}),
        },
        select: {
          id: true,
          status: true,
          billingStatus: true,
          invoiceNumber: true,
          invoiceIssuedAt: true,
          boletoIssuedAt: true,
          paidAt: true,
          settledAt: true,
        },
      })
    })
  }
  async function inspectFinancialEntryDeletion(
    context: TenantContext,
    id: string
  ) {
    const payment = await withTenantTransaction(context, (tx) =>
      tx.payment.findFirst({
        where: { id, tenantId: context.tenantId },
        select: { id: true },
      })
    )
    return payment ? ('HISTORY_PRESERVED' as const) : ('NOT_FOUND' as const)
  }
  return {
    updateFinancialSettings,
    updateFinancialStatus,
    inspectFinancialEntryDeletion,
  }
}
