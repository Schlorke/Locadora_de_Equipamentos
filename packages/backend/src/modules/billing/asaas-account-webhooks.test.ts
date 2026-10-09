import { describe, expect, it, vi } from 'vitest'
import { inspect } from 'node:util'
import { AsaasSecretValue, type AsaasFetch } from './asaas-http'
import {
  ACCOUNT_WEBHOOK_EVENTS,
  createAsaasAccountWebhooks,
} from './asaas-account-webhooks'

const url = 'https://api.example.test/api/webhooks/asaas/integration-alfa'
const token = new AsaasSecretValue('synthetic-webhook-token'.repeat(3))
const input = {
  name: 'Locadora-integration-alfa',
  url,
  email: 'ops@example.test',
  token,
}
const row = {
  id: 'hook-alfa',
  name: input.name,
  url,
  enabled: true,
  interrupted: false,
  apiVersion: 3,
  sendType: 'SEQUENTIALLY',
  events: [...ACCOUNT_WEBHOOK_EVENTS],
}
const adapter = (fetch: AsaasFetch) =>
  createAsaasAccountWebhooks({
    environment: 'sandbox',
    credential: new AsaasSecretValue('synthetic-account-key'),
    fetch,
    policy: () => ({ outboundDisabled: false, egress: { kind: 'direct' } }),
  })
describe('Asaas account webhook transport', () => {
  it('reads a complete bounded list and drops token and unrelated provider fields', async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        hasMore: false,
        totalCount: 1,
        data: [
          {
            ...row,
            authToken: 'provider-sensitive-token',
            privateField: 'omit',
          },
        ],
      })
    )
    const rows = await adapter(fetch).list()
    expect(rows).toEqual([row])
    expect(JSON.stringify(rows)).not.toContain('provider-sensitive-token')
    expect(fetch.mock.calls[0]![0]).toBe(
      'https://api-sandbox.asaas.com/v3/webhooks?offset=0&limit=100'
    )
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      redirect: 'error',
    })
    expect(fetch.mock.calls[0]![1].body).toBeUndefined()
  })
  it.each([
    { hasMore: true, data: [] },
    { hasMore: false },
    { hasMore: false, totalCount: 2, data: [row] },
    { hasMore: false, data: [row, row] },
    { hasMore: false, data: [{ ...row, enabled: null }] },
    { hasMore: false, data: [{ ...row, id: '../foreign' }] },
  ])('refuses an incomplete/ambiguous response: %j', async (body) => {
    await expect(
      adapter(vi.fn().mockResolvedValue(Response.json(body))).list()
    ).rejects.toThrow('INVALID_RESPONSE')
  })
  it('creates and updates only version-three sequential account events; secrets stay in transport', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ ...row, authToken: 'omit' })
      )
    const api = adapter(fetch)
    expect(await api.create(input)).toEqual(row)
    expect(await api.configure(row.id, input)).toEqual(row)
    const create = JSON.parse(fetch.mock.calls[0]![1].body)
    const update = JSON.parse(fetch.mock.calls[1]![1].body)
    expect(create).toEqual({
      name: input.name,
      url,
      email: input.email,
      apiVersion: 3,
      enabled: true,
      interrupted: false,
      sendType: 'SEQUENTIALLY',
      events: [...ACCOUNT_WEBHOOK_EVENTS],
      authToken: token.use((value) => value),
    })
    expect(update).not.toHaveProperty('apiVersion')
    expect(update).not.toHaveProperty('email')
    expect(
      fetch.mock.calls.map(([target, options]) => [target, options.method])
    ).toEqual([
      ['https://api-sandbox.asaas.com/v3/webhooks', 'POST'],
      ['https://api-sandbox.asaas.com/v3/webhooks/hook-alfa', 'PUT'],
    ])
    expect(JSON.stringify(input) + inspect(input)).not.toContain(
      token.use((value) => value)
    )
  })
  it('refuses malformed destinations/token/id before writes and mismatched update receipts', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ ...row, id: 'hook-other' }))
    const api = adapter(fetch)
    await expect(
      api.create({ ...input, url: 'http://api.example.test/unsafe' })
    ).rejects.toThrow('REJECTED')
    await expect(
      api.create({ ...input, token: new AsaasSecretValue('too-short') })
    ).rejects.toThrow('REJECTED')
    await expect(api.configure('../other', input)).rejects.toThrow('REJECTED')
    expect(fetch).not.toHaveBeenCalled()
    await expect(api.configure(row.id, input)).rejects.toThrow(
      'INVALID_RESPONSE'
    )
  })
})
