import type { HttpClient, HttpJsonResponse } from '../../../shared/api'
import type { BoletoIssuanceResponse } from '../model/issuance'

type BoletoCommandResponse = BoletoIssuanceResponse & {
  error?: string
  entry?: { id: string; dueDate: string; billingStatus: string }
}

export function createAdminPaymentApi(client: HttpClient) {
  return {
    generateForQuote(quoteId: string) {
      return client.request<HttpJsonResponse<BoletoCommandResponse | null>>(
        `/api/admin/quotes/${encodeURIComponent(quoteId)}/generate-boleto`,
        { method: 'POST', responseType: 'json-response' }
      )
    },
    regenerate(paymentId: string) {
      return client.request<HttpJsonResponse<BoletoCommandResponse | null>>(
        `/api/payments/boleto/${encodeURIComponent(paymentId)}/regenerate`,
        { method: 'PUT', responseType: 'json-response' }
      )
    },
    updateDueDate(paymentId: string, dueDate: string | null) {
      return client.request<HttpJsonResponse<BoletoCommandResponse | null>>(
        `/api/admin/financial/entries/${encodeURIComponent(paymentId)}/due-date`,
        {
          method: 'PATCH',
          responseType: 'json-response',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dueDate }),
        }
      )
    },
  }
}
