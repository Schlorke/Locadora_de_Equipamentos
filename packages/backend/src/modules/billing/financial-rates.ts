import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  DEFAULT_FINANCIAL_RATES,
  type FinancialRateSnapshot,
} from '@gb-locacoes/domain/financeiro'

type FinancialRatesReader = Pick<Prisma.TransactionClient, 'financialSetting'>
export async function getCurrentFinancialRates(
  context: TenantContext,
  db: FinancialRatesReader
): Promise<FinancialRateSnapshot> {
  const currentSetting = await db.financialSetting.findFirst({
    where: { tenantId: context.tenantId },
    orderBy: { updatedAt: 'desc' },
    select: {
      cpfRate: true,
      cnpjRate: true,
      cniRate: true,
    },
  })

  if (!currentSetting) {
    return DEFAULT_FINANCIAL_RATES
  }

  return {
    cpfRate: Number(currentSetting.cpfRate),
    cnpjRate: Number(currentSetting.cnpjRate),
    cniRate: Number(currentSetting.cniRate),
  }
}
export function normalizeFinancialMoney(
  value: Prisma.Decimal | null,
  fallback = 0
): number {
  if (!value) return fallback
  return Number(value)
}
export function financialSettingNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  return Number(v)
}
