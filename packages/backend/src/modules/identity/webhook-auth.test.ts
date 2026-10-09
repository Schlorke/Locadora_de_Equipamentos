import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { readAuthenticatedWebhook, secretsMatch } from './webhook-auth'

const secret = 'local-only-signing-secret'
const options = { secret, signatureHeader: 'x-signature' }
const signed = (body: string, signature?: string) =>
  new Request('http://local.test/hook', {
    method: 'POST',
    body,
    headers: {
      'x-signature':
        signature ?? createHmac('sha256', secret).update(body).digest('hex'),
    },
  })
describe('authenticated webhook bytes', () => {
  it('accepts current or one previous HMAC and rejects unrelated or changed bytes', async () => {
    for (const key of ['current-key', 'previous-key', 'unrelated-key']) {
      const body = ' {"id":"rotation"}',
        digest = createHmac('sha256', key).update(body).digest('hex')
      const result = await readAuthenticatedWebhook(signed(body, digest), {
        ...options,
        signingSecrets: ['current-key', 'previous-key'],
      })
      expect(result.ok).toBe(key !== 'unrelated-key')
      expect(
        (
          await readAuthenticatedWebhook(signed(body + ' ', digest), {
            ...options,
            signingSecrets: ['current-key', 'previous-key'],
          })
        ).ok
      ).toBe(false)
    }
  })
  it.each([{ keys: [] }, { keys: [''] }, { keys: ['one', 'two', 'three'] }])(
    'fails closed for invalid signing ring %j before reading',
    async ({ keys }) => {
      const request = signed('{}'),
        read = vi.spyOn(request, 'text')
      const result = await readAuthenticatedWebhook(request, {
        ...options,
        signingSecrets: keys,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(503)
      expect(read).not.toHaveBeenCalled()
    }
  )
  it('accepts the exact signed bytes and returns their hash', async () => {
    const result = await readAuthenticatedWebhook(
      signed(' { "id": "one" } '),
      options
    )
    expect(result).toMatchObject({ ok: true, body: { id: 'one' } })
    if (result.ok) expect(result.payloadHash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('rejects a signature for equivalent but different bytes', async () => {
    const signature = createHmac('sha256', secret)
      .update('{"id":"one"}')
      .digest('hex')
    const result = await readAuthenticatedWebhook(
      signed(' {"id":"one"}', signature),
      options
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })
  it.each(['', 'sha256=abcd', 'f'.repeat(63), 'z'.repeat(64)])(
    'rejects malformed signature %s',
    async (signature) => {
      const result = await readAuthenticatedWebhook(
        signed('{}', signature),
        options
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    }
  )
  it('requires the prefix when configured', async () => {
    const body = '{}',
      digest = createHmac('sha256', secret).update(body).digest('hex')
    expect(
      (
        await readAuthenticatedWebhook(signed(body, digest), {
          ...options,
          signaturePrefix: 'sha256=',
        })
      ).ok
    ).toBe(false)
    expect(
      (
        await readAuthenticatedWebhook(signed(body, 'sha256=' + digest), {
          ...options,
          signaturePrefix: 'sha256=',
        })
      ).ok
    ).toBe(true)
  })
  it.each(['asaas-access-token', 'access_token', 'x-hook-token'])(
    'accepts only explicitly enabled token header %s',
    async (header) => {
      const request = () =>
        new Request('http://local.test/hook', {
          method: 'POST',
          body: '{}',
          headers: { [header]: secret },
        })
      expect((await readAuthenticatedWebhook(request(), options)).ok).toBe(
        false
      )
      expect(
        (
          await readAuthenticatedWebhook(request(), {
            ...options,
            tokenHeaders: [header],
          })
        ).ok
      ).toBe(true)
    }
  )
  it('fails closed before reading an unconfigured body', async () => {
    const request = signed('{}')
    const read = vi
      .spyOn(request, 'text')
      .mockRejectedValue(Error('must not read'))
    const result = await readAuthenticatedWebhook(request, {
      ...options,
      secret: ' ',
    })
    expect(read).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(503)
  })
  it('preserves malformed JSON and body limit responses', async () => {
    const bad = await readAuthenticatedWebhook(signed('{'), options)
    const large = await readAuthenticatedWebhook(
      signed('x'.repeat(2 * 1024 * 1024 + 1)),
      options
    )
    expect(bad.ok).toBe(false)
    expect(large.ok).toBe(false)
    if (!bad.ok) expect(bad.response.status).toBe(400)
    if (!large.ok) expect(large.response.status).toBe(413)
  })
  it('handles unreadable bodies and compares secrets without accepting missing bytes', async () => {
    const request = signed('{}')
    vi.spyOn(request, 'text').mockRejectedValue(Error('unreadable'))
    const result = await readAuthenticatedWebhook(request, options)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
    expect(secretsMatch(null, secret)).toBe(false)
    expect(secretsMatch(secret, '')).toBe(false)
    expect(secretsMatch(secret + 'x', secret)).toBe(false)
    expect(secretsMatch(secret, secret)).toBe(true)
  })
})
