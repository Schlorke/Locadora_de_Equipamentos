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
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { NavigationProvider } from '../../../../../ui/src/contract/navigation'
import { PublicTenantProvider } from '../../../entities/organizacao'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
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
  ...(await import('../../../../../ui/src/native/Stack.native')),
  ...(await import('../../../../../ui/src/native/Text.native')),
  toast: { error: captured.error, success: captured.success },
}))

import { AdminDashboard } from './DashboardPage.native'
const stats = {
  totalEquipments: 12,
  availableEquipments: 8,
  totalCategories: 3,
  totalQuotes: 9,
  pendingQuotes: 2,
  approvedQuotes: 4,
  rejectedQuotes: 1,
  completedQuotes: 2,
  totalRevenue: 1000,
  monthlyRevenue: 42.5,
  utilizationRate: 33.3,
  conversionRate: 66.7,
  averageTicket: 10.5,
  quotesTrend: [{ date: '01/10', fullDate: '2026-10-01', count: 4 }],
  equipmentByCategory: [
    {
      categoryId: 'concreto',
      categoryName: 'Concreto',
      count: 5,
      available: 3,
      bgColor: '',
      fontColor: '',
    },
  ],
  topEquipments: [
    { id: 'eq', name: 'Betoneira', requestCount: 7, category: 'Concreto' },
  ],
  equipmentROI: [
    {
      equipmentId: 'eq',
      equipmentName: 'Betoneira',
      purchasePrice: 100,
      totalRevenue: 150,
      totalMaintenanceCost: 10,
      roi: 40,
    },
  ],
  financialMetrics: {
    metrics: {
      mrr: 42.5,
      fleetUtilization: 33.3,
      overdueAmount: 12,
      averageTicket: 10.5,
      netProfit: 30,
    },
    trends: {
      mrr: 4,
      fleetUtilization: 2,
      overdueAmount: 1,
      averageTicket: 2,
      netProfit: 3,
    },
    sparklines: {
      mrr: [1, 2],
      fleetUtilization: [3, 4],
      overdueAmount: [5, 6],
      averageTicket: [7, 8],
      netProfit: [9, 10],
    },
  },
}
function api() {
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/dashboard')) return Response.json(stats)
    if (url.endsWith('limit=5'))
      return Response.json({
        quotes: [
          {
            id: 'q',
            name: 'Ana',
            email: 'ana@example.test',
            finalTotal: 0,
            totalPrice: 99,
            status: 'approved',
            createdAt: '2026-10-01',
            items: [],
          },
        ],
      })
    if (url.includes('/revenue'))
      return Response.json({
        revenueHistory: [{ month: 'Outubro', revenue: 42.5 }],
        revenueByCategory: [{ categoryName: 'Concreto', revenue: 30 }],
      })
    return Response.json({
      agingData: [
        { range: '1–30 dias', amount: 12, count: 1, status: 'slightDelay' },
      ],
      topDebtors: [
        {
          clientName: 'Ana',
          overdueAmount: 12,
          daysOverdue: 9,
          status: 'attention',
        },
      ],
    })
  })
  return {
    fetcher,
    client: createHttpClient({
      baseUrl: 'https://api.example.test',
      credentials: 'omit',
      getHeaders: () => ({
        Authorization: 'Bearer fixture',
        'x-tenant-id': 'alfa',
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
            <AdminDashboard />
          </NavigationProvider>
        </PublicTenantProvider>
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
}
beforeEach(() => {
  captured.classes.length = 0
  captured.error.mockReset()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('renderiza todas as seções com quatro leituras reais no transporte nativo configurado', async () => {
  const { client, fetcher } = api()
  render(tree(client))
  expect(await screen.findByText(/Ana · ana/)).toBeTruthy()
  for (const title of [
    'Visão Geral',
    'KPIs Financeiros',
    'Tendência de Orçamentos (7 dias)',
    'Distribuição de Status',
    'Evolução da Receita (Últimos 12 meses)',
    'Receita por Categoria',
    'Aging de Contas a Receber',
    'Maiores Devedores',
    'Distribuição por Categoria',
    'Métricas do Negócio',
    'Equipamentos Mais Solicitados',
    'ROI por Equipamento (Top 10)',
    'Ações Rápidas',
    'Orçamentos Recentes',
  ])
    expect(screen.getByRole('heading', { name: title })).toBeTruthy()
  expect(
    screen.getByText('Total de Equipamentos: 12 · 8 disponíveis')
  ).toBeTruthy()
  expect(screen.getByText(/0 itens · R\$\s*0,00/)).toBeTruthy()
  expect(screen.getByText('1–30 dias: 1 contas')).toBeTruthy()
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://api.example.test/api/admin/dashboard',
    'https://api.example.test/api/admin/quotes?limit=5',
    'https://api.example.test/api/admin/financial/revenue?months=12',
    'https://api.example.test/api/admin/financial/aging',
  ])
  for (const [, init] of fetcher.mock.calls as unknown as Array<
    [string, RequestInit]
  >)
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      headers: { Authorization: 'Bearer fixture', 'x-tenant-id': 'alfa' },
    })
  expect(captured.classes).toEqual([])
})
it('expande um gráfico nativo e fecha com hardware back; os atalhos mantêm seus contratos', async () => {
  const navigate = vi.fn(),
    { client } = api()
  render(tree(client, 'ana', 'alfa', navigate))
  await screen.findByText(/Ana · ana/)
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Expandir Tendência de Orçamentos (7 dias)',
    })
  )
  expect(
    within(screen.getByRole('dialog')).getByRole('heading', {
      name: 'Tendência de Orçamentos (7 dias)',
    })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Hardware back' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Gerenciar Categorias' }))
  expect(navigate).toHaveBeenCalledWith('/admin/categorias')
})
it('negativa HTTP conserva mensagem e retry inicia novo lote', async () => {
  const { client, fetcher } = api(),
    original = fetcher.getMockImplementation()!
  let denied = true
  fetcher.mockImplementation((url) =>
    url.endsWith('/dashboard') && denied
      ? Promise.resolve(new Response('Negado', { status: 403 }))
      : original(url)
  )
  render(tree(client))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Não foi possível carregar os dados principais do dashboard.'
  )
  denied = false
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await screen.findByText(/Ana · ana/)
  expect(
    fetcher.mock.calls.filter(([url]) => url.endsWith('/dashboard'))
  ).toHaveLength(2)
})
it.each(['usuario', 'locadora', 'transporte'])(
  'descarta retorno e expansão antigos ao trocar %s',
  async (kind) => {
    const { client } = api()
    let hold = false
    const finishes: Array<(data: unknown) => void> = []
    const stable = {
      request: (path: string, options: unknown) =>
        hold
          ? new Promise<unknown>((resolve) => finishes.push(resolve))
          : client.request(path, options as never),
    } as HttpClient
    const view = render(tree(stable))
    await screen.findByText(/Ana · ana/)
    fireEvent.click(
      screen.getByRole('button', { name: 'Expandir Distribuição de Status' })
    )
    hold = true
    const pending = {
      request: vi.fn(() => new Promise((resolve) => finishes.push(resolve))),
    } as unknown as HttpClient
    view.rerender(
      tree(
        kind === 'transporte' ? pending : stable,
        kind === 'usuario' ? 'bruno' : 'ana',
        kind === 'locadora' ? 'bravo' : 'alfa'
      )
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/Ana · ana/)).toBeNull()
    await waitFor(() => expect(finishes).toHaveLength(4))
    view.rerender(tree(api().client, 'nova', 'charlie'))
    await act(async () =>
      finishes.forEach((finish) =>
        finish({ ok: true, status: 200, text: JSON.stringify(stats) })
      )
    )
    await waitFor(() => expect(captured.error).not.toHaveBeenCalled())
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
          <AdminDashboard onBack={back} onSignOut={signOut} />
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
