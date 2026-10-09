import type { TenantTransactionRunner } from '../modules/rentals/index'
import type { createZohoMailClient } from '../modules/communications/zoho-client'
import { createHash } from 'node:crypto'
import { rejectUntrustedZohoOrigin } from './zoho-origin'
import {
  receivedCode,
  redirectError,
  redirectToPanel,
} from './zoho-oauth-response'
type Client = ReturnType<typeof createZohoMailClient>
export function createZohoOAuthCallback({
  withTenantTransaction,
  exchangeCodeForTokens,
  makeZohoMailRequest,
  cookies,
  getEnv,
}: {
  withTenantTransaction: TenantTransactionRunner
  exchangeCodeForTokens: Client['exchangeCodeForTokens']
  makeZohoMailRequest: Client['makeZohoMailRequest']
  cookies: () => Promise<{
    get: (_name: string) => { value: string } | undefined
    delete: (_name: string) => unknown
  }>
  getEnv: () => Readonly<Record<string, string | undefined>>
}) {
  async function completeZohoOAuth(
    principal: { tenantId: string; userId: string },
    request: Request
  ): Promise<Response> {
    if (rejectUntrustedZohoOrigin(request, getEnv()))
      return redirectError('Origem não permitida')
    const { searchParams } = new URL(request.url)
    const received = receivedCode(searchParams)
    if ('failure' in received) return received.failure
    const { code } = received
    const state = searchParams.get('state')

    const cookieStore = await cookies()
    const savedState = cookieStore.get('zoho_oauth_state')?.value
    cookieStore.delete('zoho_oauth_state')

    let parsed: unknown
    try {
      parsed = JSON.parse(savedState || '{}')
    } catch {
      return redirectError('Estado OAuth inválido')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return redirectError('Estado OAuth inválido')
    const saved = parsed as {
      state?: unknown
      tenantId?: unknown
      userId?: unknown
    }
    if (
      !state ||
      saved.state !== state ||
      saved.tenantId !== principal.tenantId ||
      saved.userId !== principal.userId
    )
      return redirectError('Estado OAuth inválido para esta locadora')
    const consumed = await withTenantTransaction(principal, (tx) =>
      tx.authVerification.deleteMany({
        where: {
          identifier: `zoho-oauth:${principal.tenantId}:${principal.userId}`,
          value: createHash('sha256').update(state).digest('hex'),
          expiresAt: { gt: new Date() },
        },
      })
    )
    if (consumed.count !== 1)
      return redirectError('Estado OAuth expirado ou já utilizado')
    const userId = principal.userId

    let tokens
    try {
      tokens = await exchangeCodeForTokens(code)
    } catch {
      return redirectError('Falha ao conectar conta de e-mail')
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000)

    let accountId: string | null = null
    try {
      const raw = await makeZohoMailRequest<{
        data?: Array<{ accountId?: string; id?: string }>
        accounts?: Array<{ accountId?: string; id?: string }>
      }>(tokens.access_token, '/accounts')
      // raw.data já é o array de contas: { status, data: [...] }
      const list = Array.isArray(raw.data) ? raw.data : (raw.accounts ?? [])
      const first = list?.[0]
      accountId = first?.accountId ?? (first as { id?: string })?.id ?? null
    } catch {
      // accountId permanece null; a rota /accounts pode preencher depois
    }

    const dc = getEnv().ZOHO_MAIL_DATACENTER || 'com'

    await withTenantTransaction(principal, (tx) =>
      tx.zohoMailToken.upsert({
        where: { tenantId_userId: { tenantId: principal.tenantId, userId } },
        create: {
          tenantId: principal.tenantId,
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          accountId,
          datacenter: dc,
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          accountId,
          datacenter: dc,
        },
      })
    )

    return redirectToPanel('success=true')
  }
  return { completeZohoOAuth }
}
