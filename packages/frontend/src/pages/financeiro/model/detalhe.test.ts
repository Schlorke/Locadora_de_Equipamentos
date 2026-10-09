// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useFinancialEntryDetailsModel } from './detalhe'
const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
function setup(
  requestRegeneration: (message: string) => boolean | Promise<boolean>
) {
  const fetcher = vi.fn(async () =>
    Response.json({ processing: 'PENDING' }, { status: 202 })
  )
  const refresh = vi.fn(async () => {})
  let client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const params = {
    refreshAll: refresh,
    loadEntries: refresh,
    loadCalendar: refresh,
    loadDashboardData: refresh,
    entries: [],
    viewMode: 'table',
    searchParams: new URLSearchParams(),
    navigate: vi.fn(),
    requestRegeneration,
  }
  const hook = renderHook(() => useFinancialEntryDetailsModel(params), {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  return {
    ...hook,
    fetcher,
    refresh,
    replace() {
      client = createHttpClient({
        baseUrl: 'https://next.example.test',
        fetcher,
      })
      hook.rerender()
    },
  }
}
it('aguarda confirmação assíncrona e usa PUT/202 sem declarar PDF pronto', async () => {
  let accept!: (result: boolean) => void
  const ask = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        accept = resolve
      })
  )
  const hook = setup(ask)
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.regenerateBoleto('p/1')
  })
  expect(ask).toHaveBeenCalledWith(
    'Solicitar reemissão do boleto? O pagamento precisa ser conciliado antes de uma nova cobrança.'
  )
  expect(hook.fetcher).not.toHaveBeenCalled()
  await act(async () => {
    accept(true)
    await pending
  })
  expect(hook.fetcher).toHaveBeenCalledWith(
    'https://api.example.test/api/payments/boleto/p%2F1/regenerate',
    expect.objectContaining({ method: 'PUT', credentials: 'include' })
  )
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.info).toHaveBeenCalled()
  expect(hook.refresh).toHaveBeenCalledOnce()
})
it('cancelamento não envia mutação', async () => {
  const hook = setup(async () => false)
  await act(async () => hook.result.current.regenerateBoleto('p'))
  expect(hook.fetcher).not.toHaveBeenCalled()
  expect(hook.refresh).not.toHaveBeenCalled()
})
it('confirmação antiga não envia mutação para outra revisão do transporte', async () => {
  let accept!: (result: boolean) => void
  const hook = setup(
    () =>
      new Promise<boolean>((resolve) => {
        accept = resolve
      })
  )
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.regenerateBoleto('p')
  })
  await waitFor(() => expect(accept).toBeTypeOf('function'))
  hook.replace()
  await act(async () => {
    accept(true)
    await pending
  })
  expect(hook.fetcher).not.toHaveBeenCalled()
  expect(notify.info).not.toHaveBeenCalled()
})

it('mantém uma única confirmação por lançamento enquanto a porta aguarda', async () => {
  let accept!: (result: boolean) => void
  const ask = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          accept = resolve
        })
    ),
    hook = setup(ask)
  let first!: Promise<void>, second!: Promise<void>
  act(() => {
    first = hook.result.current.regenerateBoleto('p')
    second = hook.result.current.regenerateBoleto('p')
  })
  expect(ask).toHaveBeenCalledOnce()
  expect(hook.result.current.regeneratingBoletoId).toBe('p')
  await act(async () => {
    accept(true)
    await Promise.all([first, second])
  })
  expect(hook.fetcher).toHaveBeenCalledOnce()
  expect(hook.result.current.regeneratingBoletoId).toBeNull()
})
