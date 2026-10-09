import type { PrismaClient } from '@prisma/client'
import { createCategoryAdmin } from './categories'
import { createEquipmentAdmin } from './equipments'
import { createPublicCatalog } from './public'
import type { CatalogDependencies } from './types'
import { createUnitAdmin } from './units'

/**
 * Catálogo por locadora: leituras públicas (locadora resolvida pelo adaptador a
 * partir do tenantSlug) e administração de categorias, equipamentos e unidades
 * físicas. Leituras públicas usam a transação de identity com `app.tenant_id`;
 * toda operação administrativa usa o executor de mutação injetado.
 */
export function createCatalogService(
  prisma: PrismaClient,
  deps: CatalogDependencies
) {
  return {
    ...createPublicCatalog(prisma),
    ...createCategoryAdmin(deps),
    ...createEquipmentAdmin(deps),
    ...createUnitAdmin(deps),
  }
}

export type CatalogService = ReturnType<typeof createCatalogService>
