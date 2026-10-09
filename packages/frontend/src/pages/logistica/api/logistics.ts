import type {
  HttpClient,
  HttpTextResponse,
  HttpJsonResponse,
} from '../../../shared/api'
import type { Delivery, Vehicle, Driver } from '../model/contracts'

export function createLogisticsApi(client: HttpClient) {
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
    upload: (multipart: FormData) =>
      client.request<HttpJsonResponse<{ url?: string; error?: string }>>(
        '/api/upload',
        { method: 'POST', multipart, responseType: 'json-response' }
      ),
    deliveries: () => read<{ deliveries?: Delivery[] }>('/api/admin/logistics'),
    vehicles: () =>
      read<{ vehicles?: Vehicle[] }>('/api/admin/vehicles?status=AVAILABLE'),
    drivers: () =>
      read<{ drivers?: Driver[] }>('/api/admin/drivers?status=ACTIVE'),
    update: (id: string, body: string) =>
      client.request<HttpTextResponse>(
        `/api/admin/logistics/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
          responseType: 'text-response',
        }
      ),
  }
}
