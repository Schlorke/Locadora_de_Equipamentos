import type {
  HttpClient,
  HttpJsonResponse,
  HttpTextResponse,
} from '../../../shared/api'
import {
  EQUIPMENT_LIST_URL,
  EQUIPMENT_LIST_CATEGORIES_URL,
} from '../../../entities/equipamento'

export function createAdminEquipmentsApi(client: HttpClient) {
  const json = <T>(path: string, method: string, body?: string) =>
    client.request<HttpJsonResponse<T>>(path, {
      method,
      responseType: 'json-response',
      ...(body !== undefined
        ? { body, headers: { 'Content-Type': 'application/json' } }
        : {}),
    })
  const equipment = (id: string) =>
    `/api/admin/equipments/${encodeURIComponent(id)}`
  const unit = (id: string) =>
    `/api/admin/equipment-units/${encodeURIComponent(id)}`
  type ErrorBody = { error?: string }
  return {
    upload: (multipart: FormData) =>
      client.request<HttpJsonResponse<{ url?: string; error?: string }>>(
        '/api/upload',
        { method: 'POST', multipart, responseType: 'json-response' }
      ),
    list: <T>() => json<T>(EQUIPMENT_LIST_URL, 'GET'),
    categories: <T>() => json<T>(EQUIPMENT_LIST_CATEGORIES_URL, 'GET'),
    get: <T>(id: string) => json<T>(equipment(id), 'GET'),
    create: (body: string) =>
      json<ErrorBody>('/api/admin/equipments', 'POST', body),
    update: (id: string, body: string) =>
      json<ErrorBody>(equipment(id), 'PUT', body),
    updateWithText: (id: string, body: string) =>
      client.request<HttpTextResponse>(equipment(id), {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
        responseType: 'text-response',
      }),
    remove: (id: string) => json<ErrorBody>(equipment(id), 'DELETE'),
    units: <T>(id: string) =>
      json<T>(
        `/api/admin/equipment-units?equipmentId=${encodeURIComponent(id)}`,
        'GET'
      ),
    createUnit: (body: string) =>
      json<ErrorBody>('/api/admin/equipment-units', 'POST', body),
    updateUnit: (id: string, body: string) =>
      json<ErrorBody>(unit(id), 'PATCH', body),
    removeUnit: (id: string) => json<ErrorBody>(unit(id), 'DELETE'),
  }
}
