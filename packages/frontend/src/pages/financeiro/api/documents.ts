import type { HttpClient, HttpBinaryResponse } from '../../../shared/api'

export function createFinancialDocumentsApi(client: HttpClient) {
  return {
    oficio(entryId: string) {
      return client.request<HttpBinaryResponse>(
        `/api/admin/financial/entries/${encodeURIComponent(entryId)}/pdf-oficio`,
        { responseType: 'binary' }
      )
    },
  }
}
