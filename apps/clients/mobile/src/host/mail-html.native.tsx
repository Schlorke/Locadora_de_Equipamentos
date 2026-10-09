import { Alert, Linking } from 'react-native'
import { WebView } from 'react-native-webview'
export function mailDocument(html: string): string {
  return (
    '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src https: data:; style-src &#39;unsafe-inline&#39;; script-src &#39;none&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;; object-src &#39;none&#39;; frame-src &#39;none&#39;"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
    html +
    '</body></html>'
  )
}
export function externalMailUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
/** HTML recebido fica isolado do transporte autenticado; sem scripts ou cookies compartilhados. */
export function MailHtml({ html, height }: { html: string; height: number }) {
  return (
    <WebView
      source={{ html: mailDocument(html) }}
      style={{ height }}
      originWhitelist={['*']}
      javaScriptEnabled={false}
      javaScriptCanOpenWindowsAutomatically={false}
      domStorageEnabled={false}
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      incognito
      cacheEnabled={false}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      geolocationEnabled={false}
      mixedContentMode="never"
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank') return true
        const url = externalMailUrl(request.url)
        if (url)
          Alert.alert('Abrir link externo?', url, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Abrir',
              onPress: () => {
                void Linking.openURL(url).catch(() =>
                  Alert.alert('Não foi possível abrir o link.')
                )
              },
            },
          ])
        return false
      }}
    />
  )
}
