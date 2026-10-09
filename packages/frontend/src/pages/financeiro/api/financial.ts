import type {
  HttpClient,
  HttpRequest,
  HttpJsonResponse,
  HttpBinaryResponse,
} from '../../../shared/api'
import type {
  FinancialEntry,
  FinancialTotals,
  FinancialSettings,
  RevenueData,
  CategoryRevenue,
  AgingData,
  Debtor,
  AdjustmentHistoryItem,
} from '../model/tipos'

type FinancialResponse = {
  error?: string
  entries?: FinancialEntry[]
  totals?: FinancialTotals
  events?: Array<Record<string, unknown>>
  settings?: FinancialSettings
  revenueHistory?: RevenueData[]
  revenueByCategory?: CategoryRevenue[]
  agingData?: AgingData[]
  topDebtors?: Debtor[]
  delinquencyRate?: number
  adjustments?: AdjustmentHistoryItem[]
}

export function createFinancialApi(client: HttpClient) {
  const json = (path: string, method: string, options: HttpRequest = {}) =>
    client.request<HttpJsonResponse<FinancialResponse>>(path, {
      ...options,
      method,
      responseType: 'json-response',
      ...(options.body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json', ...options.headers },
          }
        : {}),
    })
  const queryPath = (name: string, query = '') =>
    `/api/admin/financial/${name}${query ? '?' + query : ''}`
  const quotePath = (id: string) =>
    `/api/admin/quotes/${encodeURIComponent(id)}/adjustments`
  return {
    entries: (query: string, options?: HttpRequest) =>
      json(queryPath('entries', query), 'GET', options),
    calendar: (query: string, options?: HttpRequest) =>
      json(queryPath('calendar', query), 'GET', options),
    revenue: (query: string, options?: HttpRequest) =>
      json(queryPath('revenue', query), 'GET', options),
    aging: (query: string, options?: HttpRequest) =>
      json(queryPath('aging', query), 'GET', options),
    settings: () => json('/api/admin/financial/settings', 'GET'),
    saveSettings: (options: HttpRequest) =>
      json('/api/admin/financial/settings', 'PATCH', options),
    status: (id: string, options: HttpRequest) =>
      json(
        `/api/admin/financial/entries/${encodeURIComponent(id)}/status`,
        'PATCH',
        options
      ),
    remove: (id: string) =>
      json(`/api/admin/financial/entries/${encodeURIComponent(id)}`, 'DELETE'),
    adjustments: (id: string) => json(quotePath(id), 'GET'),
    addAdjustment: (id: string, options: HttpRequest) =>
      json(quotePath(id), 'POST', options),
    removeAdjustment: (id: string, adjustmentId: string) =>
      json(`${quotePath(id)}/${encodeURIComponent(adjustmentId)}`, 'DELETE'),
    exportFile: (query: string) =>
      client.request<HttpBinaryResponse>(
        `/api/admin/financial/export?${query}`,
        { responseType: 'binary' }
      ),
  }
}
