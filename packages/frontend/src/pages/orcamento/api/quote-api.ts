import type { HttpClient } from '../../../shared/api'
import {
  createCustomerApi,
  type CustomerAddress,
  type CustomerProfileUpdate,
} from '../../../entities/cliente'
import {
  buildQuoteRequestBody,
  type QuoteRequestForm,
  type QuoteRequestItemInput,
} from '../../../entities/orcamento'

/** Transporte da tela; cálculos, ownership e validações continuam no backend. */
export function createQuoteApi(client: HttpClient, tenantSlug: string | null) {
  const customer = createCustomerApi(client)
  function requireTenant() {
    if (!tenantSlug)
      throw new Error('Selecione uma locadora para solicitar orçamento.')
    return tenantSlug
  }
  function tenantPath(path: string) {
    return (
      path +
      (path.includes('?') ? '&' : '?') +
      new URLSearchParams({ tenantSlug: requireTenant() })
    )
  }
  function json(body: unknown) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  }
  return {
    equipments<T>() {
      return client.request<T[]>(tenantPath('/api/equipments'))
    },
    availability(equipmentId: string, startDate: string, endDate: string) {
      const query = new URLSearchParams({ startDate, endDate })
      return client.request<{
        availability?: Record<
          string,
          { available: boolean; availableQuantity: number }
        >
      }>(
        tenantPath(
          `/api/equipments/${encodeURIComponent(equipmentId)}/availability?${query}`
        )
      )
    },
    profile() {
      requireTenant()
      return customer.profile()
    },
    addresses() {
      requireTenant()
      return customer.addresses()
    },
    saveProfile(input: CustomerProfileUpdate) {
      requireTenant()
      return customer.updateProfile(input)
    },
    saveAddress(input: Omit<CustomerAddress, 'id'>) {
      requireTenant()
      return customer.createAddress(input)
    },
    submit(form: QuoteRequestForm, items: QuoteRequestItemInput[]) {
      requireTenant()
      return client.request<{ id: string }>('/api/quotes', {
        method: 'POST',
        ...json({ ...buildQuoteRequestBody(form, items), tenantSlug }),
      })
    },
    submitLegacy(input: Record<string, unknown>) {
      return client.request<{ success: boolean; message?: string }>(
        '/api/orcamentos',
        {
          method: 'POST',
          ...json({ ...input, tenantSlug: requireTenant() }),
        }
      )
    },
  }
}
