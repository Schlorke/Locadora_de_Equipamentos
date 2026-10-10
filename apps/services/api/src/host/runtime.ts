import { createPublicCatalog } from '@gb-locacoes/backend/catalog'
import {
  consumeDirectorySearchRateLimit,
  identityRateLimitSecret,
  prismaRateLimitCounter,
  readPublicTenantCard,
  searchDirectory,
} from '@gb-locacoes/backend/directory'
import {
  clientIpFromHeaders,
  createPublicTenantResolver,
  withTenantTransaction,
  type PublicRequestTenant,
  type PublicRequestTenantOptions,
  type PublicTenant,
} from '@gb-locacoes/backend/identity'
import { createRentalAvailability } from '@gb-locacoes/backend/rentals'
import {
  createHealthHandler,
  createPublicCategoriesHandler,
  createPublicEquipmentsHandler,
  createPublicEquipmentSearchHandler,
  createPublicEquipmentAvailabilityHandler,
  createPublicEquipmentDetailHandler,
  createPublicTenantCardHandler,
  createPublicDirectorySearchHandler,
  createPublicSettingsHandler,
  createPublicStorefrontLegalHandler,
} from '@gb-locacoes/backend/http'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

// Fatos do modo do site (S13): o tipo do resolvedor exige os mesmos campos nos dois hosts.
const tenant = createPublicTenantResolver((slug) =>
  getDatabaseRuntime().prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      access: true,
      sitePublishedAt: true,
      siteIndexable: true,
    },
  })
)

export function resolvePublicTenant(
  slug: string
): Promise<PublicTenant | null> {
  return tenant.resolvePublicTenant(slug)
}

export function resolvePublicRequestTenant(
  request: Request,
  options: PublicRequestTenantOptions = {}
): Promise<PublicRequestTenant> {
  return tenant.resolvePublicRequestTenant(request, options)
}

export function resolveCurrentOrganizationTenant(
  request: Request
): Promise<PublicRequestTenant> {
  return tenant.resolveCurrentOrganizationTenant(request)
}

export const publicCategories = createPublicCategoriesHandler({
  resolveTenant: (request) => tenant.resolvePublicRequestTenant(request),
  listCategories: (context) =>
    createPublicCatalog(getDatabaseRuntime().prisma).listPublicCategories(
      context
    ),
})
export const health = createHealthHandler(
  () => getDatabaseRuntime().prisma.$queryRaw`SELECT 1`
)

export const publicEquipments = createPublicEquipmentsHandler({
  resolveTenant: (request) => tenant.resolvePublicRequestTenant(request),
  listEquipments: (context) =>
    createPublicCatalog(getDatabaseRuntime().prisma).listPublicEquipments(
      context
    ),
})
export const equipmentSearch = createPublicEquipmentSearchHandler({
  resolveTenant: (request) => tenant.resolvePublicRequestTenant(request),
  searchEquipments: (context, query) =>
    createPublicCatalog(getDatabaseRuntime().prisma).searchPublicEquipments(
      context,
      query
    ),
})
export const publicSettings = createPublicSettingsHandler({
  resolveTenant: (request, options) =>
    tenant.resolvePublicRequestTenant(request, options),
  getSettings: (context) =>
    createPublicCatalog(getDatabaseRuntime().prisma).getPublicSettings(context),
})
/** Textos legais da vitrine (onda 134): mantém a fábrica compartilhada após retirar a antiga lib/catalog.ts no clone F. */
export const publicStorefrontLegal = createPublicStorefrontLegalHandler({
  resolveTenant: (request, options) =>
    tenant.resolvePublicRequestTenant(request, options),
  getDocument: (context, kind) =>
    createPublicCatalog(getDatabaseRuntime().prisma).getPublicLegalDocument(
      context,
      kind
    ),
})

const rentalAvailability = createRentalAvailability({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(getDatabaseRuntime().prisma, context, operation),
})
export const equipmentAvailability = createPublicEquipmentAvailabilityHandler({
  resolveTenant: (request) => tenant.resolvePublicRequestTenant(request),
  calculateAvailability: (...args) =>
    rentalAvailability.calculateEquipmentCalendarAvailability(...args),
})

export const equipmentDetail = createPublicEquipmentDetailHandler({
  resolveTenant: (request) => tenant.resolvePublicRequestTenant(request),
  getEquipment: (context, id) =>
    createPublicCatalog(getDatabaseRuntime().prisma).getPublicEquipment(
      context,
      id
    ),
})

export const tenantCard = createPublicTenantCardHandler({
  resolveTenant: (request, options) =>
    tenant.resolvePublicRequestTenant(request, options),
  readCard: (subject) =>
    readPublicTenantCard(getDatabaseRuntime().prisma, subject),
})

export const directorySearch = createPublicDirectorySearchHandler({
  consumeLimit: (request, now) =>
    consumeDirectorySearchRateLimit(
      prismaRateLimitCounter(getDatabaseRuntime().prisma),
      {
        ip: clientIpFromHeaders(request.headers),
        secret: identityRateLimitSecret(process.env),
        now,
      }
    ),
  search: (query) => searchDirectory(getDatabaseRuntime().prisma, query),
})
