import { it, expect, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createAdminRentalsApi } from './admin-rentals'

it('mantém contrato POST sem corpo e lifecycle PATCH com instante do chamador', async () => {
  const fetcher = vi
    .fn<(input: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async () => Response.json({ ok: true }))
  const api = createAdminRentalsApi(
    createHttpClient({ baseUrl: 'https://api.example.test', fetcher })
  )
  await api.list()
  await api.generateContract('r/1')
  await api.checkIn('r/1', '2026-10-03T12:00:00.000Z')
  await api.checkOut('r/1', '2026-10-04T12:00:00.000Z')
  expect(
    fetcher.mock.calls.map(([url, init]) => [url, init?.method, init?.body])
  ).toEqual([
    ['https://api.example.test/api/admin/rentals', undefined, undefined],
    [
      'https://api.example.test/api/admin/rentals/r%2F1/contract',
      'POST',
      undefined,
    ],
    [
      'https://api.example.test/api/admin/rentals/r%2F1',
      'PATCH',
      '{"checkInAt":"2026-10-03T12:00:00.000Z","status":"ACTIVE"}',
    ],
    [
      'https://api.example.test/api/admin/rentals/r%2F1',
      'PATCH',
      '{"checkOutAt":"2026-10-04T12:00:00.000Z","status":"COMPLETED"}',
    ],
  ])
})
