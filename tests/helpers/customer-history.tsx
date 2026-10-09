import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../packages/frontend/src/shared/api'
import { PublicTenantProvider } from '../../packages/frontend/src/entities/organizacao'
import { NavigationProvider } from '../../packages/ui/src/contract/navigation'
import { FrontendSessionFixture } from './frontend-session'
import type { ReactNode } from 'react'
export const historyRental = {
  id: 'r 1',
  quoteId: 'converted',
  startdate: '2030-01-01T12:00:00Z',
  enddate: '2030-01-04T12:00:00Z',
  total: '100.50',
  status: 'ACTIVE',
  lateFee: '5.25',
  notes: 'Obra Alfa',
  rental_items: [
    {
      id: 'i',
      quantity: 2,
      totaldays: 3,
      totalprice: '100.50',
      priceperday: '16.75',
      equipments: {
        id: 'e',
        name: 'Betoneira Alfa',
        images: ['/equipment.png'],
      },
    },
  ],
  quote: {
    id: 'converted',
    name: 'Ana',
    email: 'ana@example.test',
    total: '100.50',
    finalTotal: '80.50',
    deliveryFee: '10.00',
    pickupFee: '5.00',
  },
  payments: [
    {
      id: 'p',
      status: 'PAID',
      method: 'PIX',
      amount: '80.50',
      dueDate: '2030-01-01T12:00:00Z',
      paidAt: '2030-01-01T12:00:00Z',
    },
  ],
}
export const historyQuote = {
  id: 'q 1',
  quoteCode: 'Q-ALFA',
  name: 'Ana',
  email: 'ana@example.test',
  phone: '',
  totalPrice: 100,
  originalTotal: 100,
  finalTotal: 0,
  status: 'pending',
  createdAt: '2030-01-01T12:00:00Z',
  updatedAt: '2030-01-01T12:00:00Z',
  priceAdjustmentReason: '[Outro] Cortesia',
  deliveryType: 'DELIVERY',
  deliveryFee: 10,
  pickupFee: 5,
  deliveryAddress: {
    street: 'Rua Um',
    number: '10',
    city: 'São Paulo',
    state: 'SP',
  },
  items: [
    {
      id: 'iq',
      quantity: 1,
      days: 3,
      pricePerDay: 10,
      total: 0,
      appliedDiscount: 100,
      appliedPeriod: 'weekly',
      startDate: '2030-01-01T12:00:00Z',
      endDate: '2030-01-03T12:00:00Z',
      includeWeekends: false,
      equipment: { id: 'eq', name: 'Martelete Alfa', images: [] },
    },
  ],
  payments: [],
}
export function historyTree(
  children: ReactNode,
  client: HttpClient,
  userId = 'ana',
  slug = 'alfa',
  navigate = (href: string) => {
    void href
  }
) {
  return (
    <FrontendSessionFixture userId={userId}>
      <ApiClientProvider client={client}>
        <PublicTenantProvider value={slug}>
          <NavigationProvider navigate={navigate}>
            {children}
          </NavigationProvider>
        </PublicTenantProvider>
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
}
export function nativeHistoryApi(fetcher: typeof fetch) {
  return createHttpClient({
    baseUrl: 'https://api.example.test',
    credentials: 'omit',
    getHeaders: () => ({
      'x-tenant-id': 'alfa',
      Authorization: 'Bearer fixture',
    }),
    fetcher,
  })
}
