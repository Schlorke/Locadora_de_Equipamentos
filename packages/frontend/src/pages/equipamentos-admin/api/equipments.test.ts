import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api/http-client'
import { createAdminEquipmentsApi } from './equipments'

it('conserva endpoints, query e payloads de catálogo sem resolver locadora no adapter', async () => {
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async () =>
      Response.json({ error: 'Unidade locada' }, { status: 400 })
    )
  const api = createAdminEquipmentsApi(
    createHttpClient({
      baseUrl: 'https://api.example.test',
      fetcher,
      getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
    })
  )
  const body = JSON.stringify({
    name: ' Betoneira ',
    maxStock: 0,
    partsLossCount: 2,
    partsLossHistory: [
      { date: '2026-10-03', quantity: 2, images: ['part.jpg'] },
    ],
    monthlyRentalEnabled: false,
    monthlyDirectValue: 2.35,
  })
  await api.list()
  await api.categories()
  await api.get('e /1')
  await api.create(body)
  await api.update('e /1', body)
  await api.remove('e /1')
  await api.units('e /1')
  await api.createUnit(body)
  await api.updateUnit('u /1', body)
  expect(await api.removeUnit('u /1')).toEqual({
    ok: false,
    status: 400,
    data: { error: 'Unidade locada' },
  })
  expect(
    fetcher.mock.calls.map(([url, init]) => [
      new URL(url).pathname + new URL(url).search,
      init?.method,
      init?.body,
    ])
  ).toEqual([
    ['/api/admin/equipments?limit=1000', 'GET', undefined],
    ['/api/admin/categories', 'GET', undefined],
    ['/api/admin/equipments/e%20%2F1', 'GET', undefined],
    ['/api/admin/equipments', 'POST', body],
    ['/api/admin/equipments/e%20%2F1', 'PUT', body],
    ['/api/admin/equipments/e%20%2F1', 'DELETE', undefined],
    ['/api/admin/equipment-units?equipmentId=e%20%2F1', 'GET', undefined],
    ['/api/admin/equipment-units', 'POST', body],
    ['/api/admin/equipment-units/u%20%2F1', 'PATCH', body],
    ['/api/admin/equipment-units/u%20%2F1', 'DELETE', undefined],
  ])
  for (const [url, init] of fetcher.mock.calls) {
    expect(new URL(url).origin).toBe('https://api.example.test')
    expect(init).toMatchObject({
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    })
  }
})

it('conserva corpo não JSON, status e statusText da edição', async () => {
  const api = createAdminEquipmentsApi(
    createHttpClient({
      fetcher: async () =>
        new Response('<html>failure</html>', {
          status: 502,
          statusText: 'Bad Gateway',
        }),
    })
  )
  expect(await api.updateWithText('e', '{}')).toEqual({
    ok: false,
    status: 502,
    statusText: 'Bad Gateway',
    text: '<html>failure</html>',
  })
})
