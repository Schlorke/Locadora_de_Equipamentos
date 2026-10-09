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
  historyTree,
  historyRental,
  historyQuote,
  nativeHistoryApi,
} from '../../../../../../tests/helpers/customer-history'
const captured = vi.hoisted(() => ({
  classes: [] as string[],
  success: vi.fn(),
  error: vi.fn(),
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
  toast: captured,
}))
vi.mock(
  '../../../shared/lib/activity',
  async () =>
    await import('../../../shared/lib/activity/use-active-refresh.native')
)
import { HistoricoPage } from './HistoricoPage.native'
beforeEach(() => {
  captured.classes.length = 0
  captured.success.mockClear()
  captured.error.mockClear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function api() {
  let rentals = [historyRental],
    quotes = [
      historyQuote,
      {
        ...historyQuote,
        id: 'converted',
        items: [
          {
            ...historyQuote.items[0]!,
            equipment: { id: 'old', name: 'Duplicado', images: [] },
          },
        ],
      },
    ]
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'DELETE') {
      if (url.includes('rentals')) rentals = []
      else quotes = []
      return Response.json({ message: 'Removido' })
    }
    return Response.json(url.endsWith('rentals') ? { rentals } : { quotes })
  })
  return { fetcher, client: nativeHistoryApi(fetcher as typeof fetch) }
}
it('usa identidade e transporte configurados, deduplica conversão e mantém zero/navegação', async () => {
  const { client, fetcher } = api(),
    navigate = vi.fn()
  render(historyTree(<HistoricoPage />, client, 'ana', 'alfa', navigate))
  expect(await screen.findByText('Betoneira Alfa')).toBeTruthy()
  expect(await screen.findByText('Martelete Alfa')).toBeTruthy()
  expect(screen.queryByText('Duplicado')).toBeNull()
  expect(screen.getByText(/R\$\s*0,00/)).toBeTruthy()
  fireEvent.click(screen.getAllByRole('link', { name: 'Ver Detalhes' })[0]!)
  expect(navigate).toHaveBeenCalledWith('/area-cliente/historico/r%201')
  expect(fetcher.mock.calls.map(([url]) => url).sort()).toEqual([
    'https://api.example.test/api/client/rentals',
    'https://api.example.test/api/quotes',
  ])
  for (const [, options] of fetcher.mock.calls) {
    expect(options?.credentials).toBe('omit')
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer fixture'
    )
    expect(new Headers(options?.headers).get('x-tenant-id')).toBe('alfa')
  }
  expect(captured.classes).toEqual([])
})
it('filtra busca/status, limpa filtros e só remove após confirmação', async () => {
  const { client, fetcher } = api()
  render(historyTree(<HistoricoPage />, client))
  await screen.findByText('Betoneira Alfa')
  fireEvent.change(screen.getByLabelText('Buscar por equipamento'), {
    target: { value: 'martelete' },
  })
  expect(screen.queryByText('Betoneira Alfa')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Concluído' }))
  expect(screen.getByText('Nenhum orçamento encontrado')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  fireEvent.click(screen.getByRole('button', { name: 'Excluir do Histórico' }))
  expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
  await waitFor(() =>
    expect(captured.success).toHaveBeenCalledWith(
      'Locação removida do histórico com sucesso'
    )
  )
  expect(fetcher.mock.calls.find(([, o]) => o?.method === 'DELETE')?.[0]).toBe(
    'https://api.example.test/api/client/rentals/r%201'
  )
  expect(screen.queryByText('Betoneira Alfa')).toBeNull()
})
it.each(['user', 'slug', 'transport'])(
  'encerra leitura ao trocar %s',
  async (kind) => {
    let complete!: (response: Response) => void
    const initial = api()
    const fetcher = vi.fn((url: string) =>
      url.endsWith('rentals')
        ? new Promise<Response>((r) => (complete = r))
        : Promise.resolve(Response.json({ quotes: [] }))
    )
    const old = nativeHistoryApi(fetcher as typeof fetch),
      view = render(historyTree(<HistoricoPage />, old))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    const finishOld = complete
    view.rerender(
      historyTree(
        <HistoricoPage />,
        kind === 'transport' ? initial.client : old,
        kind === 'user' ? 'bia' : 'ana',
        kind === 'slug' ? 'bravo' : 'alfa'
      )
    )
    await act(async () =>
      finishOld(
        Response.json({
          rentals: [
            {
              ...historyRental,
              rental_items: [
                {
                  ...historyRental.rental_items[0]!,
                  equipments: {
                    ...historyRental.rental_items[0]!.equipments,
                    name: 'Resposta antiga',
                  },
                },
              ],
            },
          ],
        })
      )
    )
    expect(screen.queryByText('Resposta antiga')).toBeNull()
    expect(captured.error).not.toHaveBeenCalled()
  }
)

it('fecha confirmação de exclusão ao mudar o usuário', async () => {
  const { client } = api()
  const view = render(historyTree(<HistoricoPage />, client))
  await screen.findByText('Betoneira Alfa')
  fireEvent.click(screen.getByRole('button', { name: 'Excluir do Histórico' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  view.rerender(historyTree(<HistoricoPage />, client, 'bia'))
  await screen.findByText('Betoneira Alfa')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(captured.success).not.toHaveBeenCalled()
})
