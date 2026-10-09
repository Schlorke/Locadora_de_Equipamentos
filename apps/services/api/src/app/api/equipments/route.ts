import { publicEquipments } from '../../../host/runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Lista equipamentos da locadora selecionada.
 * @description tenantSlug obrigatório. Sem locadora padrão; recursos de outras locadoras não são retornados.
 * @tag Equipments
 * @query PublicTenantQuery
 * @response 200: PublicEquipmentList: Catálogo da locadora
 * @response 404:PublicApiError: Locadora inexistente ou inativa
 * @response 409:PublicApiError: Selecione uma locadora
 * @openapi
 */
export const GET = publicEquipments
