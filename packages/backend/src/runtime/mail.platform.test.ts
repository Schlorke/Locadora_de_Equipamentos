import { afterEach, expect, it, vi } from 'vitest'
import { createPlatformMailer } from './mail'
afterEach(() => vi.unstubAllGlobals())
const mail = {
  from: 'Platform <platform@example.invalid>',
  to: 'owner@example.invalid',
  subject: 'Assinatura',
  text: 'Texto',
  html: '<p>Texto</p>',
}
it('uses the existing SDK with one private recipient, bounded signal and stable idempotency header', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'mail-fixture' }))
  vi.stubGlobal('fetch', fetch)
  const send = createPlatformMailer('synthetic-test-key')
  await send(mail, 'platform-notice:fixture')
  const [url, input] = fetch.mock.calls[0]!
  expect(String(url)).toBe('https://api.resend.com/emails')
  expect(new Headers(input.headers).get('Idempotency-Key')).toBe(
    'platform-notice:fixture'
  )
  expect(input.signal).toBeInstanceOf(AbortSignal)
  expect(JSON.parse(input.body)).toEqual(mail)
})
it.each([
  Response.json(
    { message: 'sensitive fixture value', name: 'validation_error' },
    { status: 422 }
  ),
  Response.json({}),
])(
  'requires a successful provider acknowledgement and redacts errors',
  async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(
      createPlatformMailer('synthetic-test-key')(
        mail,
        'platform-notice:fixture'
      )
    ).rejects.toThrow('PLATFORM_MAIL_DELIVERY_FAILED')
  }
)
