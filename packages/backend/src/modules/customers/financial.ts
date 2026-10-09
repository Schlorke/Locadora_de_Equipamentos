import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'

/**
 * ClientProfile da locadora indexado pelo usuário, com CPF/CNPJ inferidos
 * pelos dígitos do documento. Executa na transação do chamador.
 */
export async function loadFinancialCustomers(
  context: TenantContext,
  db: Prisma.TransactionClient
) {
  const rows = await db.clientProfile.findMany({
    where: { tenantId: context.tenantId, userId: { not: null } },
  })
  return new Map(
    rows.map((profile) => [
      profile.userId!,
      {
        ...profile,
        cpf:
          profile.document?.replace(/\D/g, '').length === 11
            ? profile.document
            : null,
        cnpj:
          profile.document?.replace(/\D/g, '').length === 14
            ? profile.document
            : null,
      },
    ])
  )
}
