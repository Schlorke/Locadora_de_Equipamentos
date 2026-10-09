import { createZohoMailDraftWriter } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
import { getZohoAccessToken, makeZohoMailRequest } from '@/lib/zoho-mail'
import { getZohoAccountId } from '@/lib/zoho-mail/get-access-token'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, adminApiRateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success)
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  const { saveDraft } = createZohoMailDraftWriter({
    withTenantTransaction,
    getZohoAccessToken,
    getZohoAccountId,
    makeZohoMailRequest,
    checkRateLimit,
    adminApiRateLimit,
  })
  return saveDraft(auth.principal, auth.user.id, request)
}
