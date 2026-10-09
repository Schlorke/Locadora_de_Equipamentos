import { createCatalogService } from '@gb-locacoes/backend/catalog'
import type { CatalogService } from '@gb-locacoes/backend/catalog'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

function catalog() {
  const prisma = getDatabaseRuntime().prisma
  const { withRentalTransaction } = createRentalTransaction({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(prisma, context, operation),
  })
  return createCatalogService(prisma, { withRentalTransaction })
}

export function listCategories(
  ...args: Parameters<CatalogService['listCategories']>
) {
  return catalog().listCategories(...args)
}

export function createCategory(
  ...args: Parameters<CatalogService['createCategory']>
) {
  return catalog().createCategory(...args)
}

export function updateCategory(
  ...args: Parameters<CatalogService['updateCategory']>
) {
  return catalog().updateCategory(...args)
}

export function deleteCategory(
  ...args: Parameters<CatalogService['deleteCategory']>
) {
  return catalog().deleteCategory(...args)
}

export function listUnits(...args: Parameters<CatalogService['listUnits']>) {
  return catalog().listUnits(...args)
}

export function createUnit(...args: Parameters<CatalogService['createUnit']>) {
  return catalog().createUnit(...args)
}

export function readUnit(...args: Parameters<CatalogService['readUnit']>) {
  return catalog().readUnit(...args)
}

export function updateUnit(...args: Parameters<CatalogService['updateUnit']>) {
  return catalog().updateUnit(...args)
}

export function deleteUnit(...args: Parameters<CatalogService['deleteUnit']>) {
  return catalog().deleteUnit(...args)
}

export function readEquipment(
  ...args: Parameters<CatalogService['readEquipment']>
) {
  return catalog().readEquipment(...args)
}

export function listEquipments(
  ...args: Parameters<CatalogService['listEquipments']>
) {
  return catalog().listEquipments(...args)
}

export function createEquipment(
  ...args: Parameters<CatalogService['createEquipment']>
) {
  return catalog().createEquipment(...args)
}

export function updateEquipment(
  ...args: Parameters<CatalogService['updateEquipment']>
) {
  return catalog().updateEquipment(...args)
}

export function deleteEquipment(
  ...args: Parameters<CatalogService['deleteEquipment']>
) {
  return catalog().deleteEquipment(...args)
}
