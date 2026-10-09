import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { readReceivingAccount } from './owner-account'
it('only requests a private scoped read and represents absence explicitly', async () => {
  const fetcher = vi.fn(async () => Response.json({ account: null }))
  expect(await readReceivingAccount(createHttpClient({ fetcher }))).toEqual({
    account: null,
  })
  expect(fetcher).toHaveBeenCalledWith(
    '/api/admin/payment-account',
    expect.objectContaining({ cache: 'no-store', credentials: 'include' })
  )
})
it.each([
  [401, {}, 'session'],
  [403, { code: 'OWNER_REQUIRED' }, 'owner'],
  [403, { code: 'TENANT_ARCHIVED' }, 'archived'],
  [409, { code: 'TENANT_REQUIRED' }, 'selection'],
  [503, { error: 'private-provider-key' }, 'unavailable'],
] as const)('neutral failure for HTTP %s', async (status, data, problem) => {
  const client = createHttpClient({
    fetcher: async () => Response.json(data, { status }),
  })
  await expect(readReceivingAccount(client)).rejects.toMatchObject({
    problem,
    message: 'Não foi possível consultar os recebimentos.',
  })
})
it.each([
  { account: null, apiKey: 'private-key' },
  {},
  { account: { status: 'invented' } },
])('does not render unexpected or incomplete responses %j', async (data) => {
  await expect(
    readReceivingAccount(
      createHttpClient({ fetcher: async () => Response.json(data) })
    )
  ).rejects.toMatchObject({ problem: 'unavailable' })
})
