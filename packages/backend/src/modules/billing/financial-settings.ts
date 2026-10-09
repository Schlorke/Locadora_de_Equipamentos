import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
import { financialSettingNumber as toNum } from './financial-rates'
export function createFinancialSettings({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  return {
    readFinancialSettings(context: TenantContext) {
      return withTenantTransaction(context, async (prisma) => {
        const latest = await prisma.financialSetting.findFirst({
          where: { tenantId: context.tenantId },
          orderBy: { updatedAt: 'desc' },
        })

        if (!latest) {
          return {
            settings: {
              cpfRate: 6.0,
              cnpjRate: 2.5,
              cniRate: 6.0,
              taxRegime: 'SIMPLES_NACIONAL',
              issRate: 2.5,
              issExemptRental: true,
              irpjPresumidoRate: null,
              csllPresumidoRate: null,
              pisCofinsRate: null,
              simplesAnexo: 'III',
              simplesAliquota: null,
              ibsCbsRate: null,
              ibsCbsActive: false,
            },
          }
        }

        return {
          settings: {
            id: latest.id,
            cpfRate: Number(latest.cpfRate),
            cnpjRate: Number(latest.cnpjRate),
            cniRate: Number(latest.cniRate),
            taxRegime: latest.taxRegime,
            issRate: Number(latest.issRate),
            issExemptRental: latest.issExemptRental,
            irpjPresumidoRate: toNum(latest.irpjPresumidoRate),
            csllPresumidoRate: toNum(latest.csllPresumidoRate),
            pisCofinsRate: toNum(latest.pisCofinsRate),
            simplesAnexo: latest.simplesAnexo,
            simplesAliquota: toNum(latest.simplesAliquota),
            ibsCbsRate: toNum(latest.ibsCbsRate),
            ibsCbsActive: latest.ibsCbsActive,
            updatedAt: latest.updatedAt,
            updatedBy: latest.updatedBy,
          },
        }
      })
    },
  }
}
