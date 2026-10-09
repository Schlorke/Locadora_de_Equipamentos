import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { requestSitePublication } from './publication'
const receipt = { published: true, publishedAt: '2026-10-04T12:00:00.000Z' }
it('envia somente o comando vazio e valida o recibo sem escolher tenant/timestamp/indexação', async () => {
  const fetcher = vi.fn(async (_path: string, _init?: RequestInit) =>
    Response.json(receipt)
  )
  expect(await requestSitePublication(createHttpClient({ fetcher }))).toEqual(
    receipt
  )
  expect(fetcher.mock.calls[0]?.[0]).toBe('/api/admin/site/publish')
  const init = fetcher.mock.calls[0]?.[1]
  expect(init?.method).toBe('POST')
  expect(init?.body).toBe('{}')
  expect(new Headers(init?.headers).get('Content-Type')).toBe(
    'application/json'
  )
})
it.each([
  [401, {}, 'session'],
  [402, {}, 'subscription'],
  [403, { code: 'OWNER_REQUIRED' }, 'owner'],
  [403, { code: 'EMAIL_NOT_VERIFIED' }, 'email'],
  [403, { code: 'TENANT_ARCHIVED' }, 'subscription'],
  [403, { code: 'ORIGIN_NOT_ALLOWED' }, 'origin'],
  [409, { code: 'FIRST_EQUIPMENT_REQUIRED' }, 'equipment'],
  [409, { code: 'TENANT_REQUIRED' }, 'selection'],
  [503, { error: 'private-driver' }, 'uncertain'],
  [200, { published: true }, 'uncertain'],
  [200, { ...receipt, indexable: true }, 'uncertain'],
  [200, { published: false, publishedAt: receipt.publishedAt }, 'uncertain'],
])(
  'classifica %s sem confirmar estado desconhecido',
  async (status, body, problem) => {
    await expect(
      requestSitePublication(
        createHttpClient({
          fetcher: async () => Response.json(body, { status: Number(status) }),
        })
      )
    ).rejects.toMatchObject({ problem })
  }
)
