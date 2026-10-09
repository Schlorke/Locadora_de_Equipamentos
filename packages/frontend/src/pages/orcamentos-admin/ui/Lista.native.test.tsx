// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  AdminQuotesPageWrapper,
  type AdminQuotesPageProps,
} from './Lista.native'
import type { Quote } from '../../../entities/orcamento'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
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
  ...(await import('../../../../../ui/src/native/CurrencyInput.native')),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: captured }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  captured.classes.length = 0
})
const quote = (i: number): Quote => ({
  id: 'q' + i,
  quoteCode: 'Q-' + i,
  name: 'Cliente ' + i,
  email: 'cliente' + i + '@example.test',
  phone: '123',
  status: 'pending',
  totalPrice: 100,
  startDate: '2033-03-04T12:00:00',
  endDate: '2033-03-08T12:00:00',
  createdAt: '2033-03-04T12:00:00',
  updatedAt: '2033-03-04T12:00:00',
  equipments: [],
  items: [
    {
      id: 'item' + i,
      quantity: 1,
      days: 3,
      pricePerDay: 10,
      total: 30,
      equipment: { id: 'e1', name: 'Furadeira' },
    },
  ],
  payments: [],
  deliveryType: 'DELIVERY',
  deliveryAddress: {
    street: 'Rua A',
    number: '1',
    city: 'Teste',
    state: 'SP',
    zipCode: '12345678',
  },
})
function setup(
  options: {
    pendingPatch?: Promise<Response>
    approved?: boolean
    paid?: boolean
    failDelete?: boolean
  } = {}
) {
  let quotes = Array.from({ length: 23 }, (_, i) => quote(i))
  if (options.approved)
    quotes[0] = {
      ...quotes[0]!,
      status: 'approved',
      approvedAt: '2033-03-04',
      payments: options.paid
        ? [
            {
              id: 'p1',
              method: 'BOLETO',
              amount: 100,
              status: 'PAID',
              dueDate: '2033-03-10',
              metadata: {
                pdfUrl: 'https://storage.example.test/boleto.pdf',
                digitableLine: '1234',
              },
            },
          ]
        : [],
    }
  const fetcher = vi.fn(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const url = new URL(path),
        id = url.pathname.split('/')[4],
        current = quotes.find((q) => q.id === id) || quote(29)
      if (url.pathname.endsWith('/generate-boleto'))
        return Response.json({ processing: true }, { status: 202 })
      if (url.pathname.endsWith('/adjustments/download'))
        return new Response('%PDF-fixture', {
          headers: { 'Content-Type': 'application/pdf' },
        })
      if (url.pathname.endsWith('/adjustments'))
        return Response.json(
          init?.method === 'POST' ? { quote: current } : { adjustments: [] }
        )
      if (url.pathname.endsWith('/calculate-late-fee'))
        return Response.json({ lateFee: 10, daysLate: 2 })
      if (init?.method === 'DELETE')
        return Response.json(
          { error: 'Histórico preservado' },
          { status: options.failDelete ? 409 : 200 }
        )
      if (init?.method === 'PATCH') {
        if (options.pendingPatch) return options.pendingPatch
        const body = JSON.parse(String(init.body))
        quotes = quotes.map((q) =>
          q.id === id
            ? { ...q, ...body, status: body.status?.toLowerCase() || q.status }
            : q
        )
        return Response.json({ ok: true })
      }
      if (url.pathname === '/api/admin/quotes') {
        const limit = Number(url.searchParams.get('limit')),
          page = Number(url.searchParams.get('page') || 1)
        return Response.json({
          quotes: quotes.slice((page - 1) * limit, page * limit),
          pagination: {
            totalItems: quotes.length,
            totalPages: Math.ceil(quotes.length / limit),
          },
        })
      }
      return Response.json(current)
    }
  )
  return {
    fetcher,
    client: createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    }),
  }
}
function tree(
  client: ReturnType<typeof createHttpClient>,
  user = 'ana',
  requestedQuoteId?: string,
  ports: Pick<
    AdminQuotesPageProps,
    'shareDocument' | 'openDocument' | 'navigate'
  > = {
    shareDocument: vi.fn(async () => {}),
    openDocument: vi.fn(async () => {}),
    navigate: vi.fn((_path: string) => {}),
  }
) {
  return (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture
        userId={user}
        tenant={{
          tenant: { id: 'alfa', slug: 'alfa', name: 'Alfa', status: 'ACTIVE' },
          membershipId: 'm',
          role: 'ADMIN',
        }}
      >
        <AdminQuotesPageWrapper
          {...ports}
          requestedQuoteId={requestedQuoteId}
        />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
}
function clock() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2033-03-04T12:00:00'))
}
const open = async () => {
  await screen.findByRole('button', { name: 'Exibir q0' })
  fireEvent.click(screen.getByRole('button', { name: 'Exibir q0' }))
  await screen.findByText('Detalhes do Orçamento - Q-0')
}
const patches = (fetcher: ReturnType<typeof setup>['fetcher']) =>
  fetcher.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([, init]) => JSON.parse(String(init?.body)))
it('kanban pede 500, tabela usa vinte/paginação e busca/filtros enviam o contrato', async () => {
  clock()
  const h = setup()
  render(tree(h.client))
  await screen.findByRole('button', { name: 'Exibir q0' })
  expect(h.fetcher.mock.calls[0]?.[0]).toContain('limit=500')
  fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar orçamentos' }))
  await waitFor(() =>
    expect(h.fetcher.mock.calls.some(([url]) => url.includes('limit=20'))).toBe(
      true
    )
  )
  await screen.findByRole('button', { name: 'Próxima página' })
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  await screen.findByRole('button', { name: 'Exibir q22' })
  expect(screen.queryByRole('button', { name: 'Exibir q0' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Aprovados' }))
  fireEvent.click(screen.getByRole('button', { name: 'Último mês' }))
  fireEvent.click(screen.getByRole('button', { name: 'Até R$ 500' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar orçamentos' }), {
    target: { value: 'Cliente' },
  })
  await waitFor(() =>
    expect(
      h.fetcher.mock.calls.some(([url]) => {
        const p = new URL(url).searchParams
        return (
          p.get('search') === 'Cliente' &&
          p.get('status') === 'APPROVED' &&
          p.get('period') === 'month' &&
          p.get('valueRange') === 'low'
        )
      })
    ).toBe(true)
  )
  expect(captured.classes).toEqual([])
})
it('aprovação AT_END e rejeição com motivo usam o mesmo PATCH sem boletos falsos', async () => {
  clock()
  const h = setup()
  render(tree(h.client))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'No fim da locação' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar e Converter' }))
  await waitFor(() =>
    expect(patches(h.fetcher)).toContainEqual({
      status: 'APPROVED',
      paymentTerms: 'AT_END',
    })
  )
  cleanup()
  captured.success.mockClear()
  const other = setup()
  render(tree(other.client))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Rejeitar Orçamento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Informar motivo: não' }))
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Motivo da rejeição' }),
    { target: { value: 'Sem estoque disponível' } }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar rejeição' }))
  await waitFor(() =>
    expect(patches(other.fetcher)).toContainEqual({
      status: 'REJECTED',
      rejectionReason: 'Sem estoque disponível',
    })
  )
  expect(captured.classes).toEqual([])
})
it('edita dados/entrega/período por modelos comuns e aplica reajuste sem recalcular no host', async () => {
  clock()
  const h = setup()
  render(tree(h.client))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'novo@example.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  await waitFor(() =>
    expect(
      patches(h.fetcher).some((b) => b.email === 'novo@example.test')
    ).toBe(true)
  )
  await waitFor(() =>
    expect(screen.queryByText('Editar dados do cliente')).toBeNull()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Editar entrega' }))
  fireEvent.click(screen.getByRole('button', { name: 'Retirada' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  await waitFor(() =>
    expect(
      patches(h.fetcher).some(
        (b) => b.deliveryType === 'PICKUP' && b.deliveryFee === null
      )
    ).toBe(true)
  )
  await waitFor(() =>
    expect(screen.queryByText('Editar entrega e endereço')).toBeNull()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Editar período item0' }))
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Início do item (AAAA-MM-DD)' }),
    { target: { value: '2033-03-04' } }
  )
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Fim do item (AAAA-MM-DD)' }),
    { target: { value: '2033-03-09' } }
  )
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  await waitFor(() =>
    expect(
      patches(h.fetcher).some(
        (b) => b.updateItemDates?.endDate === '2033-03-09'
      )
    ).toBe(true)
  )
  await waitFor(() =>
    expect(screen.queryByText('Editar período do equipamento')).toBeNull()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar reajustes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mão de obra' }))
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Valor do reajuste 1' }),
    { target: { value: 'R$ 10,00' } }
  )
  fireEvent.change(screen.getByRole('textbox', { name: 'Justificativa 1' }), {
    target: { value: 'Trabalho extra' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar reajuste' }))
  await waitFor(() =>
    expect(
      h.fetcher.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)))
    ).toContainEqual({
      category: 'LABOR',
      amount: 10,
      justification: 'Trabalho extra',
      sendEmail: true,
      sendWhatsapp: true,
    })
  )
  expect(captured.classes).toEqual([])
})
it('geração 202 conserva processamento e não anuncia boleto emitido', async () => {
  clock()
  const h = setup({ approved: true })
  render(tree(h.client))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Gerar Boleto' }))
  await waitFor(() => expect(captured.info).toHaveBeenCalled())
  expect(
    h.fetcher.mock.calls.find(([url]) => url.endsWith('/generate-boleto'))?.[1]
      ?.body
  ).toBeUndefined()
  expect(captured.success).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Abrir boleto' })).toBeNull()
})
it('boleto pago não permite vencimento, URL vem do servidor e exclusão recusada mantém detalhe', async () => {
  clock()
  const h = setup({ approved: true, paid: true, failDelete: true }),
    ports = {
      shareDocument: vi.fn(async () => {}),
      openDocument: vi.fn(async () => {}),
    }
  render(tree(h.client, 'ana', undefined, ports))
  await open()
  expect(
    (
      screen.getByRole('button', {
        name: 'Salvar vencimento',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir boleto' }))
  await waitFor(() =>
    expect(ports.openDocument).toHaveBeenCalledWith(
      'https://storage.example.test/boleto.pdf'
    )
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Excluir Permanentemente' })
  )
  expect(
    h.fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')
  ).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  await waitFor(() => expect(captured.error).toHaveBeenCalled())
  expect(screen.getByText('Detalhes do Orçamento - Q-0')).toBeTruthy()
  expect(captured.success).not.toHaveBeenCalled()
})
it('link abre orçamento fora da página e agenda navega por criação sem regras novas', async () => {
  clock()
  const h = setup()
  render(tree(h.client, 'ana', 'q29'))
  await screen.findByText('Detalhes do Orçamento - Q-29')
  fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhe' }))
  fireEvent.click(screen.getByRole('button', { name: 'Calendário' }))
  await screen.findByRole('heading', { name: 'Calendário de Orçamentos' })
  fireEvent.click(screen.getByRole('button', { name: 'Diário' }))
  expect(
    screen.getByRole('button', { name: 'Exibir q0 em 04/03/2033' })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Próximo período' }))
  expect(
    screen.queryByRole('button', { name: 'Exibir q0 em 04/03/2033' })
  ).toBeNull()
})
it('resposta antiga de aprovação não reabre seleção nem emite aviso após troca de sessão', async () => {
  clock()
  let resolve!: (r: Response) => void
  const h = setup({
      pendingPatch: new Promise((r) => {
        resolve = r
      }),
    }),
    view = render(tree(h.client))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar Orçamento' }))
  await waitFor(() => expect(patches(h.fetcher)).toHaveLength(1))
  view.rerender(tree(h.client, 'bruno'))
  await screen.findByRole('button', { name: 'Exibir q0' })
  await act(async () => {
    resolve(Response.json({ ok: true }))
    await Promise.resolve()
  })
  expect(screen.queryByText('Detalhes do Orçamento - Q-0')).toBeNull()
  expect(captured.success).not.toHaveBeenCalled()
  expect(captured.error).not.toHaveBeenCalled()
})

it('atalho financeiro usa o destino real e conserva search/quoteId', async () => {
  clock()
  const h = setup(),
    ports = {
      shareDocument: vi.fn(async () => {}),
      openDocument: vi.fn(async () => {}),
      navigate: vi.fn((_path: string) => {}),
    }
  render(tree(h.client, 'ana', undefined, ports))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Ver no Financeiro' }))
  expect(ports.navigate).toHaveBeenCalledWith(
    '/admin/financeiro?search=Q-0&quoteId=q0'
  )
})
