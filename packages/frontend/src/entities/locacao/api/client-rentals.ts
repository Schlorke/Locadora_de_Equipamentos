import type { HttpClient, HttpBinaryResponse } from '../../../shared/api'
import type { ClientRentalDetail } from './client-rental-detail'

export interface ClientRental {
  id: string
  startdate: string
  enddate: string
  total: number
  status: string
  createdat?: string | Date | null
  notes?: string | null
  quoteId?: string | null
  quote?: { id: string; name: string; email: string } | null
  rental_items: Array<{
    id: string
    quantity: number
    totaldays: number
    includeWeekends?: boolean
    equipments: { id: string; name: string; images: string[] }
  }>
  payments?: Array<{
    id: string
    amount: number
    status: string
    method: string
  }>
}

/** Transporte do histórico; posse e soft delete continuam no servidor. */
export function createClientRentalApi(client: HttpClient) {
  return {
    list: () =>
      client.request<{ rentals: ClientRental[] }>('/api/client/rentals'),
    read: (id: string) =>
      client.request<{ rental: ClientRentalDetail }>(
        `/api/client/rentals/${encodeURIComponent(id)}`
      ),
    extend: (id: string, extensionDays: number) =>
      client.request<{ extensionFee: number }>(
        `/api/client/rentals/${encodeURIComponent(id)}/extend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extensionDays }),
        }
      ),
    requestExtension: (id: string, additionalDays: number) =>
      client.request<{ success: boolean; message: string }>(
        `/api/client/rentals/${encodeURIComponent(id)}/request-extension`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ additionalDays }),
        }
      ),
    requestPickup: (id: string) =>
      client.request<{ success: boolean; message: string }>(
        `/api/client/rentals/${encodeURIComponent(id)}/request-pickup`,
        { method: 'POST' }
      ),
    downloadContract: (id: string) =>
      client.request<HttpBinaryResponse>(
        `/api/contracts/${encodeURIComponent(id)}/download`,
        { responseType: 'binary' }
      ),
    hide: (id: string) =>
      client.request<{ message: string }>(
        '/api/client/rentals/' + encodeURIComponent(id),
        { method: 'DELETE' }
      ),
  }
}
