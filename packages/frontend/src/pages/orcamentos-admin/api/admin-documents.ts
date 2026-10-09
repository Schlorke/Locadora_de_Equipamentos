import type { HttpBinaryResponse, HttpClient } from '../../../shared/api'

export function createAdminQuoteDocumentsApi(client: HttpClient) {
  return {
    adjustments(quoteId: string) {
      return client.request<HttpBinaryResponse>(
        `/api/admin/quotes/${encodeURIComponent(quoteId)}/adjustments/download`,
        { responseType: 'binary' }
      )
    },
  }
}
