import type {
  HttpClient,
  HttpRequest,
  HttpJsonResponse,
} from '../../../shared/api'
import type { Quote, QuoteAdjustmentFromApi } from '../../../entities/orcamento'

type QuoteResponse = Quote & {
  quotes?: Quote[]
  pagination?: { totalItems: number; totalPages: number }
  quote?: Quote
  adjustments?: QuoteAdjustmentFromApi[]
  error?: string
  details?: unknown[]
  lateFee: number
  daysLate: number
}

export function createAdminQuotesApi(client: HttpClient) {
  const json = <T = QuoteResponse>(
    path: string,
    method: string,
    options: HttpRequest = {}
  ) =>
    client.request<HttpJsonResponse<T>>(path, {
      ...options,
      method,
      responseType: 'json-response',
      ...(options.body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json', ...options.headers },
          }
        : {}),
    })
  const quotePath = (id: string) =>
    `/api/admin/quotes/${encodeURIComponent(id)}`
  return {
    list: (query: string, options?: HttpRequest) =>
      json(`/api/admin/quotes?${query}`, 'GET', options),
    get: <T = QuoteResponse>(id: string) => json<T>(quotePath(id), 'GET'),
    update: (id: string, options: HttpRequest) =>
      json(quotePath(id), 'PATCH', options),
    remove: (id: string) => json(quotePath(id), 'DELETE'),
    adjustments: (id: string) => json(`${quotePath(id)}/adjustments`, 'GET'),
    addAdjustment: (id: string, options: HttpRequest) =>
      json(`${quotePath(id)}/adjustments`, 'POST', options),
    removeAdjustment: (id: string, adjustmentId: string) =>
      json(
        `${quotePath(id)}/adjustments/${encodeURIComponent(adjustmentId)}`,
        'DELETE'
      ),
    calculateLateFee: (id: string, options?: HttpRequest) =>
      json(`${quotePath(id)}/calculate-late-fee`, 'POST', options),
    sendAdjusted: (id: string) =>
      json(`${quotePath(id)}/send-adjusted-quote`, 'POST'),
  }
}
