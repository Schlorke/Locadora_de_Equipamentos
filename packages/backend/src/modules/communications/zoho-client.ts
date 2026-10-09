/**
 * Cliente para Zoho Mail API - OAuth e requisições
 * @see https://www.zoho.com/mail/help/api/
 */

import {
  canonicalOrigin,
  resolvePlatformEnv,
  type PlatformEnvSource,
} from '@gb-locacoes/contracts/platform'
import { createZohoMailConfiguration } from './zoho-constants'
type ZohoMailMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
interface ZohoOAuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  api_domain?: string
}
export function createZohoMailClient(
  getEnv: () => PlatformEnvSource = () => process.env
) {
  const env = getEnv()
  const {
    getZohoAuthUrl,
    getZohoTokenUrl,
    ZOHO_MAIL_API_BASE,
    ZOHO_MAIL_SCOPES,
  } = createZohoMailConfiguration(env)
  const clientId = env.ZOHO_CLIENT_ID
  const clientSecret = env.ZOHO_CLIENT_SECRET

  /**
   * Indica se o OAuth do Zoho Mail está configurado (ZOHO_CLIENT_ID definido).
   * Útil para redirecionar com mensagem amigável em vez de 500.
   */
  function isZohoOAuthConfigured(): boolean {
    return Boolean(clientId?.trim())
  }

  const CALLBACK_PATH = '/api/admin/zoho-mail/oauth/callback'

  /**
   * Redirect URI do OAuth do Zoho (o mesmo na autorização e na troca do código).
   *
   * Com a plataforma multi-host configurada (ambiente válido com segredo de
   * borda), é FIXO no host `app` (docs/architecture/adr-tenant-hosts.md, Lote
   * 6): nunca vem do Host da requisição, e um `ZOHO_REDIRECT_URI` divergente é
   * erro de configuração. O `state` continua preso à locadora e ao usuário que
   * iniciaram o fluxo. Sem plataforma (legado), vale `ZOHO_REDIRECT_URI` ou
   * `NEXTAUTH_URL`.
   */
  function getZohoRedirectUri(env: PlatformEnvSource = getEnv()): string {
    const explicit = env.ZOHO_REDIRECT_URI?.trim().replace(/\/$/, '')
    let appOrigin: string | null = null
    try {
      const platform = resolvePlatformEnv(env)
      if (platform.edgeSecret !== null)
        appOrigin = canonicalOrigin(platform, 'app')
    } catch {
      appOrigin = null
    }
    if (appOrigin !== null) {
      const fixed = `${appOrigin}${CALLBACK_PATH}`
      if (explicit && explicit !== fixed)
        throw new Error(
          'ZOHO_REDIRECT_URI diverge do callback fixo do host app da plataforma.'
        )
      return fixed
    }
    if (explicit) return explicit
    const base = env.NEXTAUTH_URL || 'http://localhost:3000'
    return `${base.replace(/\/$/, '')}${CALLBACK_PATH}`
  }

  /**
   * Gera a URL para o usuário autorizar o app no Zoho.
   * @param state - Opcional, para proteção CSRF (validar no callback)
   */
  function getZohoOAuthUrl(state?: string): string {
    if (!clientId) throw new Error('ZOHO_CLIENT_ID não configurado')
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: getZohoRedirectUri(),
      scope: ZOHO_MAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    })
    if (state) params.set('state', state)
    return `${getZohoAuthUrl()}?${params.toString()}`
  }

  /**
   * Troca o código de autorização por access_token e refresh_token.
   */
  async function exchangeCodeForTokens(code: string): Promise<ZohoOAuthTokens> {
    if (!clientId || !clientSecret)
      throw new Error('ZOHO_CLIENT_ID ou ZOHO_CLIENT_SECRET não configurados')

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getZohoRedirectUri(),
      grant_type: 'authorization_code',
    })

    const res = await fetch(getZohoTokenUrl(), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await res.json()
    if (!res.ok) {
      const err =
        data?.error ||
        data?.status?.description ||
        'Falha ao trocar código por tokens'
      throw new Error(
        typeof err === 'string' ? err : err.description || JSON.stringify(data)
      )
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in ?? 3600,
      api_domain: data.api_domain,
    }
  }

  /**
   * Renova o access_token usando o refresh_token.
   */
  async function refreshAccessToken(
    refreshToken: string
  ): Promise<{ access_token: string; expires_in: number }> {
    if (!clientId || !clientSecret)
      throw new Error('ZOHO_CLIENT_ID ou ZOHO_CLIENT_SECRET não configurados')

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    })

    const res = await fetch(getZohoTokenUrl(), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await res.json()
    if (!res.ok) {
      const err =
        data?.error || data?.status?.description || 'Falha ao renovar token'
      throw new Error(
        typeof err === 'string' ? err : err.description || JSON.stringify(data)
      )
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
    }
  }

  /**
   * Faz requisição autenticada à Zoho Mail API.
   * @param accessToken - Token de acesso válido
   * @param path - Caminho relativo à base da API (ex: /accounts/xxx/messages/view)
   * @param options - method, body (objeto JSON), searchParams (Record), signal (AbortSignal para timeout/cancelamento)
   */
  async function makeZohoMailRequest<T = unknown>(
    accessToken: string,
    path: string,
    options?: {
      method?: ZohoMailMethod
      body?: object | string
      searchParams?: Record<string, string | number | undefined>
      signal?: AbortSignal
    }
  ): Promise<T> {
    if (path.includes('..') || /%2e|%2f|%5c/i.test(path) || path.includes('\\'))
      throw new Error('INVALID_ZOHO_API_PATH')
    const method = options?.method ?? 'GET'
    const url = new URL(
      path.startsWith('http')
        ? path
        : `${ZOHO_MAIL_API_BASE}${path.startsWith('/') ? path : `/${path}`}`
    )

    if (
      url.origin !== new URL(ZOHO_MAIL_API_BASE).origin ||
      !url.pathname.startsWith('/api/')
    )
      throw new Error('INVALID_ZOHO_API_PATH')
    if (options?.searchParams) {
      Object.entries(options.searchParams).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
      })
    }

    const init: RequestInit = {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    if (options?.body && (method === 'POST' || method === 'PUT')) {
      init.body =
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
    }
    if (options?.signal) {
      init.signal = options.signal
    }

    const res = await fetch(url.toString(), init)
    const text = await res.text()
    let data: T & { status?: { code?: number; description?: string } }
    try {
      // Zoho retorna IDs como números de 19 dígitos que excedem Number.MAX_SAFE_INTEGER
      // (2^53 - 1 = 9007199254740991, ~16 dígitos). JSON.parse() perde precisão em 16+ dígitos.
      // Convertemos IDs numéricos grandes para strings antes do parse.
      const safeText = (text || '{}').replace(
        /"(messageId|threadId|folderId|accountId|attachmentId|contentId)":\s*(\d{16,})/g,
        (_match, key, value) => `"${key}":"${value}"`
      )
      data = JSON.parse(safeText) as T & {
        status?: { code?: number; description?: string }
      }
    } catch {
      if (!res.ok) throw new Error(`Zoho Mail API: ${res.status} ${text}`)
      return {} as T
    }

    if (!res.ok) {
      const msg =
        data?.status?.description ||
        data?.status?.code ||
        text ||
        'Erro na Zoho Mail API'
      throw new Error(String(msg))
    }

    return data as T
  }

  type ZohoMailUploadResponse = {
    data?: Array<Record<string, unknown>>
    attachments?: Array<Record<string, unknown>>
  }

  interface ZohoMailAttachmentUpload {
    storeName: string
    attachmentName: string
    attachmentPath: string
    fileName: string
    size?: number
  }

  function parseZohoUploadResponse(
    payload: ZohoMailUploadResponse,
    fallbacks: Array<{ fileName: string; size: number }>
  ): ZohoMailAttachmentUpload[] {
    const rawList = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.attachments)
        ? payload.attachments
        : []

    return rawList
      .map((item, index): ZohoMailAttachmentUpload | null => {
        const entry = item ?? {}
        if (typeof entry !== 'object') return null
        const record = entry as Record<string, unknown>
        const storeName =
          typeof record.storeName === 'string' ? record.storeName : ''
        const attachmentName =
          typeof record.attachmentName === 'string' ? record.attachmentName : ''
        const attachmentPath =
          typeof record.attachmentPath === 'string' ? record.attachmentPath : ''
        if (!storeName || !attachmentName || !attachmentPath) return null
        const fallback = fallbacks[index]
        const fileName =
          typeof record.fileName === 'string' && record.fileName.trim()
            ? record.fileName
            : (fallback?.fileName ?? attachmentName)
        const size =
          typeof record.size === 'number' && Number.isFinite(record.size)
            ? record.size
            : fallback?.size

        return {
          storeName,
          attachmentName,
          attachmentPath,
          fileName,
          size,
        }
      })
      .filter((item): item is ZohoMailAttachmentUpload => item != null)
  }

  async function uploadZohoMailAttachments(
    accessToken: string,
    accountId: string,
    files: Array<{ file: File; fileName: string; size: number }>,
    options?: { isInline?: boolean }
  ): Promise<ZohoMailAttachmentUpload[]> {
    const url = new URL(
      `${ZOHO_MAIL_API_BASE}/accounts/${accountId}/messages/attachments`
    )
    url.searchParams.set('uploadType', 'multipart')
    if (options?.isInline !== undefined) {
      url.searchParams.set('isInline', options.isInline ? 'true' : 'false')
    }

    const formData = new FormData()
    files.forEach(({ file, fileName }) => {
      formData.append('attach', file, fileName)
    })

    const res = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      body: formData,
    })

    let data: ZohoMailUploadResponse = {}
    try {
      data = (await res.json()) as ZohoMailUploadResponse
    } catch {
      if (!res.ok) {
        throw new Error(`Zoho Mail API: ${res.status}`)
      }
    }

    if (!res.ok) {
      const msg =
        data?.data?.[0]?.description ||
        data?.data?.[0]?.status ||
        `Erro ao enviar anexo (${res.status})`
      throw new Error(String(msg))
    }

    return parseZohoUploadResponse(
      data,
      files.map((item) => ({ fileName: item.fileName, size: item.size }))
    )
  }

  return {
    isZohoOAuthConfigured,
    getZohoRedirectUri,
    getZohoOAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    makeZohoMailRequest,
    uploadZohoMailAttachments,
  }
}
