// @vitest-environment jsdom
import { createElement } from 'react'
import { renderHook, act, cleanup, waitFor } from '@testing-library/react'
import { expect, it, vi, afterEach } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useQuoteDocuments } from './documents'
import type { Quote } from '../../../entities/orcamento'
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('../../../shared/lib/toast', () => ({ toast }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const quote = {
  id: 'q',
  quoteCode: 'Q-2033-1',
  payments: [
    {
      method: 'BOLETO',
      metadata: { pdfUrl: 'https://storage.example.test/boleto.pdf' },
    },
  ],
} as Quote
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  const client = createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
    }),
    shareDocument = vi.fn(async () => {}),
    openDocument = vi.fn(async () => {})
  const hook = renderHook(
    ({ q }) => useQuoteDocuments(q, { shareDocument, openDocument }),
    {
      initialProps: { q: quote as Quote | null },
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client, children }),
    }
  )
  return { ...hook, shareDocument, openDocument }
}
it('compartilha PDF autenticado com nome e ciclo e abre o URL recebido', async () => {
  const fetcher = vi.fn(
      async (_path: string) =>
        new Response('%PDF-fixture', {
          headers: { 'Content-Type': 'application/pdf' },
        })
    ),
    h = setup(fetcher)
  await act(async () => h.result.current.downloadAdjustment())
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/admin/quotes/q/adjustments/download'
  )
  expect(h.shareDocument).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Reajuste-Q-2033-1.pdf',
      dialogTitle: 'Baixar Reajuste',
      isCurrent: expect.any(Function),
    })
  )
  await act(async () => h.result.current.openBoleto())
  expect(h.openDocument).toHaveBeenCalledWith(
    'https://storage.example.test/boleto.pdf'
  )
  expect(toast.success).toHaveBeenCalledTimes(1)
})
it('JSON de recusa não vira arquivo e detalhe fechado não compartilha bytes atrasados', async () => {
  const h = setup(async () =>
    Response.json({ error: 'Histórico' }, { status: 409 })
  )
  await act(async () => h.result.current.downloadAdjustment())
  expect(h.shareDocument).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  let resolve!: (r: Response) => void
  const slow = setup(
    () =>
      new Promise<Response>((r) => {
        resolve = r
      })
  )
  let pending!: Promise<void>
  act(() => {
    pending = slow.result.current.downloadAdjustment()
  })
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  slow.rerender({ q: null })
  await act(async () => {
    resolve(
      new Response('%PDF-old', {
        headers: { 'Content-Type': 'application/pdf' },
      })
    )
    await pending
  })
  expect(slow.shareDocument).not.toHaveBeenCalled()
})
