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
  HttpError,
  type HttpClient,
} from '../../../shared/api'
import {
  ApplicationSessionProvider,
  type ApplicationSession,
} from '../../../entities/sessao'
import {
  TenantProvider,
  PublicTenantProvider,
} from '../../../entities/organizacao'
import { AreaClientePage } from './AreaClientePage.web'

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/area-cliente',
  useRouter: () => ({ push: vi.fn() }),
}))
let session: ApplicationSession
const rental = {
  id: 'rental-a',
  startdate: '2026-10-01',
  enddate: '2026-10-05',
  total: 125.5,
  status: 'ACTIVE',
  rental_items: [
    {
      id: 'item',
      quantity: 2,
      totaldays: 4,
      equipments: { id: 'equip', name: 'Betoneira Alfa', images: [] },
    },
  ],
}
const quote = {
  id: 'quote-a',
  name: 'Ana',
  email: 'ana@example.test',
  phone: '',
  totalPrice: 999,
  finalTotal: 42.5,
  status: 'pending',
  createdAt: '2026-10-01',
  items: [
    {
      id: 'item-q',
      quantity: 1,
      days: 2,
      equipment: { id: 'equip-q', name: 'Martelete Alfa' },
    },
  ],
}
const activity = {
  id: 'activity-a',
  type: 'payment_made',
  title: 'Pagamento Alfa',
  description: 'Cobrança confirmada',
  timestamp: '2026-10-01',
  metadata: { amount: 12.5 },
}
function api() {
  const request = vi.fn(async (path: string): Promise<unknown> => {
    if (path === '/api/client/rentals') return { rentals: [rental] }
    if (path === '/api/quotes') return { quotes: [quote] }
    if (path === '/api/client/activities?limit=10')
      return { activities: [activity] }
    throw new Error(path)
  })
  return { request, client: { request } as HttpClient }
}
function tree(client: HttpClient, slug = 'alfa') {
  return (
    <TenantProvider value={null}>
      <ApplicationSessionProvider
        value={{
          data: session,
          status: session ? 'authenticated' : 'unauthenticated',
          update: vi.fn(),
          signOut: vi.fn(),
        }}
      >
        <ApiClientProvider client={client}>
          <PublicTenantProvider value={slug}>
            <AreaClientePage />
          </PublicTenantProvider>
        </ApiClientProvider>
      </ApplicationSessionProvider>
    </TenantProvider>
  )
}
beforeEach(() => {
  session = { user: { id: 'ana', name: 'Ana', email: 'ana@example.test' } }
  localStorage.clear()
  toast.error.mockReset()
  toast.success.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('lê três recursos configurados, conserva valores, navegação e dispensa atividade localmente', async () => {
  const { request, client } = api()
  render(tree(client))
  expect(await screen.findByText('Betoneira Alfa')).toBeTruthy()
  expect(await screen.findByText('Pagamento Alfa')).toBeTruthy()
  expect(screen.getByText('Cobrança confirmada')).toBeTruthy()
  expect(screen.getAllByText(/125,50/).length).toBeGreaterThan(0)
  expect(request.mock.calls.map(([path]) => path).sort()).toEqual([
    '/api/client/activities?limit=10',
    '/api/client/rentals',
    '/api/quotes',
  ])
  expect(screen.getByRole('link', { name: 'Ver' }).getAttribute('href')).toBe(
    '/area-cliente/historico/rental-a'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Remover atividade' }))
  expect(screen.queryByText('Pagamento Alfa')).toBeNull()
  expect(
    JSON.parse(localStorage.getItem('gb-locacoes-dismissed-activities')!)
  ).toEqual(['activity-a'])
  expect(request).toHaveBeenCalledTimes(3)
})
it('HTTP recusado em locações exibe a mensagem existente; atividades falhas não impedem o restante', async () => {
  const { request, client } = api(),
    original = request.getMockImplementation()!
  request.mockImplementation((path) =>
    path.includes('client/')
      ? Promise.reject(new HttpError('Recusado', 403))
      : original(path)
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(tree(client))
  expect(await screen.findByText('Martelete Alfa')).toBeTruthy()
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Erro ao carregar locações')
  )
  expect(screen.getAllByText(/42,50/).length).toBeGreaterThan(0)
})
it.each(['locadora', 'usuário'])(
  'descarta leituras pendentes ao trocar %s, mesmo sem abort no transporte',
  async (kind) => {
    const pending: Array<(data: unknown) => void> = []
    const old = {
      request: vi.fn(() => new Promise((resolve) => pending.push(resolve))),
    } as unknown as HttpClient
    const view = render(tree(old))
    await waitFor(() => expect(pending).toHaveLength(3))
    const next = api()
    if (kind === 'usuário') session = { user: { id: 'bia', name: 'Bia' } }
    next.request.mockImplementation(async (path) =>
      path.includes('activities')
        ? { activities: [] }
        : path.includes('rentals')
          ? { rentals: [] }
          : []
    )
    view.rerender(tree(next.client, kind === 'locadora' ? 'bravo' : 'alfa'))
    await act(async () =>
      pending.forEach((resolve) =>
        resolve({ rentals: [rental], quotes: [quote], activities: [activity] })
      )
    )
    await waitFor(() => expect(next.request).toHaveBeenCalledTimes(3))
    expect(screen.queryByText('Betoneira Alfa')).toBeNull()
    expect(screen.queryByText('Pagamento Alfa')).toBeNull()
    expect(toast.error).not.toHaveBeenCalled()
  }
)
it('não consulta recursos privados sem sessão', () => {
  session = null
  const { request, client } = api()
  render(tree(client))
  expect(request).not.toHaveBeenCalled()
})
