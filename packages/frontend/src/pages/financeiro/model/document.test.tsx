// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useFinancialDocument } from './document'
import type { FinancialFilePorts } from './export'
const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('../../../shared/lib/toast', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
function setup(
  fetcher: (path: string, options?: RequestInit) => Promise<Response>
) {
  const deliver = vi.fn(async () => {}),
    close = vi.fn()
  const ports: FinancialFilePorts = {
    open: () => ({ deliver, close, isOpen: () => true }),
  }
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(({ id }) => useFinancialDocument(id, ports), {
    initialProps: { id: 'p/1' },
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  return { ...hook, deliver, close }
}
it('recusa JSON negativo sem compartilhar ofício fictício', async () => {
  const hook = setup(async () =>
    Response.json({ error: 'Histórico preservado' }, { status: 409 })
  )
  await act(async () => hook.result.current())
  expect(hook.deliver).not.toHaveBeenCalled()
  expect(notify.error).toHaveBeenCalledWith('Erro ao gerar ofício')
})
it('encerra a entrega de documento atrasado ao mudar lançamento', async () => {
  let release!: (response: Response) => void
  const hook = setup(
    async () =>
      new Promise((resolve) => {
        release = resolve
      })
  )
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current()
  })
  await waitFor(() => expect(release).toBeTypeOf('function'))
  hook.rerender({ id: 'other' })
  await act(async () => {
    release(new Response('%PDF-old'))
    await pending
  })
  expect(hook.deliver).not.toHaveBeenCalled()
  expect(hook.close).toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})
