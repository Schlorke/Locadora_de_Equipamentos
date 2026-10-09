import { afterEach, expect, it, vi } from 'vitest'
import { mailPanelUrl, connectMail } from './mail-connect.native'
import { openBrowserAsync } from 'expo-web-browser'
vi.mock('expo-web-browser', () => ({
  openBrowserAsync: vi.fn(async () => ({ type: 'cancel' })),
}))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
it('abre somente painel web configurado, sem tokens ou redirecionamento da API', async () => {
  vi.stubEnv('EXPO_PUBLIC_WEB_URL', 'https://app.example.test/')
  vi.stubEnv('NODE_ENV', 'production')
  await connectMail()
  expect(openBrowserAsync).toHaveBeenCalledWith(
    'https://app.example.test/admin/email'
  )
  expect(mailPanelUrl('http://localhost:3001', false)).toBe(
    'http://localhost:3001/admin/email'
  )
})
it.each([
  undefined,
  '',
  'ftp://example.test',
  'http://app.example.test',
  'https://u:p@app.example.test',
  'https://app.example.test/admin',
  'https://app.example.test?token=x',
  'https://app.example.test#x',
])('recusa origem inadequada em produção: %s', (value) => {
  expect(() => mailPanelUrl(value, true)).toThrow(
    'Endereço do painel não configurado'
  )
})
