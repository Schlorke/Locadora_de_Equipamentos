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
import { ApplicationSessionProvider } from '../../../entities/sessao'
import {
  PublicTenantProvider,
  TenantProvider,
} from '../../../entities/organizacao'
import {
  ApiClientProvider,
  HttpError,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import { switchCartScope, useCartStore } from '../../../features/carrinho'
import type { QuotePreferenceStorage } from '../model/quote-page-contract'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
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
  ...(await import('../../../../../ui/src/native/Checkbox.native')),
  ...(await import('../../../../../ui/src/native/AddressForm.native')),
  ...(await import('../../../../../ui/src/native/Textarea.native')),
  toast: captured,
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
import { QuotePageWrapper } from './OrcamentoPage.native'

const profile = {
  phone: '51999999999',
  cpf: '52998224725',
  company: 'Empresa Alfa',
}
const address = {
  id: 'address-a',
  street: 'Rua A',
  number: '1',
  complement: '',
  neighborhood: 'Centro',
  city: 'Porto Alegre',
  state: 'RS',
  zipCode: '90000000',
  isPrimary: true,
}
/** Termos publicados pela locadora (onda 134): o app mostra o documento dela no diálogo de leitura. */
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
const termos = vi.hoisted(() => ({
  resposta: null as null | { ok: boolean; status: number; data: unknown },
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
      if (path.startsWith('/api/settings/public?')) return {}
      if (path === '/api/user/profile') return { user: profile, success: true }
      if (path === '/api/addresses')
        return options?.method === 'POST'
          ? { address }
          : { addresses: [address] }
      if (path.startsWith('/api/equipments?')) return []
      if (path.includes('/availability?')) return { availability: {} }
      if (path === '/api/quotes') return { id: 'quote-a' }
      throw new Error('Rota inesperada: ' + path)
    }
  )
  const client: HttpClient = {
    request: async <T,>(path: string, options?: HttpRequest) =>
      (await request(path, options)) as T,
  }
  return { client, request }
}
function storage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
      values.delete(key)
    }),
  }
}
function tree(
  client: HttpClient,
  preferences: QuotePreferenceStorage,
  slug = 'alfa',
  user = 'ana'
) {
  return (
    <ApiClientProvider client={client}>
      <TenantProvider value={null}>
        <PublicTenantProvider value={slug}>
          <ApplicationSessionProvider
            value={{
              data: {
                user: { id: user, name: 'Ana', email: 'ana@example.test' },
              },
              status: 'authenticated',
              update: async () => null,
              signOut: async () => {},
            }}
          >
            <QuotePageWrapper storage={preferences} />
          </ApplicationSessionProvider>
        </PublicTenantProvider>
      </TenantProvider>
    </ApiClientProvider>
  )
}
function addItem(
  extra: Partial<ReturnType<typeof useCartStore.getState>['items'][number]> = {}
) {
  useCartStore.getState().addItem({
    equipmentId: 'eq',
    equipmentName: 'Betoneira',
    pricePerDay: 50.05,
    dailyDiscount: 10,
    quantity: 3,
    days: 1,
    maxStock: 3,
    includeWeekendsConfirmed: true,
    ...extra,
  })
}
async function ready({ termos: comTermos = true } = {}) {
  await waitFor(() =>
    expect((screen.getByLabelText('Empresa') as HTMLInputElement).value).toBe(
      'Empresa Alfa'
    )
  )
  if (comTermos)
    await screen.findByRole('checkbox', { name: 'Aceito os Termos de Uso' })
}
function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Retirada no local' }))
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Aceito os Termos de Uso' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitação' }))
}
const quoteBody = (request: ReturnType<typeof api>['request']) =>
  JSON.parse(
    request.mock.calls.find(([path]) => path === '/api/quotes')![1]!.body!
  )
beforeEach(async () => {
  termos.resposta = null
  await switchCartScope(null)
  await switchCartScope(JSON.stringify(['alfa', 'ana']))
  addItem()
  captured.classes.length = 0
  captured.success.mockClear()
  captured.error.mockClear()
  captured.info.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('HTTP direto proibido')
    })
  )
})
afterEach(async () => {
  cleanup()
  await switchCartScope(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('apresenta centavos exatos, limites de quantidade/dias e envia o mesmo DTO pelo transporte', async () => {
  const { client, request } = api()
  render(tree(client, storage()))
  await ready()
  expect(screen.getAllByText(/135,14/).length).toBeGreaterThan(0)
  fireEvent.click(
    screen.getByRole('button', { name: 'Aumentar quantidade de Betoneira' })
  )
  expect(useCartStore.getState().items[0]?.quantity).toBe(3)
  fireEvent.click(
    screen.getByRole('button', { name: 'Diminuir dias de Betoneira' })
  )
  expect(useCartStore.getState().items[0]?.days).toBe(1)
  submit()
  await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0))
  expect(quoteBody(request)).toMatchObject({
    tenantSlug: 'alfa',
    customerName: 'Ana',
    cpf: '529.982.247-25',
    deliveryType: 'PICKUP',
    items: [{ equipmentId: 'eq', quantity: 3, days: 1 }],
  })
  expect(
    request.mock.calls.some(
      ([path]) => path === '/api/equipments?tenantSlug=alfa'
    )
  ).toBe(true)
  expect(captured.classes).toEqual([])
})
it('campos e termos bloqueiam o envio e o conteúdo completo dos termos pode ser lido', async () => {
  const { client, request } = api()
  render(tree(client, storage()))
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitação' }))
  expect(captured.info).toHaveBeenCalledWith(
    'Aceite dos Termos',
    expect.anything()
  )
  expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Ler Termos de Uso' }))
  // Onda 134: os Termos são os da própria locadora (antes, o texto da GB de 19 de janeiro de 2026).
  expect(await screen.findByText(/2 de março de 2026/)).toBeTruthy()
  expect(screen.getByText('Regras da Locadora Alfa.')).toBeTruthy()
  expect(document.body.textContent).toContain('Prazo: sete dias.')
  expect(document.body.textContent).not.toMatch(/GB Loca|19 de janeiro de 2026/)
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  fireEvent.change(screen.getByLabelText('Nome Completo'), {
    target: { value: '' },
  })
  submit()
  expect(captured.info).toHaveBeenCalledWith(
    'Campos Obrigatórios',
    expect.objectContaining({ description: expect.stringContaining('Nome') })
  )
})
it.each([true, false])(
  'confirma finais de semana (%s) uma vez e continua com o carrinho atualizado',
  async (includeWeekends) => {
    useCartStore.setState({ items: [] })
    addItem({ includeWeekendsConfirmed: false })
    const { client, request } = api()
    render(tree(client, storage()))
    await ready()
    submit()
    await screen.findByText('Incluir finais de semana?')
    expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(false)
    fireEvent.click(
      screen.getByRole('button', {
        name: includeWeekends
          ? 'Sim, incluir finais de semana'
          : 'Não, apenas dias úteis',
      })
    )
    await waitFor(() =>
      expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(true)
    )
    expect(quoteBody(request).items[0].includeWeekends).toBe(includeWeekends)
    expect(captured.success).toHaveBeenCalledTimes(1)
  }
)
it('erro HTTP conserva itens e permite tentar novamente', async () => {
  const { client, request } = api(),
    original = request.getMockImplementation()!
  let fail = true
  request.mockImplementation((path, options) =>
    path === '/api/quotes' && fail
      ? Promise.reject(new HttpError('Indisponível', 409))
      : original(path, options)
  )
  render(tree(client, storage()))
  await ready()
  submit()
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith(
      'Erro',
      expect.objectContaining({ description: 'Indisponível' })
    )
  )
  expect(useCartStore.getState().items).toHaveLength(1)
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitação' }))
  await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0))
})
it('endereço e perfil preservam sucesso parcial e não enviam após uma gravação falhar', async () => {
  const { client, request } = api(),
    original = request.getMockImplementation()!
  request.mockImplementation((path, options) =>
    path === '/api/user/profile' && options?.method === 'PUT'
      ? Promise.reject(new HttpError('Falha do perfil', 500))
      : original(path, options)
  )
  render(tree(client, storage()))
  await ready()
  fireEvent.change(screen.getByLabelText('Empresa'), {
    target: { value: 'Empresa nova' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Entrega no endereço' }))
  fireEvent.change(await screen.findByDisplayValue('Rua A'), {
    target: { value: 'Rua Nova' },
  })
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Aceito os Termos de Uso' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitação' }))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Salvar e enviar' })
  )
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith(
      'Erro ao salvar informações do cliente',
      expect.objectContaining({ description: 'Falha do perfil' })
    )
  )
  expect(
    request.mock.calls.some(
      ([p, o]) => p === '/api/addresses' && o?.method === 'POST'
    )
  ).toBe(true)
  expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(false)
  expect(useCartStore.getState().items).toHaveLength(1)
})
it.each(['locadora', 'usuário', 'transporte'])(
  'envio antigo não limpa outro carrinho nem produz feedback após troca de %s',
  async (change) => {
    const { client, request } = api(),
      original = request.getMockImplementation()!,
      prefs = storage()
    let resolve!: (value: unknown) => void
    request.mockImplementation((path, options) =>
      path === '/api/quotes'
        ? new Promise((done) => {
            resolve = done
          })
        : original(path, options)
    )
    const view = render(tree(client, prefs))
    await ready()
    submit()
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    const slug = change === 'locadora' ? 'bravo' : 'alfa',
      user = change === 'usuário' ? 'bia' : 'ana'
    await act(async () => {
      await switchCartScope(JSON.stringify([slug, user]))
      addItem({ equipmentName: 'Outro carrinho' })
    })
    view.rerender(
      tree(change === 'transporte' ? api().client : client, prefs, slug, user)
    )
    await act(async () => {
      resolve({ id: 'antigo' })
    })
    expect(useCartStore.getState().items[0]?.equipmentName).toBe(
      'Outro carrinho'
    )
    expect(captured.success).not.toHaveBeenCalled()
    await ready()
    expect(prefs.getItem).toHaveBeenCalledWith(
      'customerInfoDismissed:' + JSON.stringify([slug, user])
    )
  }
)
it('falha ao ler preferências oferece retry sem assumir dispensa nem iniciar envio', async () => {
  const { client, request } = api(),
    prefs = storage()
  prefs.getItem.mockRejectedValueOnce(new Error('Armazenamento indisponível'))
  render(tree(client, prefs))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Não foi possível carregar suas preferências.'
  )
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await ready()
})

it('datas explícitas consultam disponibilidade e impedem envio quando o estoque diário falta', async () => {
  useCartStore.setState({ items: [] })
  addItem({
    startDate: new Date('2033-03-01T00:00:00Z'),
    endDate: new Date('2033-03-01T00:00:00Z'),
  })
  const { client, request } = api()
  render(tree(client, storage()))
  await ready()
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('Equipamento indisponível')
  )
  submit()
  expect(captured.error).toHaveBeenCalledWith(
    'Erro de Disponibilidade',
    expect.anything()
  )
  expect(
    request.mock.calls.some(
      ([p]) => p.includes('/eq/availability?') && p.endsWith('tenantSlug=alfa')
    )
  ).toBe(true)
  expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(false)
  expect(useCartStore.getState().items).toHaveLength(1)
})

// Onda 134 (decisão do dono D-C, parte 1): sem Termos publicados, o app envia sem a caixa de aceite; na falha de
// leitura, o envio fica bloqueado até recarregar.
it('Termos ausentes: sem a caixa de aceite e o pedido segue', async () => {
  // Carrinho limpo: o item do beforeEach pode herdar as datas do teste anterior (mesmo equipamento).
  useCartStore.setState({ items: [] })
  addItem()
  termos.resposta = {
    ok: false,
    status: 404,
    data: { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' },
  }
  const { client, request } = api()
  render(tree(client, storage()))
  await ready({ termos: false })
  await waitFor(() =>
    expect(
      request.mock.calls.some(([p]) =>
        String(p).startsWith('/api/settings/public/legal-documents/terms')
      )
    ).toBe(true)
  )
  await act(async () => {})
  expect(
    screen.queryByRole('checkbox', { name: 'Aceito os Termos de Uso' })
  ).toBeNull()
  expect(screen.queryByRole('button', { name: 'Ler Termos de Uso' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retirada no local' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitação' }))
  await waitFor(() =>
    expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(true)
  )
})

it('falha ao ler os Termos: aviso e envio bloqueado', async () => {
  // Carrinho limpo: o item do beforeEach pode herdar as datas do teste anterior (mesmo equipamento).
  useCartStore.setState({ items: [] })
  addItem()
  termos.resposta = { ok: false, status: 500, data: null }
  const { client, request } = api()
  render(tree(client, storage()))
  await ready({ termos: false })
  expect(
    await screen.findByText(
      'Não foi possível carregar os Termos de Uso da locadora. Recarregue a página para enviar a solicitação.'
    )
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Retirada no local' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitação' }))
  await act(async () => {})
  expect(request.mock.calls.some(([p]) => p === '/api/quotes')).toBe(false)
  expect(captured.error).toHaveBeenCalledWith(
    'Termos de Uso indisponíveis',
    expect.anything()
  )
})
