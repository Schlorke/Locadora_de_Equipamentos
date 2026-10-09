import { createElement } from 'react'
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
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
  vi.unstubAllGlobals()
})
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
  refresh = vi.fn(async () => {})
) {
  let client: HttpClient = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(
    () =>
      useFinancialEntryDetails({
        refreshAll: refresh,
        viewMode: 'list',
        loadEntries: refresh,
        loadCalendar: refresh,
        loadDashboardData: refresh,
        entries: [],
        searchParams: new URLSearchParams() as Parameters<
          typeof useFinancialEntryDetails
        >[0]['searchParams'],
      }),
    {
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client, children }),
    }
  )
  return {
    ...hook,
    refresh,
    replace() {
      client = createHttpClient({ fetcher: async () => Response.json({}) })
      hook.rerender()
    },
  }
}
it('usa origem configurada e conserva processamento baseado somente em 202', async () => {
  vi.stubGlobal('confirm', () => true)
  const fetcher = vi.fn<
    (input: string, init?: RequestInit) => Promise<Response>
  >(async () => Response.json({ operationId: 'queued' }, { status: 202 }))
  const hook = setup(fetcher)
  await act(async () => hook.result.current.regenerateBoleto('p/1'))
  expect(fetcher.mock.calls[0]).toEqual([
    'https://api.example.test/api/payments/boleto/p%2F1/regenerate',
    expect.objectContaining({ method: 'PUT', credentials: 'include' }),
  ])
  expect(notify.info).toHaveBeenCalledWith(
    'Solicitação registrada. O boleto está em processamento.'
  )
  expect(notify.success).not.toHaveBeenCalled()
  await act(async () =>
    hook.result.current.updateEntryDueDate('p', '2026-12-01')
  )
  expect(notify.info).toHaveBeenCalledWith(
    'Reemissão solicitada; o vencimento será atualizado após confirmação.'
  )
})
it.each([202, 409])(
  'resposta %i anterior não emite toast nem refresh após troca do transporte',
  async (status) => {
    vi.stubGlobal('confirm', () => true)
    let resolve!: (response: Response) => void
    const fetcher = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    const hook = setup(fetcher)
    let pending!: Promise<void>
    act(() => {
      pending = hook.result.current.regenerateBoleto('p')
    })
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    hook.replace()
    await act(async () => {
      resolve(Response.json({ error: 'Old response' }, { status }))
      await pending
    })
    expect(hook.refresh).not.toHaveBeenCalled()
    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
  }
)
it('a releitura de vencimento que termina depois da desmontagem não emite notificação', async () => {
  const releases: Array<() => void> = []
  const refresh = vi.fn(
    () =>
      new Promise<void>((done) => {
        releases.push(done)
      })
  )
  const hook = setup(
    async () => Response.json({ operationId: 'pending' }, { status: 202 }),
    refresh
  )
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.updateEntryDueDate('p', '2026-12-01')
  })
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
  hook.unmount()
  await act(async () => {
    for (const release of releases) release()
    await pending
  })
  expect(notify.info).not.toHaveBeenCalled()
})
