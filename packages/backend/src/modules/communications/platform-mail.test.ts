import { expect, it } from 'vitest'
import { platformEmail, platformMailEnvelopeSchema } from './platform-mail'

it('escapes the supplied action label and keeps the subscription default unchanged', () => {
  const input = {
    platform: 'Locadora',
    organization: 'Locadora <img src=x>',
    heading: 'Cadastro',
    message: 'Acesse o painel',
    actionUrl: 'https://app.example.com/admin?a=1&b=2',
  }
  const mail = platformEmail({
    ...input,
    actionLabel: '<script>Painel</script>',
  })
  expect(mail.html).toContain('&lt;script&gt;Painel&lt;/script&gt;')
  expect(mail.html).toContain('Locadora &lt;img src=x&gt;')
  expect(mail.html).toContain('?a=1&amp;b=2')
  expect(mail.text).toBe(
    [
      input.organization,
      input.heading,
      input.message,
      input.actionUrl,
      input.platform,
    ].join('\n\n')
  )
  expect(platformEmail(input).html).toContain('>Acessar painel ou fatura</a>')
})

it('validates one recipient and rejects additional delivery fields', () => {
  const mail = {
    from: 'Platform <platform@example.test>',
    to: 'owner@example.test',
    subject: 'Cadastro',
    html: '<p>Cadastro</p>',
    text: 'Cadastro',
  }
  expect(platformMailEnvelopeSchema.parse(mail)).toEqual(mail)
  expect(
    platformMailEnvelopeSchema.safeParse({ ...mail, bcc: 'other@example.test' })
      .success
  ).toBe(false)
  expect(
    platformMailEnvelopeSchema.safeParse({
      ...mail,
      to: ['a@example.test', 'b@example.test'],
    }).success
  ).toBe(false)
  expect(
    platformMailEnvelopeSchema.safeParse({ ...mail, to: 'invalid' }).success
  ).toBe(false)
})
