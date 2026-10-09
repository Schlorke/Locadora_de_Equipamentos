import { Prisma } from '@prisma/client'
import type { TaxSettings } from '@gb-locacoes/domain/financeiro'

export type TaxSettingsReader = Pick<
  Prisma.TransactionClient,
  'financialSetting'
>

function dec(value: unknown): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  if (value === null || value === undefined) return new Prisma.Decimal(0)
  return new Prisma.Decimal(String(value))
}

/**
 * Configuração tributária vigente da locadora, lida na conexão informada. A
 * locadora é obrigatória: não há leitura global nem cliente Prisma implícito.
 */
export async function getCurrentTaxSettings(
  db: TaxSettingsReader,
  tenantId: string
): Promise<TaxSettings> {
  if (!tenantId?.trim()) throw new Error('Explicit tenant context is required')
  const setting = await db.financialSetting.findFirst({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
  })

  return {
    taxRegime: setting?.taxRegime ?? 'SIMPLES_NACIONAL',
    issRate: dec(setting?.issRate ?? 2.5),
    issExemptRental: setting?.issExemptRental ?? true,
    cpfRate: dec(setting?.cpfRate ?? 6),
    cnpjRate: dec(setting?.cnpjRate ?? 2.5),
    cniRate: dec(setting?.cniRate ?? 6),
    irpjPresumidoRate: setting?.irpjPresumidoRate
      ? dec(setting.irpjPresumidoRate)
      : null,
    csllPresumidoRate: setting?.csllPresumidoRate
      ? dec(setting.csllPresumidoRate)
      : null,
    pisCofinsRate: setting?.pisCofinsRate ? dec(setting.pisCofinsRate) : null,
    simplesAliquota: setting?.simplesAliquota
      ? dec(setting.simplesAliquota)
      : null,
    ibsCbsRate: setting?.ibsCbsRate ? dec(setting.ibsCbsRate) : null,
    ibsCbsActive: setting?.ibsCbsActive ?? false,
  }
}
