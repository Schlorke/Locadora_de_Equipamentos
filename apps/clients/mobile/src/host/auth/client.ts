import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'
import * as Linking from 'expo-linking'
import Constants from 'expo-constants'
import {
  PLATFORM,
  betterAuthBasePath,
  parseAuthMode,
  type BetterAuthMode,
} from '@gb-locacoes/contracts/platform'
import { createLegacyAuthClient } from './legacy-client'
import { apiBaseUrl } from '../api-config'

export { apiBaseUrl } from '../api-config'

// Modos e validação pela regra única da plataforma (a mesma do host web e do backend).
export const authMode = parseAuthMode(
  process.env.EXPO_PUBLIC_AUTH_MODE,
  'EXPO_PUBLIC_AUTH_MODE'
)
const scheme = Constants.expoConfig?.scheme
const legacy = createLegacyAuthClient(apiBaseUrl)
// O servidor nomeia o cookie de sessão `<PLATFORM.name>.session_token` (`__Host-` em https): com outro
// `cookiePrefix` o plugin descarta o Set-Cookie e o app não guarda a sessão.
// O basePath do Better Auth sai da regra única modo → basePath (a do host web e do backend).
const createNativeClient = (mode: BetterAuthMode) =>
  createAuthClient({
    baseURL: apiBaseUrl + betterAuthBasePath(mode),
    plugins: [
      expoClient({
        scheme: Array.isArray(scheme) ? scheme[0] : scheme,
        storagePrefix: 'gb-locacoes',
        cookiePrefix: PLATFORM.name,
        storage: SecureStore,
      }),
    ],
  })

let client: ReturnType<typeof createNativeClient> | undefined
/** Cliente Better Auth do modo (só os modos com Better Auth chegam aqui; o legado usa o cliente próprio). */
function getClient(mode: BetterAuthMode) {
  if (!apiBaseUrl)
    throw new Error('Configure EXPO_PUBLIC_API_URL para conectar o aplicativo.')
  return (client ??= createNativeClient(mode))
}

export const hostAuth = {
  supportsSocial: authMode !== 'legacy',
  async getSession() {
    if (authMode === 'legacy') return legacy.getSession()
    const result = await getClient(authMode).getSession()
    if (result.error)
      throw new Error(
        result.error.message || 'Não foi possível acessar a sessão.'
      )
    if (!result.data?.user) return null
    const user = result.data.user as typeof result.data.user & { role?: string }
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  },
  async signInCredentials(email: string, password: string) {
    if (authMode === 'legacy') return legacy.signInCredentials(email, password)
    const result = await getClient(authMode).signIn.email({ email, password })
    return { ok: !result.error, error: result.error?.message }
  },
  async signInProvider(
    provider: 'google' | 'facebook',
    callbackUrl = '/auth/callback'
  ) {
    if (authMode === 'legacy')
      throw new Error(
        'O login social no aplicativo requer Better Auth habilitado.'
      )
    const result = await getClient(authMode).signIn.social({
      provider,
      callbackURL: Linking.createURL(callbackUrl),
    })
    if (result.error)
      throw new Error(
        result.error.message || 'Não foi possível iniciar o login social.'
      )
  },
  async signOut() {
    if (authMode === 'legacy') return legacy.signOut()
    const result = await getClient(authMode).signOut()
    if (result.error)
      throw new Error(
        result.error.message || 'Não foi possível encerrar a sessão.'
      )
  },
  async getApiHeaders(): Promise<Record<string, string>> {
    if (authMode === 'legacy') return {}
    const cookie = await getClient(authMode).getCookie()
    return cookie ? { Cookie: cookie } : {}
  },
}
