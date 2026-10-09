import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'

/**
 * Executor de mutação do catálogo fornecido pela composição: transação com
 * `app.tenant_id` local, verificação da locadora ativa e lock de mutação da
 * locadora, nessa ordem. O módulo não conhece a implementação do lock.
 */
export type CatalogTransaction = <T>(
  _context: TenantContext,
  _operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => Promise<T>

export type CatalogDependencies = {
  withRentalTransaction: CatalogTransaction
}

/**
 * Entrada lida pelo serviço somente depois das verificações de posse, como no
 * contrato HTTP legado (registro inexistente responde 404 antes de o corpo ser
 * lido ou validado).
 */
export type DeferredInput<T> = () => Promise<T>
