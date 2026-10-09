import type { HttpClient } from '../../../shared/api'

import type { ClientDocument } from '../model/contracts'

export function createClientDocumentsApi(client: HttpClient) {
  return {
    list(userId: string) {
      return client.request<{ documents: ClientDocument[] }>(
        `/api/admin/clients/${encodeURIComponent(userId)}/documents`
      )
    },
    upload(rentalId: string, body: FormData) {
      return client.request<{ document: ClientDocument }>(
        `/api/admin/rentals/${encodeURIComponent(rentalId)}/client-documents`,
        { method: 'POST', multipart: body }
      )
    },
  }
}
