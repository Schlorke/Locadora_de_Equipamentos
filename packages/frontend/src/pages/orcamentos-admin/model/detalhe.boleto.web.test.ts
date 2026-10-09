import { createElement } from 'react'
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { useQuoteDetails } from './detalhe.web'

const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: notify }))
vi.mock('../../../features/selos-admin', () => ({
  invalidateAdminBadges: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
  update = vi.fn(async () => null)
) {
  let client: HttpClient = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const locks = new Set<string>()
  const hook = renderHook(
    () =>
      useQuoteDetails({
        updateQuoteInState: update,
        fetchQuotes: vi.fn(async () => []),
        quotesRef: { current: [] },
        boletoActionLocksRef: { current: locks },
        loading: false,
        quotes: [],
      }),
    {
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client, children }),
    }
  )
  return {
    ...hook,
    locks,
    update,
    replace() {
      client = createHttpClient({ fetcher: async () => Response.json({}) })
      hook.rerender()
    },
  }
}
it('conserva POST sem corpo e 202 sem marcador, e relê o orçamento antes do feedback', async () => {
  const fetcher = vi.fn<
    (input: string, init?: RequestInit) => Promise<Response>
  >(async () => Response.json({ operationId: 'queued' }, { status: 202 }))
  const hook = setup(fetcher)
  await act(async () => hook.result.current.handleGenerateBoleto('q/1'))
  expect(fetcher.mock.calls[0]).toEqual([
    'https://api.example.test/api/admin/quotes/q%2F1/generate-boleto',
    expect.objectContaining({ method: 'POST' }),
  ])
  expect(hook.update).toHaveBeenCalledWith('q/1')
  expect(notify.info).toHaveBeenCalledWith('Boleto em processamento', {
    description: 'Solicitação registrada. O boleto está em processamento.',
  })
  expect(notify.success).not.toHaveBeenCalled()
  expect(hook.locks.size).toBe(0)
})
it('mantém a recusa de vencimento sem alterar orçamento ou anunciar emissão', async () => {
  const hook = setup(async () =>
    Response.json({ error: 'Pagamento exige conciliação' }, { status: 409 })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await act(async () =>
    hook.result.current.handleUpdateBoletoDueDate('q', 'p', '2026-12-01')
  )
  expect(hook.update).not.toHaveBeenCalled()
  expect(notify.error).toHaveBeenCalledWith('Erro', {
    description: 'Pagamento exige conciliação',
  })
  expect(notify.success).not.toHaveBeenCalled()
  expect(hook.locks.size).toBe(0)
})
it('bloqueia clique duplicado e descarta a emissão de um transporte encerrado', async () => {
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
    pending = hook.result.current.handleGenerateBoleto('q')
  })
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  await act(async () => hook.result.current.handleGenerateBoleto('q'))
  expect(fetcher).toHaveBeenCalledOnce()
  hook.replace()
  await act(async () => {
    resolve(Response.json({ operationId: 'old' }, { status: 202 }))
    await pending
  })
  expect(hook.update).not.toHaveBeenCalled()
  expect(notify.info).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
  expect(hook.locks.size).toBe(0)
})
it('uma releitura antiga que termina depois da desmontagem não emite feedback', async () => {
  let release!: () => void
  const update = vi.fn(
    () =>
      new Promise<null>((done) => {
        release = () => done(null)
      })
  )
  const hook = setup(
    async () => Response.json({ operationId: 'queued' }, { status: 202 }),
    update
  )
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleGenerateBoleto('q')
  })
  await waitFor(() => expect(update).toHaveBeenCalledOnce())
  hook.unmount()
  await act(async () => {
    release()
    await pending
  })
  expect(notify.info).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
  expect(hook.locks.size).toBe(0)
})
