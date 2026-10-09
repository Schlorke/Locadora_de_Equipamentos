import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { authenticatePlatformAsaasWebhook } from './platform-webhook'

const token = 'synthetic-root-token',
  previous = 'synthetic-previous-token'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const env = {
  PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
  PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256: hash(token),
  PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256: hash(previous),
}
const request = (header = 'asaas-access-token', value = token, body = '{}') =>
  new Request('http://127.0.0.1/api/webhooks/asaas/platform', {
    method: 'POST',
    headers: { [header]: value },
    body,
  })
describe('root Asaas authentication', () => {
  it.each([token, previous])(
    'accepts only a configured root token: %s',
    async (value) => {
      expect(
        await authenticatePlatformAsaasWebhook(
          request('asaas-access-token', value),
          env
        )
      ).toMatchObject({
        ok: true,
        body: {},
        payloadHash: hash('{}'),
      })
    }
  )
  it.each(['access_token', 'x-hook-token', 'authorization'])(
    'rejects alternate header %s',
    async (header) => {
      const result = await authenticatePlatformAsaasWebhook(
        request(header),
        env
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    }
  )
  it('rejects tenant HMAC, incorrect token, invalid JSON and an oversized body before persistence', async () => {
    for (const [incoming, status] of [
      [
        request(
          'x-webhook-signature',
          createHmac('sha256', token).update('{}').digest('hex')
        ),
        401,
      ],
      [request('asaas-access-token', 'wrong'), 401],
      [request('asaas-access-token', token, '{'), 400],
      [
        request('asaas-access-token', token, ' '.repeat(2 * 1024 * 1024 + 1)),
        413,
      ],
    ] as const) {
      const result = await authenticatePlatformAsaasWebhook(incoming, env)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(status)
    }
  })
  it.each([
    {},
    { ...env, PLATFORM_ASAAS_ENVIRONMENT: 'unknown' },
    { ...env, PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256: 'wrong' },
    { ...env, PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256: 'wrong' },
  ])('fails closed for incomplete or invalid configuration', async (config) => {
    const result = await authenticatePlatformAsaasWebhook(request(), config)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(503)
  })
})
