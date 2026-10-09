import type {
  AddressInput,
  AddressPatch,
} from '@gb-locacoes/contracts/addresses'
import type { HttpClient } from '../../../shared/api'

export interface CustomerProfile {
  phone?: string | null
  cpf?: string | null
  cnpj?: string | null
  company?: string | null
}
export type CustomerProfileUpdate = Partial<
  Record<keyof CustomerProfile, string>
>

export interface CustomerAddress {
  id: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isPrimary: boolean
}

export interface CustomerActivity {
  id: string
  type:
    | 'quote_created'
    | 'quote_approved'
    | 'quote_rejected'
    | 'rental_created'
    | 'rental_completed'
    | 'payment_made'
    | 'rental_updated'
  title: string
  description: string
  timestamp: string
  link?: string
  metadata?: { amount?: number; status?: string; itemCount?: number }
}

/** Dados privados; o cliente fornece seleção/cookies, o servidor valida a posse. */
export function createCustomerApi(client: HttpClient) {
  const json = (body: unknown) => ({
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const addressPath = (id: string) => '/api/addresses/' + encodeURIComponent(id)
  return {
    activities: () =>
      client.request<{ activities: CustomerActivity[] }>(
        '/api/client/activities?limit=10'
      ),
    profile: () =>
      client.request<{ user: CustomerProfile }>('/api/user/profile'),
    updateProfile: (input: CustomerProfileUpdate) =>
      client.request<{ success: true; user: CustomerProfile }>(
        '/api/user/profile',
        {
          method: 'PUT',
          ...json(input),
        }
      ),
    addresses: () =>
      client.request<{ addresses: CustomerAddress[] }>('/api/addresses'),
    createAddress: (input: AddressInput) =>
      client.request<{ address: CustomerAddress }>('/api/addresses', {
        method: 'POST',
        ...json(input),
      }),
    updateAddress: (id: string, input: AddressPatch) =>
      client.request<{ address: CustomerAddress }>(addressPath(id), {
        method: 'PATCH',
        ...json(input),
      }),
    deleteAddress: (id: string) =>
      client.request<{ message: string }>(addressPath(id), {
        method: 'DELETE',
      }),
  }
}
