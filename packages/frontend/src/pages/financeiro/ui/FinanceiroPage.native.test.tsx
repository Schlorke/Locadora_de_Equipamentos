// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { AdminFinanceiroPageWrapper } from './FinanceiroPage.native'
import { DEFAULT_FINANCIAL_SETTINGS, type FinancialEntry } from '../model/tipos'
import type { FinancialFile } from '../model/export'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  error: vi.fn(),
  success: vi.fn(),
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
  vi.clearAllMocks()
  captured.classes.length = 0
})
const entry = (index: number): FinancialEntry => ({
  id: 'p' + index,
  quoteId: 'q' + index,
  quoteCode: 'Q-' + index,
  rentalId: null,
  legacyExternalCode: null,
  customerName: 'Cliente ' + index,
  customerEmail: 'cliente@example.test',
  customerDocument: 'documento',
  grossAmount: 100,
  netAmount: 94,
  taxRate: 6,
  taxDocumentType: 'CPF',
  invoiceNumber: null,
  boletoIssuedAt: null,
  invoiceIssuedAt: null,
  dueDate: '2020-01-01T12:00:00.000Z',
  paidAt: null,
  settledAt: null,
  billingStatus: 'UNPAID',
})
function setup(
  options: {
    quoteId?: string
    denyDelete?: boolean
    denyFile?: boolean
    denyAdjustment?: boolean
  } = {}
) {
  const entries = Array.from({ length: 12 }, (_, index) => entry(index))
  const share = vi.fn<(file: FinancialFile) => Promise<void>>(async () => {})
  const navigate = vi.fn(),
    ask = vi.fn(async () => true)
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    const url = new URL(path)
    if (url.pathname.endsWith('/pdf-oficio'))
      return options.denyFile
        ? Response.json({ error: 'Recusado' }, { status: 409 })
        : new Response('%PDF-private', {
            headers: { 'Content-Type': 'application/pdf' },
          })
    if (url.pathname.endsWith('/export'))
      return new Response(new Uint8Array([0, 255, 128, 10]), {
        headers: { 'Content-Type': 'application/pdf' },
      })
    if (
      url.pathname.endsWith('/due-date') ||
      url.pathname.endsWith('/regenerate')
    )
      return Response.json({ processing: 'PENDING' }, { status: 202 })
    if (url.pathname.endsWith('/adjustments'))
      return init?.method === 'POST'
        ? Response.json(
            options.denyAdjustment ? { error: 'Histórico preservado' } : {},
            { status: options.denyAdjustment ? 409 : 200 }
          )
        : Response.json({ adjustments: [] })
    if (init?.method === 'DELETE')
      return Response.json(
        { error: 'Histórico preservado' },
        { status: options.denyDelete ? 409 : 200 }
      )
    if (url.pathname.endsWith('/settings'))
      return Response.json({ settings: DEFAULT_FINANCIAL_SETTINGS })
    if (url.pathname.endsWith('/calendar'))
      return Response.json({
        events: [
          {
            id: 'p0',
            title: 'Evento financeiro',
            start: new Date().toISOString(),
            status: 'UNPAID',
            amount: 100,
          },
        ],
      })
    if (url.pathname.endsWith('/revenue'))
      return Response.json({
        revenueHistory: [{ month: 'Mês atual', revenue: 900 }],
        revenueByCategory: [{ categoryName: 'Furadeiras', revenue: 700 }],
      })
    if (url.pathname.endsWith('/aging'))
      return Response.json({
        agingData: [
          { range: '1 a 30 dias', amount: 300, count: 3, status: 'slight' },
        ],
        topDebtors: [
          {
            clientName: 'Devedor Alfa',
            overdueAmount: 200,
            daysOverdue: 9,
            status: 'overdue',
          },
        ],
        delinquencyRate: 12,
      })
    return Response.json({
      entries,
      totals: {
        gross: 1200,
        net: 1128,
        paid: 0,
        paidNet: 0,
        paidCount: 0,
        unpaid: 1200,
        unpaidCount: 12,
        awaiting: 0,
        awaitingCount: 0,
        count: 12,
      },
    })
  })
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  render(
    <FrontendSessionFixture>
      <ApiClientProvider client={client}>
        <AdminFinanceiroPageWrapper
          requestedQuoteId={options.quoteId}
          shareDocument={share}
          navigate={navigate}
          requestRegeneration={ask}
        />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  return { fetcher, share, navigate, ask }
}
it('pagina dez, seleciona a página e exporta os IDs usando bytes autenticados', async () => {
  const hook = setup()
  await screen.findByText('Página 1 de 2')
  expect(
    screen.getAllByRole('button', { name: /Exibir lançamento p/ })
  ).toHaveLength(10)
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(await screen.findByText('Página 2 de 2')).toBeTruthy()
  expect(
    screen.getAllByRole('button', { name: /Exibir lançamento p/ })
  ).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Selecionar página' }))
  fireEvent.click(screen.getByRole('button', { name: 'Exportar selecionados' }))
  await waitFor(() => expect(hook.share).toHaveBeenCalledOnce())
  const [path, init] = hook.fetcher.mock.calls.find(([path]) =>
    path.includes('/export')
  )!
  expect(new URL(path).searchParams.get('ids')).toBe('p10,p11')
  expect(init).toMatchObject({
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  const file = hook.share.mock.calls[0]![0]
  expect(file.name).toBe('relatorio-financeiro-oficio.pdf')
  expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(
    new Uint8Array([0, 255, 128, 10])
  )
  expect(file.isCurrent()).toBe(true)
  expect(captured.classes).toEqual([])
})
it('abre por quoteId, navega ao orçamento e conserva vencimento quando recebe 202', async () => {
  const hook = setup({ quoteId: 'q0' })
  await screen.findByRole('button', { name: 'Ver orçamento' })
  fireEvent.click(screen.getByRole('button', { name: 'Ver orçamento' }))
  expect(hook.navigate).toHaveBeenCalledWith(
    '/admin/orcamentos?search=Q-0&quoteId=q0'
  )
  fireEvent.change(screen.getByLabelText('Vencimento (AAAA-MM-DD)'), {
    target: { value: '2033-11-01' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar vencimento' }))
  await waitFor(() =>
    expect(captured.info).toHaveBeenCalledWith(
      'Reemissão solicitada; o vencimento será atualizado após confirmação.'
    )
  )
  expect(captured.success).not.toHaveBeenCalled()
  const [path, init] = hook.fetcher.mock.calls.find(([path]) =>
    path.includes('/due-date')
  )!
  expect(path).toContain('/api/admin/financial/entries/p0/due-date')
  expect(init?.method).toBe('PATCH')
  fireEvent.click(screen.getByRole('button', { name: 'Regenerar boleto' }))
  await waitFor(() => expect(hook.ask).toHaveBeenCalledOnce())
  expect(captured.success).not.toHaveBeenCalled()
})
it('mostra dados reais dos indicadores e agenda diária/semanal/mensal navegável', async () => {
  const hook = setup()
  await screen.findByText('Página 1 de 2')
  fireEvent.click(screen.getByRole('button', { name: 'Indicadores' }))
  expect(await screen.findByText(/Devedor Alfa/)).toBeTruthy()
  expect(screen.getAllByText(/Furadeiras/).length).toBeGreaterThan(0)
  expect(
    hook.fetcher.mock.calls.some(([path]) =>
      new URL(path).pathname.endsWith('/revenue')
    )
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Calendário' }))
  expect(await screen.findByText(/Evento financeiro/)).toBeTruthy()
  for (const mode of ['Diário', 'Mensal', 'Semanal'])
    fireEvent.click(screen.getByRole('button', { name: mode }))
  fireEvent.click(screen.getByRole('button', { name: 'Exibir lançamento p0' }))
  expect(
    await screen.findByRole('button', { name: 'Ver orçamento' })
  ).toBeTruthy()
})
it('salva e restaura alíquotas mantendo os campos avançados no PATCH', async () => {
  const hook = setup()
  await screen.findByText('Página 1 de 2')
  fireEvent.change(screen.getByLabelText('CPF (%)'), { target: { value: '7' } })
  fireEvent.click(
    screen.getByRole('button', { name: 'Configurações avançadas' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Lucro Presumido' }))
  fireEvent.change(screen.getByLabelText('IRPJ Presumido (%)'), {
    target: { value: '4,8' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alíquotas' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Alíquotas financeiras salvas'
    )
  )
  const [, init] = hook.fetcher.mock.calls.find(
    ([, init]) => init?.method === 'PATCH'
  )!
  expect(JSON.parse(String(init?.body))).toMatchObject({
    cpfRate: 7,
    taxRegime: 'LUCRO_PRESUMIDO',
    irpjPresumidoRate: 4.8,
    ibsCbsActive: false,
  })
  fireEvent.change(screen.getByLabelText('CPF (%)'), { target: { value: '9' } })
  fireEvent.click(screen.getByRole('button', { name: 'Restaurar alíquotas' }))
  expect((screen.getByLabelText('CPF (%)') as HTMLInputElement).value).toBe('7')
})
it('reajuste usa comando existente e preserva uma negativa sem anunciar sucesso', async () => {
  const hook = setup({ quoteId: 'q0', denyAdjustment: true })
  await screen.findByRole('button', { name: 'Novo reajuste' })
  fireEvent.click(screen.getByRole('button', { name: 'Novo reajuste' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mão de Obra' }))
  fireEvent.change(screen.getByLabelText('Valor adicional 1'), {
    target: { value: '1000' },
  })
  fireEvent.change(screen.getByLabelText('Justificativa 1'), {
    target: { value: 'Serviço adicional' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar reajuste' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro', {
      description: 'Histórico preservado',
    })
  )
  const [, init] = hook.fetcher.mock.calls.find(
    ([, init]) => init?.method === 'POST'
  )!
  expect(JSON.parse(String(init?.body))).toEqual({
    category: 'LABOR',
    amount: 10,
    justification: 'Serviço adicional',
    sendEmail: true,
    sendWhatsapp: true,
  })
  expect(captured.success).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Registrar reajuste' })
  ).toBeTruthy()
})
it('exclusão confirmada preserva recusa e ofício negativo não vira arquivo', async () => {
  const hook = setup({ quoteId: 'q0', denyDelete: true, denyFile: true })
  await screen.findByRole('button', { name: 'Baixar ofício' })
  fireEvent.click(screen.getByRole('button', { name: 'Baixar ofício' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Erro ao gerar ofício')
  )
  expect(hook.share).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }))
  expect(
    hook.fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')
  ).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
  await waitFor(() =>
    expect(captured.error).toHaveBeenCalledWith('Histórico preservado')
  )
  expect(captured.success).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy()
})

it('categorias já usadas ficam desabilitadas em outro item de reajuste', async () => {
  setup({ quoteId: 'q0' })
  await screen.findByRole('button', { name: 'Novo reajuste' })
  fireEvent.click(screen.getByRole('button', { name: 'Novo reajuste' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mão de Obra' }))
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar item' }))
  const choices = screen.getAllByRole('button', { name: 'Mão de Obra' })
  expect((choices[0] as HTMLButtonElement).disabled).toBe(false)
  expect((choices[1] as HTMLButtonElement).disabled).toBe(true)
})
