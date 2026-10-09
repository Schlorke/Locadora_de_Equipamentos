import type { TenantTransactionRunner } from '../modules/rentals/index'
import type { createZohoMailClient } from '../modules/communications/zoho-client'
import crypto from 'node:crypto'
import { rejectUntrustedZohoOrigin } from './zoho-origin'
type Client = ReturnType<typeof createZohoMailClient>
type Principal = { tenantId: string; userId: string }
const EMAIL_PAGE = '/admin/email'
export function createZohoOAuthAuthorizer({
  withTenantTransaction,
  getZohoOAuthUrl,
  isZohoOAuthConfigured,
  getEnv,
  setStateCookie,
}: {
  withTenantTransaction: TenantTransactionRunner
  getZohoOAuthUrl: Client['getZohoOAuthUrl']
  isZohoOAuthConfigured: Client['isZohoOAuthConfigured']
  getEnv: () => Readonly<Record<string, string | undefined>>
  setStateCookie: (
    _response: Response,
    _name: string,
    _value: string,
    _options: {
      httpOnly: true
      secure: boolean
      sameSite: 'lax'
      maxAge: number
      path: string
    }
  ) => Response
}) {
  async function authorizeZohoOAuth(
    principal: Principal,
    request: Request
  ): Promise<Response> {
    const denied = rejectUntrustedZohoOrigin(request, getEnv())
    if (denied) return denied
    if (!isZohoOAuthConfigured()) {
      const message = encodeURIComponent(
        'Zoho Mail não está configurado. Configure ZOHO_CLIENT_ID e ZOHO_CLIENT_SECRET no arquivo .env.'
      )
      const redirectUrl = new URL(EMAIL_PAGE, request.url)
      redirectUrl.searchParams.set('error', message)
      return new Response(null, {
        status: 307,
        headers: { Location: redirectUrl.toString() },
      })
    }

    const state = crypto.randomBytes(16).toString('hex')
    await withTenantTransaction(principal, (tx) =>
      tx.authVerification.create({
        data: {
          id: crypto.randomUUID(),
          identifier: `zoho-oauth:${principal.tenantId}:${principal.userId}`,
          value: crypto.createHash('sha256').update(state).digest('hex'),
          expiresAt: new Date(Date.now() + 600_000),
        },
      })
    )
    const url = getZohoOAuthUrl(state)

    const res = new Response(null, { status: 307, headers: { Location: url } })
    return setStateCookie(
      res,
      'zoho_oauth_state',
      JSON.stringify({
        state,
        tenantId: principal.tenantId,
        userId: principal.userId,
      }),
      {
        httpOnly: true,
        secure: getEnv().NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      }
    )
  }
  return { authorizeZohoOAuth }
}
