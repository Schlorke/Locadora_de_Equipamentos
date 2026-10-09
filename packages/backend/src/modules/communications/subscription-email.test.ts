import { expect, it } from 'vitest'
import { subscriptionEmail } from './subscription-email'
const input = {
  platform: 'Locadora',
  organization: '<img src=x onerror=alert(1)>',
  heading: 'Sua assinatura',
  message: 'Texto <script>alert(1)</script>',
  actionUrl: 'https://app.example.com/admin?a=1&b=2',
}
it('escapes organization/text/link while preserving the plain-text alternative', () => {
  const mail = subscriptionEmail(input)
  expect(mail.html).not.toContain('<img')
  expect(mail.html).not.toContain('<script>')
  expect(mail.html).toContain('&lt;script&gt;')
  expect(mail.html).toContain('?a=1&amp;b=2')
  expect(mail.text).toContain('https://app.example.com/admin?a=1&b=2')
})
it.each([
  'javascript:alert(1)',
  'http://evil.example/admin',
  'https://user:secret@example.com/admin',
])('rejects unsafe action URL %s', (actionUrl) =>
  expect(() => subscriptionEmail({ ...input, actionUrl })).toThrow()
)
