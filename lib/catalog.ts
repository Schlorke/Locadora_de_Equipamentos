import { createCatalogService } from '@gb-locacoes/backend/catalog'
import { createPublicStorefrontLegalHandler } from '@gb-locacoes/backend/http'
import { prisma } from '@/lib/prisma'
import { withRentalTransaction } from '@/lib/rental-transaction'
import { resolvePublicRequestTenant } from '@/lib/tenant'

export { CatalogError } from '@gb-locacoes/backend/catalog'
export type {
  CategoryInput,
  CategoryPatch,
  EquipmentBody,
  UnitCreateInput,
  UnitPatch,
} from '@gb-locacoes/backend/catalog'

export const {
  listPublicCategories,
  listPublicEquipments,
  getPublicEquipment,
  searchPublicEquipments,
  getPublicSettings,
  getPublicLegalDocument,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listEquipments,
  createEquipment,
  readEquipment,
  updateEquipment,
  deleteEquipment,
  listUnits,
  createUnit,
  readUnit,
  updateUnit,
  deleteUnit,
} = createCatalogService(prisma, { withRentalTransaction })

/**
 * `GET /api/settings/public/legal-documents/{kind}` (onda 134): a mesma fábrica do serviço
 * (`apps/services/api/src/host/runtime.ts`), com o resolvedor público e a leitura do catálogo deste host.
 */
export const publicStorefrontLegal = createPublicStorefrontLegalHandler({
  resolveTenant: (request, options) =>
    resolvePublicRequestTenant(request, options),
  getDocument: (context, kind) => getPublicLegalDocument(context, kind),
})
