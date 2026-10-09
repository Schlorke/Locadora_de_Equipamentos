import { createZohoOAuthAuthorizer } from '@gb-locacoes/backend/http'
import { getZohoOAuthUrl, isZohoOAuthConfigured } from '@/lib/zoho-mail'
import { setZohoStateCookie } from '@/lib/zoho-mail/oauth-cookies'
import { withTenantTransaction } from '@/lib/tenant'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success)
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  const { authorizeZohoOAuth } = createZohoOAuthAuthorizer({
    withTenantTransaction,
    getZohoOAuthUrl,
    isZohoOAuthConfigured,
    getEnv: () => process.env,
    setStateCookie: setZohoStateCookie,
  })
  return authorizeZohoOAuth(auth.principal, request)
}
