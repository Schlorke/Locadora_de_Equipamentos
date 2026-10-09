import { isTenantSlug } from '@gb-locacoes/contracts/platform'
import { parsePublicEquipment } from '@gb-locacoes/contracts'
import { HttpError, type HttpClient } from '../../../shared/api'

export function createPublicEquipmentApi(client: HttpClient) {
  return {
    async read(tenantSlug: string | null, id: string) {
      if (!isTenantSlug(tenantSlug) || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
        return null
      try {
        const body = await client.request<unknown>(
          `/api/equipments/${encodeURIComponent(id)}?${new URLSearchParams({ tenantSlug })}`
        )
        const equipment = parsePublicEquipment(body)
        if (!equipment) throw new Error('Resposta inválida do catálogo.')
        return equipment
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return null
        throw error
      }
    },
  }
}
