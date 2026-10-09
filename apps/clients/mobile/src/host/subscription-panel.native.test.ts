import { afterEach, expect, it, vi } from 'vitest'
const browser = vi.hoisted(() => ({
  openBrowserAsync: vi.fn(async (_href: string) => {}),
}))
vi.mock('expo-web-browser', () => browser)
import {
  openSubscriptionPanel,
  subscriptionPanelUrl,
  onboardingPanelUrl,
  openOnboardingPanel,
} from './subscription-panel.native'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
it('onboarding uses a fixed dashboard destination and only a selection hint', async () => {
  expect(onboardingPanelUrl('https://app.example.test', true, 'alfa')).toBe(
    'https://app.example.test/admin/dashboard?locadora=alfa'
  )
  vi.stubEnv('EXPO_PUBLIC_WEB_URL', 'https://app.example.test')
  vi.stubEnv('NODE_ENV', 'production')
  await openOnboardingPanel('bravo')
  expect(browser.openBrowserAsync).toHaveBeenCalledWith(
    'https://app.example.test/admin/dashboard?locadora=bravo'
  )
})
it.each([
  'javascript:alert(1)',
  'https://user:secret@app.example.test',
  'https://app.example.test?token=secret',
])('onboarding rejects unsafe configured origin %s', (value) => {
  expect(() => onboardingPanelUrl(value, true, 'alfa')).toThrow(
    /não configurado/
  )
})
it('constrói o caminho do painel com uma sugestão de locadora, sem tokens', () => {
  expect(subscriptionPanelUrl('https://app.example.test', true, 'alfa')).toBe(
    'https://app.example.test/admin/assinatura?locadora=alfa'
  )
})
it('HTTP só em development', () => {
  expect(subscriptionPanelUrl('http://localhost:3001', false, 'alfa')).toBe(
    'http://localhost:3001/admin/assinatura?locadora=alfa'
  )
  expect(() =>
    subscriptionPanelUrl('http://localhost:3001', true, 'alfa')
  ).toThrow(/não configurado/)
})
it.each([
  undefined,
  '',
  'javascript:alert(1)',
  'https://user:secret@app.example.test',
  'https://app.example.test/path',
  'https://app.example.test?token=secret',
  'https://app.example.test#x',
])('recusa configuração inválida %s, sem usar a origem da API', (value) => {
  expect(() => subscriptionPanelUrl(value, true, 'alfa')).toThrow(
    'Endereço do painel não configurado. Fale com o suporte.'
  )
})
it.each(['api', '../alfa', 'alfa&token=secret', 'alfa--beta', ''])(
  'recusa sugestão de locadora %s',
  (slug) => {
    expect(() =>
      subscriptionPanelUrl('https://app.example.test', true, slug)
    ).toThrow(/não configurado/)
  }
)
it('abre no navegador mantendo a autenticação do painel separada', async () => {
  vi.stubEnv('EXPO_PUBLIC_WEB_URL', 'https://app.example.test')
  vi.stubEnv('NODE_ENV', 'production')
  await openSubscriptionPanel('bravo')
  expect(browser.openBrowserAsync).toHaveBeenCalledWith(
    'https://app.example.test/admin/assinatura?locadora=bravo'
  )
})
