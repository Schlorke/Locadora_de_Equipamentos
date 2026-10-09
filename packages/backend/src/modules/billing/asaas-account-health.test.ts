import { afterEach, describe, expect, it, vi } from 'vitest'
import { readAsaasAccountHealth } from './asaas-account-health'
import type { AsaasFetch } from './asaas-http'
const approved = {
  commercialInfo: 'APPROVED',
  bankAccountInfo: 'APPROVED',
  documentation: 'APPROVED',
  general: 'APPROVED',
}
describe('current Asaas account health', () => {
  afterEach(() => vi.unstubAllEnvs())
  const config = (fetch: AsaasFetch, subaccount = true) => ({
    credential: 'synthetic-account-only',
    environment: 'sandbox' as const,
    subaccount,
    fetch,
  })
  it('reads annual expiry independently and returns no commercial personal data', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          name: 'private-name',
          commercialInfoExpiration: {
            isExpired: false,
            scheduledDate: '2027-10-03',
          },
        })
      )
      .mockResolvedValueOnce(Response.json(approved))
    const result = await readAsaasAccountHealth(config(fetch))
    expect(result.status?.general).toBe('APPROVED')
    expect(result.commercialInfoExpired).toBe(false)
    expect(result.commercialInfoExpiresAt).toEqual(
      new Date('2027-10-03T03:00:00Z')
    )
    expect(JSON.stringify(result)).not.toContain('private-name')
    expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/v3/myAccount/commercialInfo/',
      '/v3/myAccount/status/',
    ])
    for (const [, init] of fetch.mock.calls) {
      expect(init.headers.access_token).toBe('synthetic-account-only')
      expect(init.method).toBe('GET')
      expect(init.body).toBeUndefined()
      expect(init.redirect).toBe('error')
    }
  })
  it('expired commercial information never queries the blocked approval endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        commercialInfoExpiration: {
          isExpired: true,
          scheduledDate: '2026-10-02',
        },
      })
    )
    expect(await readAsaasAccountHealth(config(fetch))).toMatchObject({
      status: null,
      commercialInfoExpired: true,
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each([
    {},
    { commercialInfoExpiration: { isExpired: 'false' } },
    {
      commercialInfoExpiration: {
        isExpired: false,
        scheduledDate: '2026-02-31',
      },
    },
  ])('refuses an unknown annual confirmation shape: %j', async (body) => {
    const fetch = vi.fn().mockResolvedValue(Response.json(body))
    await expect(readAsaasAccountHealth(config(fetch))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('connected accounts do not acquire a synthetic subaccount expiry flag', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(approved))
    expect(await readAsaasAccountHealth(config(fetch, false))).toMatchObject({
      commercialInfoExpired: null,
      commercialInfoExpiresAt: null,
      status: { general: 'APPROVED' },
    })
    expect(fetch.mock.calls[0]![0]).toBe(
      'https://api-sandbox.asaas.com/v3/myAccount/status/'
    )
  })
  it('respects the outbound kill switch before any call', async () => {
    vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', 'true')
    const fetch = vi.fn()
    await expect(readAsaasAccountHealth(config(fetch))).rejects.toMatchObject({
      reason: 'OUTBOUND_DISABLED',
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
