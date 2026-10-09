// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import type { Quote } from '../../../entities/orcamento'
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
const quote: Quote = {
  id: 'q',
  name: 'Cliente',
  email: 'fixture@example.test',
  status: 'pending',
  totalPrice: 10,
  createdAt: '2033-03-01T00:00:00Z',
  items: [],
  payments: [],
  phone: '',
  equipments: [],
  startDate: '2033-03-01',
  endDate: '2033-03-03',
  updatedAt: '2033-03-01T00:00:00Z',
}
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
  update = vi.fn(async () => quote)
) {
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const refresh = vi.fn(async () => [quote])
  const hook = renderHook(
    () =>
      useQuoteDetails({
        updateQuoteInState: update,
        fetchQuotes: refresh,
        quotesRef: { current: [quote] },
        boletoActionLocksRef: { current: new Set<string>() },
        loading: false,
        quotes: [quote],
      }),
    {
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client, children }),
    }
  )
  return { ...hook, update, refresh }
}
it('preserva aprovação AT_END e a negativa de excluir orçamento', async () => {
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async (_path, init) =>
    init?.method === 'DELETE'
      ? Response.json({ error: 'Histórico preservado' }, { status: 409 })
      : Response.json({ adjustments: [] })
  )
  const hook = setup(fetcher)
  await act(async () => hook.result.current.setSelectedQuote(quote))
  await act(async () =>
    hook.result.current.updateQuoteStatus('q', 'approved', undefined, 'AT_END')
  )
  const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(patch[0]).toBe('https://api.example.test/api/admin/quotes/q')
  expect(JSON.parse(String(patch[1]?.body))).toEqual({
    status: 'APPROVED',
    paymentTerms: 'AT_END',
  })
  hook.refresh.mockClear()
  await act(async () => hook.result.current.deleteQuote('q'))
  expect(hook.refresh).not.toHaveBeenCalled()
  expect(hook.result.current.selectedQuote?.id).toBe('q')
  expect(notify.error).toHaveBeenCalledWith('Erro', {
    description: 'Erro ao excluir orçamento. Tente novamente.',
  })
})
it('conserva ordem dos reajustes e flags de comunicação, parando na recusa parcial', async () => {
  let creates = 0
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async (_path, init) => {
    if (init?.method === 'POST')
      return ++creates === 1
        ? Response.json({ quote })
        : Response.json(
            { error: 'Cobrança exige conciliação' },
            { status: 409 }
          )
    return Response.json({ adjustments: [] })
  })
  const hook = setup(fetcher)
  await act(async () => {
    hook.result.current.setSelectedQuote(quote)
    hook.result.current.setPriceAdjustmentItems([
      { id: 'a', category: 'TRAVEL', value: 10, reason: 'Entrega extra' },
      {
        id: 'b',
        category: 'OTHER',
        categoryOther: 'Serviço',
        value: 20,
        reason: 'Trabalho extra',
      },
    ])
  })
  await act(async () => hook.result.current.adjustQuotePrice('q'))
  const posts = fetcher.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)))
  expect(posts).toEqual([
    {
      category: 'TRAVEL',
      amount: 10,
      justification: 'Entrega extra',
      sendEmail: true,
      sendWhatsapp: true,
    },
    {
      category: 'OTHER',
      amount: 20,
      justification: 'Serviço: Trabalho extra',
      sendEmail: true,
      sendWhatsapp: true,
    },
  ])
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).toHaveBeenCalledWith('Erro', {
    description: 'Cobrança exige conciliação',
  })
  expect(hook.result.current.priceAdjustmentItems).toHaveLength(2)
})
it('não cria reajuste após trocar seleção durante a atualização posterior à remoção', async () => {
  let release!: (value: Quote) => void
  const update = vi.fn(
    async () =>
      new Promise<Quote>((resolve) => {
        release = resolve
      })
  )
  const fetcher = vi.fn<
    (path: string, init?: RequestInit) => Promise<Response>
  >(async () => Response.json({ adjustments: [] }))
  const hook = setup(fetcher, update)
  await act(async () => {
    hook.result.current.setSelectedQuote(quote)
    hook.result.current.setEditingAdjustmentId('old')
    hook.result.current.setPriceAdjustmentItems([
      { id: 'a', category: 'TRAVEL', value: 10, reason: 'Entrega extra' },
    ])
  })
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.adjustQuotePrice('q')
  })
  await waitFor(() => expect(update).toHaveBeenCalledWith('q'))
  await act(async () =>
    hook.result.current.setSelectedQuote({ ...quote, id: 'novo' })
  )
  await act(async () => {
    release(quote)
    await pending
  })
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
    false
  )
  expect(hook.result.current.selectedQuote?.id).toBe('novo')
  expect(hook.result.current.isAdjustingPrice).toBe(false)
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})
