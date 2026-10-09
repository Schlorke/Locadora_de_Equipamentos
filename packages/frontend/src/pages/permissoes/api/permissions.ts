import type { HttpClient } from '../../../shared/api'

export interface Permission {
  id: string
  role: string
  module: string
  action: string
}
export function createPermissionsApi(client: HttpClient) {
  return {
    list: () =>
      client.request<{ permissions: Permission[] }>('/api/admin/permissions'),
    save: (permissions: Permission[], role: string) =>
      client.request('/api/admin/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: permissions.filter((p) => p.role === role),
        }),
      }),
  }
}
