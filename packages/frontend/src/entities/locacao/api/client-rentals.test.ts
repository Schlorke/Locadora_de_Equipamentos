import { expect, it, vi } from 'vitest'
import { createHttpClient, HttpError } from '../../../shared/api'
import { createClientRentalApi } from './client-rentals'

it('conserva origem, seleção, cookie, envelope e DELETE sem corpo', async () => {
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          rentals: [],
          message: 'Locação removida do histórico com sucesso',
        })
      )
  )
  const api = createClientRentalApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  expect(await api.list()).toEqual(expect.objectContaining({ rentals: [] }))
  await api.hide('id/ espaço')
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://api.example.test/api/client/rentals',
    'https://api.example.test/api/client/rentals/id%2F%20espa%C3%A7o',
  ])
  expect(fetcher.mock.calls[1]![1]).toMatchObject({
    method: 'DELETE',
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(fetcher.mock.calls[1]![1]?.body).toBeUndefined()
})
it('propaga a recusa sem transformar soft delete em sucesso', async () => {
  const api = createClientRentalApi(
    createHttpClient({
      fetcher: async () =>
        new Response(
          JSON.stringify({ error: 'Rental not found or unauthorized' }),
          { status: 404 }
        ),
    })
  )
  await expect(api.hide('foreign')).rejects.toEqual(
    new HttpError('Rental not found or unauthorized', 404)
  )
})

it('separa extensão direta de pedido e conserva download, detalhe e coleta sem corpo', async () => {
  const fetcher = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          rental: { id: 'id' },
          extensionFee: 12.5,
          success: true,
        })
      )
  )
  const api = createClientRentalApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  expect(await api.read('id/ espaço')).toHaveProperty('rental.id', 'id')
  expect(await api.extend('id/ espaço', 7)).toHaveProperty('extensionFee', 12.5)
  await api.requestExtension('id/ espaço', 365)
  await api.requestPickup('id/ espaço')
  const binary = await api.downloadContract('id/ espaço')
  expect(binary.ok).toBe(true)
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://api.example.test/api/client/rentals/id%2F%20espa%C3%A7o',
    'https://api.example.test/api/client/rentals/id%2F%20espa%C3%A7o/extend',
    'https://api.example.test/api/client/rentals/id%2F%20espa%C3%A7o/request-extension',
    'https://api.example.test/api/client/rentals/id%2F%20espa%C3%A7o/request-pickup',
    'https://api.example.test/api/contracts/id%2F%20espa%C3%A7o/download',
  ])
  expect(fetcher.mock.calls[1]![1]).toMatchObject({
    method: 'POST',
    body: '{"extensionDays":7}',
    credentials: 'include',
  })
  expect(fetcher.mock.calls[2]![1]).toMatchObject({
    method: 'POST',
    body: '{"additionalDays":365}',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'alfa' },
  })
  expect(fetcher.mock.calls[3]![1]).toMatchObject({ method: 'POST' })
  expect(fetcher.mock.calls[3]![1]?.body).toBeUndefined()
})
