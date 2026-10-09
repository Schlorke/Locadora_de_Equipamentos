import { createZohoMailContentReader } from '@gb-locacoes/backend/http'
import {
  getZohoAccessToken,
  getZohoMailBaseUrl,
  ZOHO_MAIL_API_BASE,
} from '@/lib/zoho-mail'
import { getZohoAccountId } from '@/lib/zoho-mail/get-access-token'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(
  request: NextRequest,
  parameters: { params: Promise<{ messageId: string; attachmentId: string }> }
) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success) {
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  }
  const { downloadAttachment } = createZohoMailContentReader({
    getZohoAccessToken,
    getZohoAccountId,
    getZohoMailBaseUrl,
    ZOHO_MAIL_API_BASE,
  })
  return downloadAttachment(auth.principal, auth.user.id, request, parameters)
}
