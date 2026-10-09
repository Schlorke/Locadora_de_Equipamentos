import { describe, expect, it, vi } from 'vitest'
import { inspect } from 'node:util'
import { readAsaasConnectedAccount } from './asaas-connected-account'
import { AsaasSecretValue, type AsaasFetch } from './asaas-http'

const status = {
  id: 'status-not-account-id',
  general: 'APPROVED',
  commercialInfo: 'APPROVED',
  bankAccountInfo: 'APPROVED',
  documentation: 'APPROVED',
}
const secret = new AsaasSecretValue('synthetic-provider-credential')
const config = (fetch: AsaasFetch) => ({
  credential: secret,
  environment: 'sandbox' as const,
  fetch,
  policy: () => ({
    outboundDisabled: false,
    egress: { kind: 'direct' as const },
  }),
})
describe('connected account identity proof', () => {
  it.each(['11.222.333/0001-81', '12.abc.345/01de-35'])(
    'reads identity and current status with only GET: %s',
    async (cpfCnpj) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ cpfCnpj, privateBank: 'omit', incomeValue: 99 })
        )
        .mockResolvedValueOnce(Response.json(status))
      const result = await readAsaasConnectedAccount(config(fetch))
      expect(result.document).toBe(cpfCnpj.replace(/[./-]/g, '').toUpperCase())
      expect(Object.keys(result)).toEqual(['document', 'status'])
      expect(
        fetch.mock.calls.map(([url, init]) => [
          url,
          init.method,
          init.body,
          init.redirect,
        ])
      ).toEqual([
        [
          'https://api-sandbox.asaas.com/v3/myAccount/commercialInfo/',
          'GET',
          undefined,
          'error',
        ],
        [
          'https://api-sandbox.asaas.com/v3/myAccount/status/',
          'GET',
          undefined,
          'error',
        ],
      ])
      expect(
        new Headers(fetch.mock.calls[0]![1].headers).get('access_token')
      ).toBe('synthetic-provider-credential')
      expect(JSON.stringify(secret) + inspect(secret)).not.toContain(
        'synthetic-provider-credential'
      )
    }
  )
  it.each([
    null,
    {},
    [],
    { cpfCnpj: '52998224725' },
    { cpfCnpj: '11222333000180' },
    { cpfCnpj: 11222333000181 },
  ])(
    'refuses malformed company identity before reading status: %j',
    async (body) => {
      const fetch = vi.fn().mockResolvedValue(Response.json(body))
      await expect(readAsaasConnectedAccount(config(fetch))).rejects.toThrow(
        'INVALID_RESPONSE'
      )
      expect(fetch).toHaveBeenCalledTimes(1)
    }
  )
  it('sanitizes a rejected key and obeys the outbound kill switch', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { errors: [{ description: 'synthetic-provider-credential' }] },
          { status: 401 }
        )
      )
    await expect(readAsaasConnectedAccount(config(fetch))).rejects.toThrow(
      'REJECTED'
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    fetch.mockClear()
    await expect(
      readAsaasConnectedAccount({
        ...config(fetch),
        policy: () => ({
          outboundDisabled: true,
          egress: { kind: 'direct' as const },
        }),
      })
    ).rejects.toThrow('UNAVAILABLE')
    expect(fetch).not.toHaveBeenCalled()
  })
})
