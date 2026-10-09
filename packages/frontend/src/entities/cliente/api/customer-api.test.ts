import { expect, it, vi } from 'vitest'
import {
  createHttpClient,
  HttpError,
  type HttpClient,
} from '../../../shared/api'
import { createCustomerApi } from './customer-api'

it('conserva origem configurada, seleção, métodos, envelopes e corpo privado', async () => {
  const fetcher = vi.fn(
    async (_path: string, _options?: RequestInit) =>
      new Response(
        JSON.stringify({
          user: { company: 'Alfa' },
          addresses: [],
          address: { id: 'address' },
          message: 'Endereço removido com sucesso',
        })
      )
  )
  const api = createCustomerApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  expect((await api.profile()).user.company).toBe('Alfa')
  await api.updateProfile({ phone: '(51) 99999-9999', company: 'Empresa' })
  expect((await api.addresses()).addresses).toEqual([])
  const input = {
    street: 'Rua',
    number: '1',
    complement: null,
    neighborhood: 'Centro',
    city: 'Porto Alegre',
    state: 'RS',
    zipCode: '90000000',
    isPrimary: true,
  }
  expect((await api.createAddress(input)).address.id).toBe('address')
  await api.updateAddress('id/ com espaço', { isPrimary: true })
  expect(await api.deleteAddress('id/ com espaço')).toEqual(
    expect.objectContaining({ message: 'Endereço removido com sucesso' })
  )
  expect(
    fetcher.mock.calls.map(([path, options]) => [
      path,
      options?.method ?? 'GET',
    ])
  ).toEqual([
    ['https://api.example.test/api/user/profile', 'GET'],
    ['https://api.example.test/api/user/profile', 'PUT'],
    ['https://api.example.test/api/addresses', 'GET'],
    ['https://api.example.test/api/addresses', 'POST'],
    [
      'https://api.example.test/api/addresses/id%2F%20com%20espa%C3%A7o',
      'PATCH',
    ],
    [
      'https://api.example.test/api/addresses/id%2F%20com%20espa%C3%A7o',
      'DELETE',
    ],
  ])
  for (const [, options] of fetcher.mock.calls) {
    expect(options?.credentials).toBe('include')
    expect(options?.headers).toMatchObject({ 'x-tenant-id': 'alfa' })
  }
  expect(JSON.parse(fetcher.mock.calls[1]![1]!.body as string)).toEqual({
    phone: '(51) 99999-9999',
    company: 'Empresa',
  })
  expect(JSON.parse(fetcher.mock.calls[3]![1]!.body as string)).toEqual(input)
  expect(JSON.parse(fetcher.mock.calls[4]![1]!.body as string)).toEqual({
    isPrimary: true,
  })
  expect(fetcher.mock.calls[5]![1]?.body).toBeUndefined()
})

it('não esconde recusa do servidor nem falha de rede', async () => {
  const api = createCustomerApi(
    createHttpClient({
      fetcher: async () =>
        new Response(JSON.stringify({ error: 'Endereço não encontrado' }), {
          status: 404,
        }),
    })
  )
  await expect(api.deleteAddress('outro')).rejects.toEqual(
    new HttpError('Endereço não encontrado', 404)
  )
  const offline = createCustomerApi({
    request: async () => {
      throw new Error('offline')
    },
  } as HttpClient)
  await expect(offline.updateProfile({ company: 'Alfa' })).rejects.toThrow(
    'offline'
  )
})

it('atividades conserva limite de dez, origem configurada e seleção privada', async () => {
  const fetcher = vi.fn(
    async (_path: string, _options?: RequestInit) =>
      new Response(JSON.stringify({ activities: [] }))
  )
  const api = createCustomerApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  expect(await api.activities()).toEqual({ activities: [] })
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://api.example.test/api/client/activities?limit=10'
  )
  expect(fetcher.mock.calls[0]![1]).toMatchObject({
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
})
