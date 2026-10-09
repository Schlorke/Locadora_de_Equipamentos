// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useFinancialEntryDetails } from './detalhe.web'

const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: notify }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
  refresh = vi.fn(async () => {})
) {
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(
    () =>
      useFinancialEntryDetails({
        refreshAll: refresh,
        loadEntries: refresh,
        loadCalendar: refresh,
        loadDashboardData: refresh,
        viewMode: 'dashboard',
        entries: [],
        searchParams: new URLSearchParams() as ReturnType<
          typeof import('next/navigation').useSearchParams
        >,
      }),
    {
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client, children }),
    }
  )
  return { ...hook, refresh }
}
it('mostra recusa de preservar histórico e não executa refresh/exclusão local', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async () =>
    Response.json(
      {
        error: 'Histórico financeiro preservado',
        code: 'FINANCIAL_HISTORY_PRESERVED',
      },
      { status: 409 }
    )
  )
  const hook = setup(fetcher)
  await act(async () => hook.result.current.deleteEntry('p/1'))
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://api.example.test/api/admin/financial/entries/p%2F1'
  )
  expect(fetcher.mock.calls[0]![1]?.method).toBe('DELETE')
  expect(hook.refresh).not.toHaveBeenCalled()
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).toHaveBeenCalledWith('Histórico financeiro preservado')
})
it('status usa PATCH e descarta feedback após unmount durante o refresh', async () => {
  const releases: Array<() => void> = []
  const refresh = vi.fn(
    async () => new Promise<void>((resolve) => releases.push(resolve))
  )
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async () => Response.json({ success: true }))
  const hook = setup(fetcher, refresh)
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.updateBillingStatus('p', 'SETTLED')
  })
  await waitFor(() => expect(releases).toHaveLength(3))
  hook.unmount()
  await act(async () => {
    for (const resolve of releases) resolve()
    await pending
  })
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
    billingStatus: 'SETTLED',
  })
  expect(notify.success).not.toHaveBeenCalled()
})
