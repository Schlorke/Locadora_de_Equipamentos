import * as WebBrowser from 'expo-web-browser'
import {
  isTenantSlug,
  isReservedSubdomain,
} from '@gb-locacoes/contracts/platform'

export function subscriptionPanelUrl(
  value: string | undefined,
  production: boolean,
  slug: string
): string {
  return ownerPanelUrl(value, production, slug, '/admin/assinatura')
}
function ownerPanelUrl(
  value: string | undefined,
  production: boolean,
  slug: string,
  path: '/admin/assinatura' | '/admin/dashboard'
): string {
  try {
    if (!isTenantSlug(slug) || isReservedSubdomain(slug)) throw new Error()
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
    return url.origin + path + '?locadora=' + encodeURIComponent(slug)
  } catch {
    throw new Error('Endereço do painel não configurado. Fale com o suporte.')
  }
}
export function onboardingPanelUrl(
  value: string | undefined,
  production: boolean,
  slug: string
) {
  return ownerPanelUrl(value, production, slug, '/admin/dashboard')
}
export async function openOnboardingPanel(slug: string): Promise<void> {
  await WebBrowser.openBrowserAsync(
    onboardingPanelUrl(
      process.env.EXPO_PUBLIC_WEB_URL,
      process.env.NODE_ENV === 'production',
      slug
    )
  )
}
/** Nenhum cookie/token do Expo vai para a URL; o painel autentica e confirma a seleção. */
export async function openSubscriptionPanel(slug: string): Promise<void> {
  await WebBrowser.openBrowserAsync(
    subscriptionPanelUrl(
      process.env.EXPO_PUBLIC_WEB_URL,
      process.env.NODE_ENV === 'production',
      slug
    )
  )
}
