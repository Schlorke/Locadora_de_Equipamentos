// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MailHtml, externalMailUrl, mailDocument } from './mail-html.native'
import { Alert, Linking } from 'react-native'
const capture = vi.hoisted(() => ({ props: {} as Record<string, unknown> }))
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn(async () => {}) },
}))
vi.mock('react-native-webview', () => ({
  WebView: (props: Record<string, unknown>) => {
    capture.props = props
    return null
  },
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('HTML conserva tabela/corpo em superfície sem scripts, cookies ou headers da API', () => {
  const html =
    '<table><tr><td>Mensagem</td></tr></table><script>attack()</script>'
  render(createElement(MailHtml, { html, height: 320 }))
  expect(capture.props).toMatchObject({
    source: { html: mailDocument(html) },
    javaScriptEnabled: false,
    domStorageEnabled: false,
    sharedCookiesEnabled: false,
    thirdPartyCookiesEnabled: false,
    incognito: true,
    allowFileAccess: false,
    allowFileAccessFromFileURLs: false,
    allowUniversalAccessFromFileURLs: false,
    mixedContentMode: 'never',
  })
  expect(capture.props).not.toHaveProperty('injectedJavaScript')
  expect(capture.props).not.toHaveProperty('onMessage')
  expect(capture.props.source).not.toHaveProperty('headers')
  expect(mailDocument(html).indexOf('Content-Security-Policy')).toBeLessThan(
    mailDocument(html).indexOf('<script>')
  )
})
it('navegação é recusada; URL HTTP(S) só abre após decisão do usuário', async () => {
  render(
    createElement(MailHtml, {
      html: '<a href="https://outside.example/">Link</a>',
      height: 320,
    })
  )
  const navigate = capture.props.onShouldStartLoadWithRequest as (request: {
    url: string
  }) => boolean
  expect(navigate({ url: 'about:blank' })).toBe(true)
  for (const url of [
    'javascript:alert(1)',
    'file:///secret',
    'data:text/html,test',
    'https://u:p@example.test',
  ])
    expect(navigate({ url })).toBe(false)
  expect(Alert.alert).not.toHaveBeenCalled()
  expect(navigate({ url: 'https://outside.example/path' })).toBe(false)
  expect(Linking.openURL).not.toHaveBeenCalled()
  const buttons = vi.mocked(Alert.alert).mock.calls[0]![2]!
  await buttons.find((button) => button.text === 'Abrir')!.onPress!()
  expect(Linking.openURL).toHaveBeenCalledWith('https://outside.example/path')
  expect(externalMailUrl('//outside.example')).toBeNull()
})
