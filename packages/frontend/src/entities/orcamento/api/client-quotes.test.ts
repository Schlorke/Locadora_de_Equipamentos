import { expect, it, vi } from 'vitest'
import { createHttpClient, HttpError } from '../../../shared/api'
import { createClientQuoteApi } from './client-quotes'

it.each([[], { quotes: [] }])(
  'conserva envelope %j, origem e DELETE privado',
  async (data) => {
    const fetcher = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(data))
    )
    const api = createClientQuoteApi(
      createHttpClient({
        baseUrl: 'https://api.example.test',
        fetcher,
        getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
      })
    )
    expect(await api.list()).toEqual(data)
    await api.hide('id/ espaço')
    expect(fetcher.mock.calls[1]![0]).toBe(
      'https://api.example.test/api/quotes/id%2F%20espa%C3%A7o'
    )
    expect(fetcher.mock.calls[1]![1]).toMatchObject({
      method: 'DELETE',
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    })
    expect(fetcher.mock.calls[1]![1]?.body).toBeUndefined()
  }
)
it('conserva mensagem e status de recusa', async () => {
  const api = createClientQuoteApi(
    createHttpClient({
      fetcher: async () =>
        new Response(JSON.stringify({ error: 'Orçamento não encontrado' }), {
          status: 404,
        }),
    })
  )
  await expect(api.hide('foreign')).rejects.toEqual(
    new HttpError('Orçamento não encontrado', 404)
  )
})

it('lê detalhe sem mudar envelope ou valores recebidos', async () => {
  const data = {
    id: 'id',
    totalPrice: '100.50',
    finalTotal: '42.50',
    deliveryFee: '10.00',
  }
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(data))
  )
  const api = createClientQuoteApi(
    createHttpClient({ baseUrl: 'https://api.example.test', fetcher })
  )
  expect(await api.read('id/ espaço')).toEqual(data)
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://api.example.test/api/quotes/id%2F%20espa%C3%A7o'
  )
})
