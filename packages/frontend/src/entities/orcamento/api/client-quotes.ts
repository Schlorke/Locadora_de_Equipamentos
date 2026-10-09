import type { HttpClient } from '../../../shared/api'
import type { ClientQuoteDetail } from './client-quote-detail'

export interface ClientQuoteAddress {
  street?: string
  logradouro?: string
  number?: string
  numero?: string
  complement?: string
  complemento?: string
  neighborhood?: string
  bairro?: string
  city?: string
  cidade?: string
  state?: string
  estado?: string
  zipCode?: string
  cep?: string
}

export interface ClientQuote {
  id: string
  name: string
  email: string
  phone: string
  company?: string | null
  deliveryAddress?: string | ClientQuoteAddress | null
  deliveryType?: 'DELIVERY' | 'PICKUP' | null
  totalPrice: number
  originalTotal?: number | null
  finalTotal?: number | null
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  createdAt: string
  items?: Array<{
    id: string
    quantity: number
    days: number
    startDate?: string | null
    endDate?: string | null
    equipment: { id: string; name: string }
  }>
}

/** Conserva os envelopes aceitos pelos consumidores existentes. */
export function createClientQuoteApi(client: HttpClient) {
  return {
    list: () =>
      client.request<ClientQuote[] | { quotes: ClientQuote[] }>('/api/quotes'),
    read: (id: string) =>
      client.request<ClientQuoteDetail>(
        `/api/quotes/${encodeURIComponent(id)}`
      ),
    hide: (id: string) =>
      client.request<{ message: string }>(
        '/api/quotes/' + encodeURIComponent(id),
        { method: 'DELETE' }
      ),
  }
}
