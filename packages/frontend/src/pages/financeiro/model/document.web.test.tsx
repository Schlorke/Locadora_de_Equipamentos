// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useFinancialDocument } from './document.web'

const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  const popup = {
    closed: false,
    close: vi.fn(),
    location: { href: '' },
    addEventListener:
      vi.fn<
        (_type: string, _callback: () => void, _options?: unknown) => void
      >(),
  }
  const open = vi
    .spyOn(window, 'open')
    .mockReturnValue(popup as unknown as Window)
  const createUrl = vi.fn<(_blob: Blob) => string>(() => 'blob:local-document'),
    revoke = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createUrl
      static revokeObjectURL = revoke
    }
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(({ id }) => useFinancialDocument(id), {
    initialProps: { id: 'p' },
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  return { ...hook, popup, open, createUrl, revoke }
}
it('abre a aba durante o clique e usa o PDF obtido por transporte autenticado', async () => {
  const fetcher = vi.fn<
    (input: string, init?: RequestInit) => Promise<Response>
  >(async () => new Response('%PDF-1.4\nprivate\n%%EOF'))
  const hook = setup(fetcher)
  await act(async () => hook.result.current())
  expect(hook.open).toHaveBeenCalledWith('', '_blank')
  expect(hook.open.mock.invocationCallOrder[0]).toBeLessThan(
    fetcher.mock.invocationCallOrder[0]!
  )
  expect(fetcher.mock.calls[0]).toEqual([
    'https://api.example.test/api/admin/financial/entries/p/pdf-oficio',
    expect.objectContaining({ credentials: 'include' }),
  ])
  expect(await hook.createUrl.mock.calls[0]![0].text()).toContain('%PDF')
  expect(hook.popup.location.href).toBe('blob:local-document')
  hook.popup.addEventListener.mock.calls[0]![1]()
  expect(hook.revoke).toHaveBeenCalledWith('blob:local-document')
})
it('fecha a aba vazia e descarta os bytes do lançamento anterior', async () => {
  let resolve!: (response: Response) => void
  const hook = setup(
    async () =>
      new Promise((done) => {
        resolve = done
      })
  )
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current()
  })
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  hook.rerender({ id: 'other' })
  await act(async () => {
    resolve(new Response('%PDF old'))
    await pending
  })
  expect(hook.popup.close).toHaveBeenCalledOnce()
  expect(hook.createUrl).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})
it('não abre JSON de negativa como se fosse PDF', async () => {
  const hook = setup(async () =>
    Response.json({ error: 'Não encontrado' }, { status: 404 })
  )
  await act(async () => hook.result.current())
  expect(hook.createUrl).not.toHaveBeenCalled()
  expect(hook.popup.close).toHaveBeenCalledOnce()
  expect(notify.error).toHaveBeenCalledWith('Erro ao gerar ofício')
})
