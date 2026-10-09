// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { useQuotesData } from './dados.web'

const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
const searchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
const quote = {
  id: 'q',
  name: 'Cliente',
  email: 'fixture@example.test',
  status: 'PENDING',
  totalPrice: 10,
  createdAt: '2033-03-01T00:00:00Z',
  items: [],
}
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  let client: HttpClient = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(() => useQuotesData(), {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  return {
    ...hook,
    replace(next: typeof fetcher) {
      client = createHttpClient({ fetcher: next })
      hook.rerender()
    },
  }
}
it('preserva paginação e remove filtros ocultos do Kanban; atualiza somente o orçamento alvo', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async (path) =>
    Response.json(
      path.includes('?')
        ? { quotes: [quote], pagination: { totalItems: 31, totalPages: 2 } }
        : { ...quote, name: 'Atualizado' }
    )
  )
  const hook = setup(fetcher)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.totalPages).toBe(2)
  await act(async () => {
    hook.result.current.setViewMode('table')
    hook.result.current.setStatusFilter('pending')
    hook.result.current.setPeriodFilter('month')
    hook.result.current.setValueFilter('above1000')
  })
  await act(async () => hook.result.current.fetchQuotes())
  const table = new URL(fetcher.mock.calls.at(-1)![0])
  expect(table.searchParams.get('limit')).toBe('20')
  expect(table.searchParams.get('status')).toBe('PENDING')
  expect(table.searchParams.get('period')).toBe('month')
  expect(table.searchParams.get('valueRange')).toBe('above1000')
  await act(async () => hook.result.current.setViewMode('kanban'))
  await act(async () => hook.result.current.fetchQuotes())
  const kanban = new URL(fetcher.mock.calls.at(-1)![0])
  expect(kanban.searchParams.get('limit')).toBe('500')
  expect(kanban.searchParams.get('page')).toBe('1')
  for (const name of ['status', 'period', 'valueRange'])
    expect(kanban.searchParams.has(name)).toBe(false)
  await act(async () => hook.result.current.updateQuoteInState('q'))
  expect(hook.result.current.quotes[0]?.name).toBe('Atualizado')
})
it('descarta a listagem anterior quando o transporte é substituído', async () => {
  const releases: Array<(response: Response) => void> = []
  const hook = setup(
    async () => new Promise<Response>((resolve) => releases.push(resolve))
  )
  await waitFor(() => expect(releases.length).toBeGreaterThan(0))
  await act(async () =>
    hook.replace(async () =>
      Response.json({ quotes: [{ ...quote, id: 'novo' }] })
    )
  )
  await waitFor(() => expect(hook.result.current.quotes[0]?.id).toBe('novo'))
  await act(async () => {
    for (const resolve of releases) resolve(Response.json({ quotes: [quote] }))
  })
  expect(hook.result.current.quotes[0]?.id).toBe('novo')
  expect(notify.error).not.toHaveBeenCalled()
})
