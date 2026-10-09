import type { HttpClient, HttpTextResponse } from '../../../shared/api'
import type { Maintenance } from '../model/contracts'

export function createMaintenanceApi(client: HttpClient) {
  const read = async <T>(path: string) => {
    const response = await client.request<HttpTextResponse>(path, {
      method: 'GET',
      responseType: 'text-response',
    })
    return {
      ...response,
      data: response.ok ? (JSON.parse(response.text) as T) : null,
    }
  }
  return {
    list: () =>
      read<{ maintenances?: Maintenance[] }>('/api/admin/maintenance'),
    scheduled: () =>
      read<unknown>('/api/admin/maintenance/scheduled?includeOverdue=true'),
  }
}
