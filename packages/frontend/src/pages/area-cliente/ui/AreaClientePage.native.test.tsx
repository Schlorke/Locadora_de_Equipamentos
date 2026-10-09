// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { PublicTenantProvider } from '../../../entities/organizacao'
import { NavigationProvider } from '../../../../../ui/src/contract/navigation'
import { useCartStore, type CartItem } from '../../../features/carrinho'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
  error: vi.fn(),
  success: vi.fn(),
  storage: new Map<string, string>(),
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  toast: { error: captured.error, success: captured.success },
}))
vi.mock('../../../shared/storage', () => ({
  keyValueStorage: {
    getItem: async (key: string) => captured.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      captured.storage.set(key, value)
    },
  },
}))
import { AreaClientePage } from './AreaClientePage.native'

const rental = {
  id: 'r 1',
  status: 'ACTIVE',
  startdate: '2026-10-01',
  enddate: '2026-10-05',
  total: 125.5,
  rental_items: [
    {
      id: 'i',
      quantity: 2,
      totaldays: 4,
      equipments: { id: 'eq', name: 'Betoneira Alfa', images: [] },
    },
  ],
}
const quote = {
  id: 'q 1',
  name: 'Ana',
  email: 'ana@example.test',
  phone: '',
  status: 'pending',
  finalTotal: 0,
  originalTotal: 42.5,
  totalPrice: 99,
  createdAt: '2026-10-01',
  items: [
    {
      id: 'iq',
      quantity: 1,
      days: 2,
      equipment: { id: 'eq-q', name: 'Martelete Alfa' },
    },
  ],
  deliveryType: 'DELIVERY',
  deliveryAddress: {
    street: 'Rua Um',
    number: '10',
    city: 'São Paulo',
    state: 'SP',
  },
}
const activity = {
  id: 'activity-a',
  type: 'payment_made',
  title: 'Pagamento Alfa',
  description: 'Cobrança confirmada',
  timestamp: '2026-10-01',
  metadata: { amount: 12.5 },
  link: '/area-cliente/historico/r%201',
}
function api(rentals = [rental]) {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/client/rentals')) return Response.json({ rentals })
    if (url.endsWith('/quotes')) return Response.json({ quotes: [quote] })
    return Response.json({ activities: [activity] })
  })
  return {
    fetcher,
    client: createHttpClient({
      baseUrl: 'https://api.example.test',
      credentials: 'omit',
      getHeaders: () => ({
        'x-tenant-id': 'alfa',
        Authorization: 'Bearer fixture',
      }),
      fetcher,
    }),
  }
}
function tree(
  client: HttpClient,
  userId = 'ana',
  slug = 'alfa',
  navigate = vi.fn()
) {
  return (
    <FrontendSessionFixture userId={userId}>
      <ApiClientProvider client={client}>
        <PublicTenantProvider value={slug}>
          <NavigationProvider navigate={navigate}>
            <AreaClientePage />
          </NavigationProvider>
        </PublicTenantProvider>
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
}
beforeEach(() => {
  captured.storage.clear()
  captured.classes.length = 0
  captured.error.mockReset()
  captured.success.mockReset()
  useCartStore.setState({ items: [] })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('lê três APIs com identidade nativa e conserva locação, atividades e navegação', async () => {
  const { client, fetcher } = api(),
    navigate = vi.fn()
  render(tree(client, 'ana', 'alfa', navigate))
  expect(await screen.findByText('Betoneira Alfa')).toBeTruthy()
  expect(await screen.findByText('Pagamento Alfa')).toBeTruthy()
  expect(screen.getByText(/125,50/)).toBeTruthy()
  expect(fetcher.mock.calls.map(([url]) => url).sort()).toEqual([
    'https://api.example.test/api/client/activities?limit=10',
    'https://api.example.test/api/client/rentals',
    'https://api.example.test/api/quotes',
  ])
  for (const [, init] of fetcher.mock.calls as unknown as Array<
    [string, RequestInit]
  >)
    expect(init).toMatchObject({
      credentials: 'omit',
      headers: { 'x-tenant-id': 'alfa', Authorization: 'Bearer fixture' },
    })
  fireEvent.click(screen.getByRole('link', { name: 'Ver locação' }))
  expect(navigate).toHaveBeenCalledWith('/area-cliente/historico/r%201')
  fireEvent.click(screen.getByRole('button', { name: 'Remover atividade' }))
  expect(screen.queryByText('Pagamento Alfa')).toBeNull()
  expect(
    JSON.parse(captured.storage.get('gb-locacoes-dismissed-activities')!)
  ).toEqual(['activity-a'])
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(captured.classes).toEqual([])
})
it('sem locações ativas mostra pendentes, finalTotal zero e endereço; não troca pelo original', async () => {
  render(tree(api([]).client))
  await screen.findByText('Martelete Alfa')
  expect(
    screen.getByRole('heading', { name: 'Orçamentos Pendentes' })
  ).toBeTruthy()
  expect(screen.getAllByText(/R\$\s*0,00/).length).toBeGreaterThan(0)
  expect(screen.queryByText(/42,50|99,00/)).toBeNull()
  expect(screen.getByText('Rua Um, 10 - São Paulo/SP')).toBeTruthy()
})
it('o carrinho usa a mesma regra de centavos e calendário; não refaz preço na tela nativa', async () => {
  useCartStore.setState({
    items: [
      {
        equipmentId: 'eq-c',
        equipmentName: 'Betoneira 400L',
        quantity: 3,
        days: 9,
        pricePerDay: 150,
        weeklyUseDirectValue: true,
        weeklyDirectValue: 900,
        finalPrice: 1157.14,
        startDate: new Date(2026, 9, 1, 12),
        endDate: new Date(2026, 9, 10, 12),
        includeWeekends: false,
      } as unknown as CartItem,
    ],
  })
  render(tree(api([]).client))
  expect(await screen.findByText('Betoneira 400L')).toBeTruthy()
  expect(screen.getByText(/Qtd: 3x · Semanal · 9 dias/)).toBeTruthy()
  expect(screen.getAllByText(/3.471,43/).length).toBeGreaterThan(0)
  expect(screen.getByText('01/10/2026 até 10/10/2026')).toBeTruthy()
})
it('restaura dispensa assíncrona anterior sem operação remota', async () => {
  captured.storage.set(
    'gb-locacoes-dismissed-activities',
    JSON.stringify(['activity-a'])
  )
  const { client, fetcher } = api()
  render(tree(client))
  await screen.findByText('Betoneira Alfa')
  await waitFor(() => expect(screen.queryByText('Pagamento Alfa')).toBeNull())
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it.each(['usuario', 'locadora', 'transporte'])(
  'descarta leituras antigas ao trocar %s sem exigir abort no servidor',
  async (kind) => {
    const finishes: Array<(data: unknown) => void> = []
    const old = {
      request: vi.fn(() => new Promise((resolve) => finishes.push(resolve))),
    } as unknown as HttpClient
    const view = render(tree(old))
    await waitFor(() => expect(finishes).toHaveLength(3))
    view.rerender(
      tree(
        kind === 'transporte' ? api([]).client : old,
        kind === 'usuario' ? 'bruno' : 'ana',
        kind === 'locadora' ? 'bravo' : 'alfa'
      )
    )
    if (kind !== 'transporte')
      await waitFor(() => expect(finishes).toHaveLength(6))
    view.rerender(tree(api([]).client, 'nova', 'charlie'))
    await screen.findByText('Martelete Alfa')
    await act(async () =>
      finishes
        .slice(0, 3)
        .forEach((finish) =>
          finish({ rentals: [rental], quotes: [quote], activities: [activity] })
        )
    )
    expect(screen.queryByText('Betoneira Alfa')).toBeNull()
    expect(captured.error).not.toHaveBeenCalled()
  }
)

it('mantém Voltar e Sair como callbacks do host, sem identidade duplicada na página', async () => {
  const back = vi.fn(),
    signOut = vi.fn(),
    { client } = api()
  render(
    <FrontendSessionFixture>
      <ApiClientProvider client={client}>
        <PublicTenantProvider value="alfa">
          <AreaClientePage onBack={back} onSignOut={signOut} />
        </PublicTenantProvider>
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
  expect(back).toHaveBeenCalledOnce()
  expect(signOut).toHaveBeenCalledOnce()
  await act(async () => {})
})
