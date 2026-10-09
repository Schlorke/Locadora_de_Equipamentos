import {
  createZohoOAuthCallback,
  zohoOAuthAuthorizationFailure,
} from '@gb-locacoes/backend/http'
import { exchangeCodeForTokens, makeZohoMailRequest } from '@/lib/zoho-mail'
import { withTenantTransaction } from '@/lib/tenant'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success) return zohoOAuthAuthorizationFailure(request, auth.error)
  const { completeZohoOAuth } = createZohoOAuthCallback({
    withTenantTransaction,
    exchangeCodeForTokens,
    makeZohoMailRequest,
    cookies,
    getEnv: () => process.env,
  })
  return completeZohoOAuth(auth.principal, request)
}
