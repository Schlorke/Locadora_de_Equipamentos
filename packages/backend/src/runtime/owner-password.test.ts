import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { verifyOwnerPassword } from './owner-password'
const password = 'synthetic-owner-password'
const digest = createHash('sha1').update(password).digest('hex').toUpperCase()
it('sends only five hash characters with padding and bounded request policy', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('A'.repeat(35) + ':0\r\n'))
  await verifyOwnerPassword(password, transport)
  const [url, options] = transport.mock.calls[0]!
  expect(url).toBe('https://api.pwnedpasswords.com/range/' + digest.slice(0, 5))
  expect(options?.headers).toMatchObject({ 'Add-Padding': 'true' })
  expect(options).toMatchObject({ redirect: 'error', cache: 'no-store' })
  expect(options?.signal).toBeInstanceOf(AbortSignal)
  expect(JSON.stringify([url, options])).not.toContain(password)
  expect(JSON.stringify([url, options])).not.toContain(digest)
})
it('ignores padding count zero and refuses a real compromised match', async () => {
  await expect(
    verifyOwnerPassword(
      password,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(digest.slice(5) + ':0'))
    )
  ).resolves.toBeUndefined()
  await expect(
    verifyOwnerPassword(
      password,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(digest.slice(5).toLowerCase() + ':12'))
    )
  ).rejects.toMatchObject({ code: 'PASSWORD_COMPROMISED', status: 422 })
})
it.each([
  '',
  'not-a-range-answer',
  'A'.repeat(35) + ':NaN',
  'A'.repeat(35) + ':-1',
  'A'.repeat(35) + ':9007199254740992',
  'A'.repeat(131073),
])(
  'fails closed on an invalid or excessive provider response',
  async (text) => {
    await expect(
      verifyOwnerPassword(
        password,
        vi.fn<typeof fetch>().mockResolvedValue(new Response(text))
      )
    ).rejects.toMatchObject({ code: 'PASSWORD_CHECK_UNAVAILABLE', status: 503 })
  }
)
it('fails closed on transport and HTTP failure without repeating the request', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error('private network detail'))
  await expect(verifyOwnerPassword(password, transport)).rejects.toMatchObject({
    code: 'PASSWORD_CHECK_UNAVAILABLE',
  })
  expect(transport).toHaveBeenCalledTimes(1)
  await expect(
    verifyOwnerPassword(
      password,
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 500 }))
    )
  ).rejects.toMatchObject({ code: 'PASSWORD_CHECK_UNAVAILABLE' })
})
