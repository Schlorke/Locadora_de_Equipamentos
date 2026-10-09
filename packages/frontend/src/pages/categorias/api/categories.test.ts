import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api/http-client'
import { createAdminCategoriesApi } from './categories'

it('usa o host configurado e preserva lista, métodos, corpo e recusa 409', async () => {
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async () =>
      Response.json({ error: 'Categoria já existente' }, { status: 409 })
    )
  const api = createAdminCategoriesApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  const body = JSON.stringify({
    name: ' Ferramentas ',
    icon: null,
    placement: 'types',
  })
  expect(await api.list()).toMatchObject({ ok: false, status: 409 })
  expect(await api.save(null, body)).toEqual({
    ok: false,
    status: 409,
    data: { error: 'Categoria já existente' },
  })
  await api.save('c /1', body)
  await api.remove('c /1')
  expect(
    fetcher.mock.calls.map(([url, init]) => [url, init?.method, init?.body])
  ).toEqual([
    ['https://api.example.test/api/admin/categories', 'GET', undefined],
    ['https://api.example.test/api/admin/categories', 'POST', body],
    ['https://api.example.test/api/admin/categories/c%20%2F1', 'PUT', body],
    [
      'https://api.example.test/api/admin/categories/c%20%2F1',
      'DELETE',
      undefined,
    ],
  ])
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa', Accept: 'application/json' },
    })
})
