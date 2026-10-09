import type { HttpClient, HttpJsonResponse } from '../../../shared/api'
import type { Category } from '../model/tipos'

export function createAdminCategoriesApi(client: HttpClient) {
  const path = (id: string) => `/api/admin/categories/${encodeURIComponent(id)}`
  const write = (url: string, method: string, body?: string) =>
    client.request<HttpJsonResponse<{ error?: string }>>(url, {
      method,
      responseType: 'json-response',
      ...(body !== undefined
        ? { body, headers: { 'Content-Type': 'application/json' } }
        : {}),
    })
  return {
    list: () =>
      client.request<
        HttpJsonResponse<Category[] | { categories?: Category[] }>
      >('/api/admin/categories', {
        method: 'GET',
        responseType: 'json-response',
      }),
    save: (id: string | null, body: string) =>
      id === null
        ? write('/api/admin/categories', 'POST', body)
        : write(path(id), 'PUT', body),
    remove: (id: string) => write(path(id), 'DELETE'),
  }
}
