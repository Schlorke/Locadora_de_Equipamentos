import * as WebBrowser from 'expo-web-browser'
export function mailPanelUrl(
  value: string | undefined,
  production: boolean
): string {
  try {
    const url = new URL(value?.trim() || '')
    if (
      !['https:', ...(production ? [] : ['http:'])].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error()
    return url.origin + '/admin/email'
  } catch {
    throw new Error('Endereço do painel não configurado. Fale com o suporte.')
  }
}
/** O OAuth Zoho continua no painel web autenticado; nenhum token do Expo entra na URL. */
export async function connectMail() {
  await WebBrowser.openBrowserAsync(
    mailPanelUrl(
      process.env.EXPO_PUBLIC_WEB_URL,
      process.env.NODE_ENV === 'production'
    )
  )
}
