import type { HttpClient, HttpTextResponse } from '../../../shared/api'
import type { DashboardStats, RevenueData, AgingData } from '../model/types'

export function createDashboardApi(client: HttpClient) {
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
    stats: () => read<DashboardStats>('/api/admin/dashboard'),
    quotes: () =>
      read<
        | Array<Record<string, unknown>>
        | { quotes?: Array<Record<string, unknown>> }
      >('/api/admin/quotes?limit=5'),
    revenue: () => read<RevenueData>('/api/admin/financial/revenue?months=12'),
    aging: () => read<AgingData>('/api/admin/financial/aging'),
  }
}
