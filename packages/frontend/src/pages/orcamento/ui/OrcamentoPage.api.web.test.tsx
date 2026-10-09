// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
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
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
import { switchCartScope, useCartStore } from '../../../features/carrinho'

const state = vi.hoisted(() => ({
  session: { user: { id: 'ana', name: 'Ana', email: 'ana@example.test' } } as {
    user: { id: string; name: string; email: string }
  } | null,
  query: new URLSearchParams(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('next/navigation', () => ({ useSearchParams: () => state.query }))
vi.mock('../../../entities/sessao', () => ({
  useSession: () => ({
    data: state.session,
    status: state.session ? 'authenticated' : 'unauthenticated',
  }),
}))
vi.mock('sonner', () => ({
  toast: { success: state.success, error: state.error, info: vi.fn() },
}))
vi.mock('@radix-ui/react-select', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ItemIndicator: () => null,
}))
const avaliacoes = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}))
vi.mock('../../../widgets/avaliacoes-google', () => ({
  GoogleCustomerReviews: (props: Record<string, unknown>) => {
    avaliacoes.props.push(props)
    return null
  },
}))
vi.mock('@gb-locacoes/ui', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode
      value?: string
      onValueChange: (value: string) => void
    }) =>
      createElement(
        'select',
        {
          'aria-label': 'Tipo de entrega',
          value: value ?? '',
          onChange: (event: { target: { value: string } }) =>
            onValueChange(event.target.value),
        },
        createElement('option', { value: '' }, 'Selecionar'),
        children
      ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => children,
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) =>
      createElement('option', { value }, children),
    AddressForm: ({ onChange }: { onChange: (address: unknown) => void }) =>
      createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            onChange({
              cep: '90000-000',
              logradouro: 'Rua A',
              numero: '1',
              complemento: '',
              bairro: 'Centro',
              cidade: 'Porto Alegre',
              estado: 'RS',
            }),
        },
        'Preencher endereço'
      ),
  }
})
import { QuotePageWrapper } from './OrcamentoPage.web'

const profile = {
  phone: '51999999999',
  cpf: '52998224725',
  company: 'Empresa Alfa',
}
/** Termos publicados pela locadora (onda 134): o diálogo de aceite mostra o documento dela. */
const TERMOS = {
  version: 1,
  lastUpdated: '2 de março de 2026',
  sections: [
    {
      id: 'uso',
      title: 'Uso da Plataforma',
      blocks: [
        { type: 'paragraph', text: 'Regras da Locadora Alfa.' },
        { type: 'list', items: [{ lead: 'Prazo:', text: 'sete dias.' }] },
      ],
    },
  ],
}
/** Resposta da rota pública dos Termos (o hook pede a resposta inteira, com o status). */
const termos = vi.hoisted(() => ({
  resposta: null as null | { ok: boolean; status: number; data: unknown },
  configuracoes: {} as Record<string, unknown>,
}))
function api() {
  const request = vi.fn(
    async (path: string, options?: HttpRequest): Promise<unknown> => {
      if (path.startsWith('/api/settings/public/legal-documents/terms?'))
        return (
          termos.resposta ?? {
            ok: true,
            status: 200,
            data: { kind: 'terms', document: TERMOS, publishedAt: null },
          }
        )
      if (path.startsWith('/api/settings/public?')) return termos.configuracoes
      if (path === '/api/user/profile')
        return options?.method
          ? { success: true, user: profile }
          : { user: profile }
      if (path.startsWith('/api/equipments?')) return []
      if (path.includes('/availability?'))
        return {
          availability: Object.fromEntries(
            ['2033-03-01', '2033-03-02', '2033-03-03'].map((date) => [
              date,
              { available: true, availableQuantity: 5 },
            ])
          ),
        }
      if (path === '/api/addresses') return { addresses: [] }
      if (path === '/api/quotes') return { id: 'quote-a' }
      throw new Error(`Rota inesperada: ${path}`)
    }
  )
  return { request, client: { request } as HttpClient }
}
function tree(client: HttpClient, slug = 'alfa') {
  return (
    <ApiClientProvider client={client}>
      <TenantProvider value={null}>
        <PublicTenantProvider value={slug}>
          <QuotePageWrapper />
        </PublicTenantProvider>
      </TenantProvider>
    </ApiClientProvider>
  )
}
function addItem(name = 'Betoneira') {
  useCartStore.getState().addItem({
    equipmentId: 'eq',
    equipmentName: name,
    pricePerDay: 100,
    quantity: 1,
    days: 3,
    startDate: new Date('2033-03-01T00:00:00Z'),
    endDate: new Date('2033-03-03T00:00:00Z'),
    includeWeekends: true,
  })
}
async function submit({ aceitar = true }: { aceitar?: boolean } = {}) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de entrega' }), {
    target: { value: 'PICKUP' },
  })
  if (aceitar) {
    await waitFor(() =>
      expect(document.getElementById('terms-accept')).not.toBeNull()
    )
    fireEvent.click(document.getElementById('terms-accept')!)
  }
  fireEvent.submit(document.getElementById('quote-form')!)
}
beforeEach(async () => {
  termos.resposta = null
  termos.configuracoes = {}
  avaliacoes.props.length = 0
  await switchCartScope(null)
  localStorage.clear()
  await switchCartScope(JSON.stringify(['alfa', 'ana']))
  state.session = {
    user: { id: 'ana', name: 'Ana', email: 'ana@example.test' },
  }
  state.query = new URLSearchParams()
  state.success.mockReset()
  state.error.mockReset()
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('fetch direto proibido no consumidor')
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  Element.prototype.scrollIntoView = vi.fn()
  addItem()
})
afterEach(async () => {
  cleanup()
  await switchCartScope(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('preenche perfil, consulta catálogo/disponibilidade e envia pelo cliente injetado', async () => {
  const { request, client } = api()
  render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  await submit()
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/quotes', expect.anything())
  )
  const body = JSON.parse(
    request.mock.calls.find(([path]) => path === '/api/quotes')![1]!.body!
  )
  expect(body).toMatchObject({
    tenantSlug: 'alfa',
    customerName: 'Ana',
    deliveryType: 'PICKUP',
    items: [{ equipmentId: 'eq', quantity: 1, days: 3 }],
  })
  expect(
    request.mock.calls.some(
      ([path]) => path === '/api/equipments?tenantSlug=alfa'
    )
  ).toBe(true)
  expect(
    request.mock.calls.some(
      ([path]) =>
        path.includes('/availability?') && path.endsWith('tenantSlug=alfa')
    )
  ).toBe(true)
  await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0))
  expect(state.success).toHaveBeenCalled()
})
it('erro HTTP conserva o carrinho e uma nova tentativa usa o mesmo contrato', async () => {
  const { request, client } = api(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((path, options) =>
    path === '/api/quotes' && fail
      ? Promise.reject(new HttpError('Indisponível', 409))
      : original(path, options)
  )
  render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  await submit()
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith(
      'Erro',
      expect.objectContaining({ description: 'Indisponível' })
    )
  )
  expect(useCartStore.getState().items).toHaveLength(1)
  fail = false
  fireEvent.submit(document.getElementById('quote-form')!)
  await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0))
})
it('troca de locadora limpa dados do formulário e resposta antiga não apaga o novo carrinho', async () => {
  const { request, client } = api(),
    original = request.getMockImplementation()!
  let resolve!: (value: unknown) => void
  request.mockImplementation((path, options) =>
    path === '/api/quotes'
      ? new Promise((done) => {
          resolve = done
        })
      : original(path, options)
  )
  const view = render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  await submit()
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  await act(async () => {
    await switchCartScope(JSON.stringify(['bravo', 'ana']))
    addItem('Outro carrinho')
  })
  view.rerender(tree(client, 'bravo'))
  await act(async () => {
    resolve({ id: 'antigo' })
  })
  expect(useCartStore.getState().items[0]?.equipmentName).toBe('Outro carrinho')
  expect(state.success).not.toHaveBeenCalled()
})
it('resposta do catálogo não ressuscita item removido durante a consulta', async () => {
  const { request, client } = api(),
    original = request.getMockImplementation()!
  let resolve!: (value: unknown) => void
  request.mockImplementation((path, options) =>
    path.startsWith('/api/equipments?')
      ? new Promise((done) => {
          resolve = done
        })
      : original(path, options)
  )
  render(tree(client))
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  act(() => useCartStore.getState().removeItem('eq'))
  await act(async () => {
    resolve([{ id: 'eq', pricePerDay: 200 }])
  })
  expect(useCartStore.getState().items).toHaveLength(0)
})

it.each(['locadora', 'usuário'])(
  'remoção animada funciona no escopo atual e não remove item após troca de %s',
  async (change) => {
    const { client } = api()
    const view = render(tree(client))
    const removeButton = () =>
      view.container.querySelector('svg.lucide-trash-2')!.closest('button')!
    await waitFor(() =>
      expect(view.container.querySelector('svg.lucide-trash-2')).toBeTruthy()
    )
    fireEvent.click(removeButton())
    expect(useCartStore.getState().items).toHaveLength(1)
    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0))

    act(() => addItem())
    fireEvent.click(removeButton())
    const slug = change === 'locadora' ? 'bravo' : 'alfa'
    const user = change === 'usuário' ? 'bia' : 'ana'
    await act(async () => {
      await switchCartScope(JSON.stringify([slug, user]))
      addItem('Novo carrinho')
      if (change === 'usuário') {
        state.session = {
          user: { id: user, name: 'Bia', email: 'bia@example.test' },
        }
      }
      view.rerender(tree(client, slug))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(useCartStore.getState().items).toMatchObject([
      { equipmentId: 'eq', equipmentName: 'Novo carrinho' },
    ])
  }
)

it('salvamento do perfil precisa confirmar sucesso antes de enviar o orçamento', async () => {
  const { request, client } = api(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((path, options) =>
    path === '/api/user/profile' && options?.method === 'PUT' && fail
      ? Promise.reject(new HttpError('Não foi possível salvar', 500))
      : original(path, options)
  )
  render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  fireEvent.change(screen.getByLabelText('Empresa/Construtora'), {
    target: { value: 'Empresa nova' },
  })
  await submit()
  fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith('Erro ao salvar informações')
  )
  expect(request.mock.calls.some(([path]) => path === '/api/quotes')).toBe(
    false
  )
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(() =>
    expect(request.mock.calls.some(([path]) => path === '/api/quotes')).toBe(
      true
    )
  )
  expect(
    JSON.parse(
      request.mock.calls.find(
        ([path, options]) =>
          path === '/api/user/profile' && options?.method === 'PUT'
      )![1]!.body!
    )
  ).toEqual({ company: 'Empresa nova' })
})

it('salvamentos paralelos conservam sucesso parcial sem enviar o pedido após falha do perfil', async () => {
  const { request, client } = api(),
    original = request.getMockImplementation()!
  request.mockImplementation((path, options) => {
    if (path === '/api/addresses' && options?.method === 'POST')
      return Promise.resolve({ address: { id: 'endereco' } })
    if (path === '/api/user/profile' && options?.method === 'PUT')
      return Promise.reject(new HttpError('Falha do perfil', 500))
    return original(path, options)
  })
  render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  fireEvent.change(screen.getByLabelText('Empresa/Construtora'), {
    target: { value: 'Empresa nova' },
  })
  fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de entrega' }), {
    target: { value: 'DELIVERY' },
  })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Preencher endereço' })
  )
  fireEvent.click(document.getElementById('terms-accept')!)
  fireEvent.submit(document.getElementById('quote-form')!)
  fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))
  await waitFor(() =>
    expect(state.error).toHaveBeenCalledWith(
      'Erro ao salvar informações do cliente',
      expect.objectContaining({ description: 'Falha do perfil' })
    )
  )
  expect(
    request.mock.calls.some(
      ([path, options]) =>
        path === '/api/addresses' && options?.method === 'POST'
    )
  ).toBe(true)
  expect(request.mock.calls.some(([path]) => path === '/api/quotes')).toBe(
    false
  )
})

// Onda 134 (decisão do dono D-C, parte 1): os Termos são os da própria locadora.
it('Termos publicados: o diálogo mostra o documento da locadora e o envio exige o aceite', async () => {
  const { request, client } = api()
  render(tree(client))
  await waitFor(() =>
    expect(document.getElementById('terms-accept')).not.toBeNull()
  )
  await submit({ aceitar: false })
  await act(async () => {})
  expect(request.mock.calls.some(([path]) => path === '/api/quotes')).toBe(
    false
  )
  fireEvent.click(screen.getByRole('button', { name: 'Termos de Uso' }))
  expect(await screen.findByText('Regras da Locadora Alfa.')).toBeTruthy()
  expect(
    screen.getByText('Última atualização: 2 de março de 2026')
  ).toBeTruthy()
  expect(document.body.innerHTML).toContain(
    '<strong>Prazo:</strong> sete dias.'
  )
  expect(document.body.textContent).not.toMatch(/GB Loca|19 de janeiro de 2026/)
})

it('Termos ausentes: sem a caixa de aceite, e o pedido segue', async () => {
  termos.resposta = {
    ok: false,
    status: 404,
    data: { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' },
  }
  const { request, client } = api()
  render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  await waitFor(() =>
    expect(
      request.mock.calls.some(([path]) =>
        path.startsWith('/api/settings/public/legal-documents/terms')
      )
    ).toBe(true)
  )
  await act(async () => {})
  expect(document.getElementById('terms-accept')).toBeNull()
  expect(screen.queryByText(/Termos de Uso/)).toBeNull()
  await submit({ aceitar: false })
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/quotes', expect.anything())
  )
})

it('falha ao ler os Termos: aviso e envio bloqueado até recarregar', async () => {
  termos.resposta = { ok: false, status: 500, data: null }
  const { request, client } = api()
  render(tree(client))
  expect(
    await screen.findByText(
      'Não foi possível carregar os Termos de Uso da locadora. Recarregue a página para enviar a solicitação.'
    )
  ).toBeTruthy()
  expect(document.getElementById('terms-accept')).toBeNull()
  await submit({ aceitar: false })
  await act(async () => {})
  expect(request.mock.calls.some(([path]) => path === '/api/quotes')).toBe(
    false
  )
  expect(state.error).toHaveBeenCalledWith(
    'Termos de Uso indisponíveis',
    expect.objectContaining({
      description:
        'Não foi possível carregar os Termos de Uso da locadora. Recarregue a página para enviar a solicitação.',
    })
  )
})

// Onda 134: a pesquisa do Google Avaliações do Consumidor usa o Merchant Center da própria locadora (siteContent).
it('depois do envio, a pesquisa de avaliações recebe o ID do Merchant Center da locadora (sem ele, nenhum)', async () => {
  termos.configuracoes = { siteContent: { googleMerchantId: '123456789' } }
  const { request, client } = api()
  render(tree(client))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Empresa/Construtora') as HTMLInputElement).value
    ).toBe('Empresa Alfa')
  )
  await submit()
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/quotes', expect.anything())
  )
  await waitFor(() => expect(avaliacoes.props.length).toBeGreaterThan(0))
  expect(avaliacoes.props.at(-1)).toMatchObject({
    merchantId: '123456789',
    orderId: 'quote-a',
  })
})
