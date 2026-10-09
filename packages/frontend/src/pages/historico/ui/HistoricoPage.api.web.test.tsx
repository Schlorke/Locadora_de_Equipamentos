// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  HttpError,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import {
  ApplicationSessionProvider,
  type ApplicationSession,
} from '../../../entities/sessao'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
import { HistoricoPage } from './HistoricoPage.web'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/area-cliente/historico',
  useRouter: () => ({ push: vi.fn() }),
}))
let session: ApplicationSession
const rental = {
  id: 'rental-a',
  quoteId: 'converted',
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
function api() {
  let rentals = [rental],
    quotes = [
      quote,
      {
        ...quote,
        id: 'converted',
        items: [
          {
            ...quote.items[0]!,
            equipment: { id: 'already', name: 'Já convertida' },
          },
        ],
      },
    ]
  const request = vi.fn(
    async (path: string, options?: HttpRequest): Promise<unknown> => {
      if (options?.method === 'DELETE') {
        if (path.startsWith('/api/client/rentals/'))
          rentals = rentals.filter((row) => row.id !== path.split('/').pop())
        else quotes = quotes.filter((row) => row.id !== path.split('/').pop())
        return { message: 'Removido' }
      }
      if (path === '/api/client/rentals') return { rentals }
      if (path === '/api/quotes') return quotes
      throw new Error(path)
    }
  )
  return { request, client: { request } as HttpClient }
}
function tree(client: HttpClient, slug = 'alfa') {
  return (
    <ApplicationSessionProvider
      value={{
        data: session,
        status: session ? 'authenticated' : 'unauthenticated',
        update: vi.fn(),
        signOut: vi.fn(),
      }}
    >
      <ApiClientProvider client={client}>
        <TenantProvider value={null}>
          <PublicTenantProvider value={slug}>
            <HistoricoPage />
          </PublicTenantProvider>
        </TenantProvider>
      </ApiClientProvider>
    </ApplicationSessionProvider>
  )
}
beforeEach(() => {
  session = { user: { id: 'ana', name: 'Ana' } }
  toast.success.mockReset()
  toast.error.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch relativo proibido')
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('lista sem duplicar orçamento convertido, preserva totais, busca e filtro', async () => {
  const { client, request } = api()
  render(tree(client))
  expect(await screen.findByText('Betoneira Alfa')).toBeTruthy()
  expect(screen.getByText('Martelete Alfa')).toBeTruthy()
  expect(screen.queryByText('Já convertida')).toBeNull()
  expect(screen.getByText(/125,50/)).toBeTruthy()
  expect(screen.getByText(/42,50/)).toBeTruthy()
  expect(
    screen
      .getAllByRole('link', { name: 'Ver Detalhes' })
      .map((link) => link.getAttribute('href'))
  ).toEqual(
    expect.arrayContaining([
      '/area-cliente/historico/rental-a',
      '/area-cliente/historico/quote_quote-a',
    ])
  )
  fireEvent.change(screen.getByPlaceholderText('Buscar por equipamento...'), {
    target: { value: 'martelete' },
  })
  expect(screen.queryByText('Betoneira Alfa')).toBeNull()
  expect(screen.getByText('Martelete Alfa')).toBeTruthy()
  fireEvent.change(screen.getByPlaceholderText('Buscar por equipamento...'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Todos os status' }))
  fireEvent.click(
    within(document.getElementById('dropdown-content')!).getByText(
      'Em Andamento'
    )
  )
  expect(screen.queryByText('Martelete Alfa')).toBeNull()
  expect(screen.getByText('Betoneira Alfa')).toBeTruthy()
  expect(request).toHaveBeenCalledTimes(2)
})
it('remove locação e orçamento com confirmação e relê as duas listas', async () => {
  const { client, request } = api()
  render(tree(client))
  await screen.findByText('Betoneira Alfa')
  fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  await waitFor(() => expect(screen.queryByText('Betoneira Alfa')).toBeNull())
  expect(toast.success).toHaveBeenCalledWith(
    'Locação removida do histórico com sucesso'
  )
  fireEvent.click(
    within(
      screen.getByText('Martelete Alfa').closest('.p-6') as HTMLElement
    ).getByRole('button', { name: 'Cancelar' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Sim, cancelar' }))
  await waitFor(() => expect(screen.queryByText('Martelete Alfa')).toBeNull())
  expect(toast.success).toHaveBeenCalledWith(
    'Orçamento removido do histórico com sucesso'
  )
  expect(
    request.mock.calls
      .filter(([, options]) => options?.method === 'DELETE')
      .map(([path, options]) => [path, options?.body])
  ).toEqual([
    ['/api/client/rentals/rental-a', undefined],
    ['/api/quotes/quote-a', undefined],
  ])
  expect(
    request.mock.calls.filter(([, options]) => !options?.method)
  ).toHaveLength(6)
})
it('recusa de exclusão conserva a linha, apresenta erro do servidor e permite tentar novamente', async () => {
  const { client, request } = api(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((path, options) =>
    options?.method === 'DELETE' && fail
      ? Promise.reject(new HttpError('Sem autorização', 403))
      : original(path, options)
  )
  render(tree(client))
  await screen.findByText('Betoneira Alfa')
  fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Sem autorização')
  )
  expect(screen.getByText('Betoneira Alfa')).toBeTruthy()
  expect(toast.success).not.toHaveBeenCalled()
  // Radix fecha a confirmação; a tentativa seguinte reabre o mesmo fluxo.
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  await waitFor(() => expect(toast.success).toHaveBeenCalled())
})
it('polling respeita 30 segundos, aba visível e desmontagem', async () => {
  vi.useFakeTimers()
  const { client, request } = api()
  const visibility = vi.spyOn(document, 'visibilityState', 'get')
  visibility.mockReturnValue('visible')
  const view = render(tree(client))
  await act(async () => {})
  expect(request).toHaveBeenCalledTimes(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(29999)
  })
  expect(request).toHaveBeenCalledTimes(2)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(request).toHaveBeenCalledTimes(4)
  visibility.mockReturnValue('hidden')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000)
    fireEvent(document, new Event('visibilitychange'))
  })
  expect(request).toHaveBeenCalledTimes(4)
  visibility.mockReturnValue('visible')
  await act(async () => {
    fireEvent(document, new Event('visibilitychange'))
  })
  expect(request).toHaveBeenCalledTimes(6)
  view.unmount()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000)
    fireEvent(document, new Event('visibilitychange'))
  })
  expect(request).toHaveBeenCalledTimes(6)
})
it('HTTP de uma lista não impede a outra; atualização de fundo não cria erro de tela', async () => {
  const { client, request } = api(),
    original = request.getMockImplementation()!
  render(tree(client))
  await screen.findByText('Betoneira Alfa')
  request.mockImplementation((path, options) =>
    path === '/api/quotes'
      ? Promise.reject(new HttpError('Recusado', 403))
      : original(path, options)
  )
  await act(async () => {
    fireEvent(document, new Event('visibilitychange'))
  })
  await waitFor(() => expect(screen.queryByText('Martelete Alfa')).toBeNull())
  expect(screen.getByText('Betoneira Alfa')).toBeTruthy()
  expect(toast.error).not.toHaveBeenCalled()
})
it.each(['locadora', 'usuário'])(
  'DELETE pendente não relê nem mostra sucesso depois de trocar %s',
  async (kind) => {
    const { client, request } = api(),
      original = request.getMockImplementation()!
    let resolve!: (value: unknown) => void
    request.mockImplementation((path, options) =>
      options?.method === 'DELETE'
        ? new Promise((done) => {
            resolve = done
          })
        : original(path, options)
    )
    const view = render(tree(client))
    await screen.findByText('Betoneira Alfa')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    const next = api()
    next.request.mockImplementation(async (path) =>
      path.includes('rentals') ? { rentals: [] } : []
    )
    if (kind === 'usuário') session = { user: { id: 'bia', name: 'Bia' } }
    view.rerender(tree(next.client, kind === 'locadora' ? 'bravo' : 'alfa'))
    await act(async () => resolve({ message: 'Removido' }))
    await waitFor(() => expect(next.request).toHaveBeenCalledTimes(2))
    expect(request).toHaveBeenCalledTimes(3)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.queryByText('Betoneira Alfa')).toBeNull()
  }
)
it('sem sessão não consulta as listas', async () => {
  session = null
  const { client, request } = api()
  render(tree(client))
  expect(await screen.findByText('Meus Orçamentos')).toBeTruthy()
  expect(request).not.toHaveBeenCalled()
})
it('listas pendentes da locadora anterior não reaparecem após troca', async () => {
  const pending: Array<(value: unknown) => void> = []
  const old = {
    request: vi.fn(() => new Promise((resolve) => pending.push(resolve))),
  } as unknown as HttpClient
  const view = render(tree(old))
  await waitFor(() => expect(pending).toHaveLength(2))
  const next = api()
  next.request.mockImplementation(async (path) =>
    path.includes('rentals') ? { rentals: [] } : []
  )
  view.rerender(tree(next.client, 'bravo'))
  await act(async () =>
    pending.forEach((resolve) =>
      resolve({ rentals: [rental], quotes: [quote] })
    )
  )
  await screen.findByText('Meus Orçamentos')
  expect(screen.queryByText('Betoneira Alfa')).toBeNull()
  expect(screen.queryByText('Martelete Alfa')).toBeNull()
  expect(toast.error).not.toHaveBeenCalled()
})
