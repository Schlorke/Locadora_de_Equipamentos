import { createZohoMailReplier } from '@gb-locacoes/backend/http'
import { getZohoAccessToken, makeZohoMailRequest } from '@/lib/zoho-mail'
import { getZohoAccountId } from '@/lib/zoho-mail/get-access-token'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, strictRateLimit } from '@/lib/rate-limit'
import { withTenantTransaction } from '@/lib/tenant'
import { logger } from '@/lib/logger'
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(
  request: NextRequest,
  parameters: { params: Promise<{ messageId: string }> }
) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success)
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  const { replyMessage } = createZohoMailReplier({
    getZohoAccessToken,
    getZohoAccountId,
    makeZohoMailRequest,
    checkRateLimit,
    strictRateLimit,
    checkIdempotency,
    storeIdempotency,
    withTenantTransaction,
    logger,
  })
  return replyMessage(auth.principal, auth.user.id, request, parameters)
}
