import { createZohoMailMessageReader } from '@gb-locacoes/backend/http'
import {
  getZohoAccessToken,
  makeZohoMailRequest,
  getZohoMailBaseUrl,
} from '@/lib/zoho-mail'
import { getZohoAccountId } from '@/lib/zoho-mail/get-access-token'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(
  request: NextRequest,
  parameters: { params: Promise<{ messageId: string }> }
) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success) {
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  }
  const { readMessage } = createZohoMailMessageReader({
    getZohoAccessToken,
    getZohoAccountId,
    makeZohoMailRequest,
    getZohoMailBaseUrl,
  })
  return readMessage(auth.principal, auth.user.id, request, parameters)
}
