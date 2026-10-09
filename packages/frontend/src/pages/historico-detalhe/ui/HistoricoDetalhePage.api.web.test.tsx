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
import { RentalDetailsPage } from './HistoricoDetalhePage.web'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const nav = vi.hoisted(() => ({
  id: 'rental-a',
  router: { push: vi.fn(), refresh: vi.fn() },
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: nav.id }),
  usePathname: () => '/area-cliente/historico/' + nav.id,
  useRouter: () => nav.router,
}))
vi.mock('../../../entities/configuracao', async (original) => ({
  ...(await original<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({ settings: { whatsappNumber: '5500000000000' } }),
}))
let session: ApplicationSession
const rental = {
  id: 'rental-a',
  startdate: '2030-01-01',
  enddate: '2030-01-04',
  total: '100.50',
  status: 'ACTIVE',
  lateFee: '5.25',
  rental_items: [
    {
      id: 'item',
      quantity: 1,
      totaldays: 3,
      totalprice: '100.50',
      priceperday: '33.50',
      equipments: { id: 'equip', name: 'Betoneira Alfa', images: [] },
    },
  ],
  quote: {
    id: 'quote-a',
    name: 'Ana',
    email: 'ana@example.test',
    total: '100.50',
    finalTotal: '80.50',
  },
  payments: [],
}
const quote = {
  id: 'quote-a',
  quoteCode: 'Q-A',
  name: 'Ana',
  email: 'ana@example.test',
  phone: '',
  totalPrice: 100.5,
  finalTotal: 42.5,
  status: 'pending',
  deliveryType: 'DELIVERY',
  deliveryFee: 10,
  pickupFee: 5,
  createdAt: '2030-01-01',
  updatedAt: '2030-01-01',
  items: [
    {
      id: 'q-item',
      quantity: 1,
      days: 3,
      pricePerDay: 33.5,
      total: 100.5,
      equipment: { id: 'equip', name: 'Martelete Alfa', images: [] },
    },
  ],
}
function api() {
  const request = vi.fn(
    async (path: string, options?: HttpRequest): Promise<unknown> => {
      if (options?.method === 'DELETE') return { message: 'Removido' }
      if (path.endsWith('/extend')) return { extensionFee: 12.5 }
      if (path.endsWith('/request-pickup'))
        return { success: true, message: 'Solicitação enviada' }
      if (path.endsWith('/download'))
        return {
          blob: new Blob(['<h1>Contrato Alfa</h1>']),
          ok: true,
          status: 200,
          url: 'https://api.example.test/download',
          redirected: false,
        }
      if (path.startsWith('/api/quotes/')) return quote
      return { rental }
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
            <RentalDetailsPage />
          </PublicTenantProvider>
        </TenantProvider>
      </ApiClientProvider>
    </ApplicationSessionProvider>
  )
}
beforeEach(() => {
  nav.id = 'rental-a'
  session = { user: { id: 'ana', name: 'Ana' } }
  toast.success.mockReset()
  toast.error.mockReset()
  nav.router.push.mockReset()
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

it('lê o detalhe pelo transporte injetado e conserva finalTotal mais multa sem concatenar Decimal', async () => {
  const { client, request } = api()
  render(tree(client))
  expect(
    await screen.findByRole('heading', { name: 'Detalhes da Locação' })
  ).toBeTruthy()
  expect(screen.getAllByText(/Betoneira Alfa/).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/85,75/).length).toBeGreaterThan(0)
  expect(request.mock.calls[0]![0]).toBe('/api/client/rentals/rental-a')
})

it('resolve quote_ e mantém o total final sem somar o frete novamente; cancela com a mensagem anterior', async () => {
  nav.id = 'quote_quote-a'
  const { client, request } = api()
  render(tree(client))
  expect(
    await screen.findByRole('heading', { name: 'Detalhes do Orçamento' })
  ).toBeTruthy()
  expect(screen.getAllByText(/42,50/).length).toBeGreaterThan(0)
  expect(request.mock.calls[0]![0]).toBe('/api/quotes/quote-a')
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Cancelar Orçamento' })[0]!
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Sim, cancelar' }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith(
      'Orçamento cancelado com sucesso'
    )
  )
  expect(
    request.mock.calls.some(
      ([path, options]) =>
        path === '/api/quotes/quote-a' && options?.method === 'DELETE'
    )
  ).toBe(true)
  expect(nav.router.push).toHaveBeenCalledWith('/area-cliente/historico')
})

it.each([
  ['rental-a', 'Locação não encontrada'],
  ['quote_quote-a', 'Orçamento não encontrado'],
])('mantém o tratamento 404 de %s', async (id, message) => {
  nav.id = id
  const { client, request } = api()
  request.mockRejectedValue(new HttpError('Server message', 404))
  render(tree(client))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message))
  expect(nav.router.push).toHaveBeenCalledWith('/area-cliente/historico')
})

it('extensão direta envia extensionDays, conserva faixa 1–30 e releitura; coleta não envia corpo', async () => {
  const { client, request } = api()
  const prompt = vi.spyOn(window, 'prompt').mockReturnValue('31')
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(tree(client))
  await screen.findByRole('heading', { name: 'Detalhes da Locação' })
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Prorrogação' }))
  expect(toast.error).toHaveBeenCalledWith(
    'Por favor, insira um número válido entre 1 e 30'
  )
  expect(request).toHaveBeenCalledTimes(1)
  prompt.mockReturnValue('7')
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Prorrogação' }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Taxa adicional: R$')
    )
  )
  expect(toast.success.mock.calls[0]![0]).toContain('12,50')
  const extend = request.mock.calls.find(([path]) => path.endsWith('/extend'))!
  expect(extend[1]).toMatchObject({
    method: 'POST',
    body: '{"extensionDays":7}',
  })
  await waitFor(() =>
    expect(
      request.mock.calls.filter(
        ([path]) => path === '/api/client/rentals/rental-a'
      )
    ).toHaveLength(2)
  )
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar Coleta' }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith(
      'Solicitação de coleta enviada. Nossa equipe entrará em contato em breve.'
    )
  )
  expect(
    request.mock.calls.find(([path]) => path.endsWith('/request-pickup'))![1]
  ).toMatchObject({ method: 'POST' })
  expect(
    request.mock.calls.find(([path]) => path.endsWith('/request-pickup'))![1]
      ?.body
  ).toBeUndefined()
})

it.each(['locadora', 'usuário', 'rota'])(
  'descarta leitura antiga ao mudar %s',
  async (kind) => {
    const { client, request } = api()
    let complete!: (value: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const view = render(tree(client))
    await waitFor(() => expect(complete).toBeTypeOf('function'))
    if (kind === 'usuário') session = { user: { id: 'bia' } }
    if (kind === 'rota') nav.id = 'rental-b'
    view.rerender(tree(client, kind === 'locadora' ? 'bravo' : 'alfa'))
    await screen.findByRole('heading', { name: 'Detalhes da Locação' })
    await act(async () =>
      complete({
        rental: {
          ...rental,
          rental_items: [
            {
              ...rental.rental_items[0]!,
              equipments: { id: 'late', name: 'Resposta antiga', images: [] },
            },
          ],
        },
      })
    )
    expect(screen.queryByText('Resposta antiga')).toBeNull()
    expect(toast.error).not.toHaveBeenCalled()
    expect(nav.router.push).not.toHaveBeenCalled()
    expect(request.mock.calls[0]![1]?.signal?.aborted).toBe(true)
  }
)

it.each(['extend', 'request-pickup', 'DELETE', 'download'])(
  'resposta antiga de %s não inicia toast, navegação, releitura ou download',
  async (action) => {
    if (action === 'DELETE') nav.id = 'quote_quote-a'
    const { client, request } = api()
    vi.spyOn(window, 'prompt').mockReturnValue('7')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const createUrl = vi.fn(() => 'blob:fixture')
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: createUrl,
        revokeObjectURL: vi.fn(),
      })
    )
    const view = render(tree(client))
    await screen.findByRole('heading', {
      name:
        action === 'DELETE' ? 'Detalhes do Orçamento' : 'Detalhes da Locação',
    })
    let complete!: (value: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    if (action === 'DELETE') {
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Cancelar Orçamento' })[0]!
      )
      fireEvent.click(
        await screen.findByRole('button', { name: 'Sim, cancelar' })
      )
    } else {
      fireEvent.click(
        screen.getByRole('button', {
          name:
            action === 'extend'
              ? 'Solicitar Prorrogação'
              : action === 'download'
                ? 'Baixar Contrato'
                : 'Solicitar Coleta',
        })
      )
    }
    await waitFor(() => expect(complete).toBeTypeOf('function'))
    view.rerender(tree(client, 'bravo'))
    await screen.findByRole('heading', {
      name:
        action === 'DELETE' ? 'Detalhes do Orçamento' : 'Detalhes da Locação',
    })
    const count = request.mock.calls.length
    await act(async () =>
      complete({
        message: 'OK',
        extensionFee: 12.5,
        ok: true,
        status: 200,
        blob: new Blob(['secret']),
      })
    )
    expect(request).toHaveBeenCalledTimes(count)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(nav.router.push).not.toHaveBeenCalled()
    expect(createUrl).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
  }
)

it('download usa resultado binário consumido, conserva filename e recusa sem arquivo', async () => {
  const { client, request } = api()
  const downloads: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push(this.download)
  })
  const createUrl = vi.fn(() => 'blob:fixture'),
    revokeUrl = vi.fn()
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    })
  )
  render(tree(client))
  await screen.findByRole('heading', { name: 'Detalhes da Locação' })
  fireEvent.click(screen.getByRole('button', { name: 'Baixar Contrato' }))
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith('Contrato baixado com sucesso')
  )
  expect(request.mock.calls[1]![1]).toMatchObject({ responseType: 'binary' })
  expect(downloads).toEqual(['contrato-rental-a.html'])
  expect(revokeUrl).toHaveBeenCalledWith('blob:fixture')
  request.mockResolvedValueOnce({
    ok: false,
    status: 404,
    redirected: false,
    blob: new Blob(['{"error":"not found"}']),
  })
  fireEvent.click(screen.getByRole('button', { name: 'Baixar Contrato' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Erro ao baixar contrato')
  )
  expect(createUrl).toHaveBeenCalledTimes(1)
  expect(downloads).toHaveLength(1)
})

it('polling silencioso só na aba visível e visibilitychange; desmontagem encerra ambos', async () => {
  const { client, request } = api()
  const visibility = vi
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('visible')
  let tick!: () => void
  const interval = vi
    .spyOn(window, 'setInterval')
    .mockImplementation((handler, delay) => {
      if (delay === 30_000 && typeof handler === 'function')
        tick = handler as () => void
      return 123
    })
  const clear = vi.spyOn(window, 'clearInterval')
  const view = render(tree(client))
  await screen.findByRole('heading', { name: 'Detalhes da Locação' })
  expect(interval).toHaveBeenCalledWith(expect.any(Function), 30_000)
  await act(async () => tick())
  expect(request).toHaveBeenCalledTimes(2)
  visibility.mockReturnValue('hidden')
  await act(async () => tick())
  expect(request).toHaveBeenCalledTimes(2)
  request.mockRejectedValueOnce(new HttpError('Gone', 404))
  visibility.mockReturnValue('visible')
  await act(async () => fireEvent(document, new Event('visibilitychange')))
  expect(request).toHaveBeenCalledTimes(3)
  expect(toast.error).not.toHaveBeenCalled()
  expect(nav.router.push).not.toHaveBeenCalled()
  view.unmount()
  expect(clear).toHaveBeenCalledWith(123)
  await act(async () => fireEvent(document, new Event('visibilitychange')))
  expect(request).toHaveBeenCalledTimes(3)
})

it('preserva o ramo de redirecionamento e falha de rede do download', async () => {
  const { client, request } = api()
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  render(tree(client))
  await screen.findByRole('heading', { name: 'Detalhes da Locação' })
  request.mockResolvedValueOnce({
    ok: false,
    status: 302,
    redirected: true,
    url: 'https://storage.example.test/signed.pdf',
    blob: new Blob(),
  })
  fireEvent.click(screen.getByRole('button', { name: 'Baixar Contrato' }))
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith(
      'https://storage.example.test/signed.pdf',
      '_blank'
    )
  )
  request.mockRejectedValueOnce(new Error('Network error'))
  fireEvent.click(screen.getByRole('button', { name: 'Baixar Contrato' }))
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Erro ao baixar contrato')
  )
  expect(toast.success).not.toHaveBeenCalled()
})
