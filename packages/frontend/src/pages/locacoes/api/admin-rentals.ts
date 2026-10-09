import type { HttpClient } from '../../../shared/api'
import type { Rental as AdminRental } from '../model/contracts'

export function createAdminRentalsApi(client: HttpClient) {
  return {
    list() {
      return client.request<{ rentals: AdminRental[] }>('/api/admin/rentals')
    },
    generateContract(rentalId: string) {
      return client.request<{ contract: NonNullable<AdminRental['contract']> }>(
        `/api/admin/rentals/${encodeURIComponent(rentalId)}/contract`,
        { method: 'POST' }
      )
    },
    checkIn(rentalId: string, checkInAt: string) {
      return client.request(
        `/api/admin/rentals/${encodeURIComponent(rentalId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkInAt, status: 'ACTIVE' }),
        }
      )
    },
    checkOut(rentalId: string, checkOutAt: string) {
      return client.request(
        `/api/admin/rentals/${encodeURIComponent(rentalId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkOutAt, status: 'COMPLETED' }),
        }
      )
    },
  }
}
