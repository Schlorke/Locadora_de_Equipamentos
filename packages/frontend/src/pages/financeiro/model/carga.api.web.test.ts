// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { useFinancialData } from './carga.web'

const notify = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
const searchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  let client: HttpClient = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(() => useFinancialData(), {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  return {
    ...hook,
    replace(next: typeof fetcher) {
      client = createHttpClient({
        baseUrl: 'https://next.example.test',
        fetcher: next,
      })
      hook.rerender()
    },
  }
}
const response = (path: string, id = 'p') =>
  Response.json(
    path.includes('/entries')
      ? {
          entries: [
            { id, grossAmount: 10, netAmount: 8, billingStatus: 'UNPAID' },
          ],
          totals: { grossAmount: 10 },
        }
      : path.includes('/revenue')
        ? { revenueHistory: [{ month: '2033-03', revenue: 10 }] }
        : path.includes('/aging')
          ? { agingData: [], delinquencyRate: null }
          : { events: [] }
  )

it('preserva limite 10000, filtros, calendário e filtros dos dois gráficos no transporte configurado', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async (path) => response(path))
  const hook = setup(fetcher)
  await waitFor(() => expect(hook.result.current.initialLoad).toBe(false))
  expect(hook.result.current.entries[0]?.id).toBe('p')
  await act(async () => {
    hook.result.current.setSearchTerm('Q /1')
    hook.result.current.setStatusFilter('UNPAID')
  })
  await act(async () => hook.result.current.loadEntries())
  await act(async () => hook.result.current.loadCalendar())
  await act(async () => hook.result.current.loadDashboardData())
  const urls = fetcher.mock.calls.map(([url]) => new URL(url))
  expect(
    urls.some(
      (url) =>
        url.pathname.endsWith('/entries') &&
        url.searchParams.get('search') === 'Q /1' &&
        url.searchParams.get('status') === 'UNPAID' &&
        url.searchParams.get('limit') === '10000'
    )
  ).toBe(true)
  expect(
    urls.some(
      (url) =>
        url.pathname.endsWith('/calendar') &&
        url.searchParams.get('status') === 'UNPAID'
    )
  ).toBe(true)
  for (const name of ['revenue', 'aging'])
    expect(
      urls.some(
        (url) =>
          url.pathname.endsWith('/' + name) &&
          url.searchParams.get('search') === 'Q /1' &&
          url.searchParams.get('status') === 'UNPAID'
      )
    ).toBe(true)
  expect(hook.result.current.revenueHistory).toEqual([
    { month: '2033-03', revenue: 10 },
  ])
  expect(hook.result.current.delinquencyRate).toBe(0)
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    })
})

it('salva o snapshot de alíquotas por PATCH e reset volta ao snapshot salvo', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async (path) => response(path))
  const hook = setup(fetcher)
  await waitFor(() => expect(hook.result.current.initialLoad).toBe(false))
  await act(async () =>
    hook.result.current.setSettings((old) => ({ ...old, cpfRate: 7 }))
  )
  await act(async () => hook.result.current.saveRates())
  const call = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(call[0]).toBe('https://api.example.test/api/admin/financial/settings')
  expect(JSON.parse(String(call[1]?.body)).cpfRate).toBe(7)
  await act(async () =>
    hook.result.current.setSettings((old) => ({ ...old, cpfRate: 9 }))
  )
  await act(async () => hook.result.current.resetSettings())
  expect(hook.result.current.settings.cpfRate).toBe(7)
})

it('não aplica dados nem erro atrasados após trocar o transporte', async () => {
  const releases: Array<(response: Response) => void> = []
  const hook = setup(
    async () => new Promise<Response>((resolve) => releases.push(resolve))
  )
  await waitFor(() => expect(releases).toHaveLength(3))
  await act(async () => hook.replace(async (path) => response(path, 'novo')))
  await act(async () => hook.result.current.refreshAll())
  await act(async () => {
    for (const resolve of releases)
      resolve(Response.json({ entries: [{ id: 'antigo' }] }))
  })
  expect(hook.result.current.entries[0]?.id).toBe('novo')
  expect(notify.error).not.toHaveBeenCalled()
})
