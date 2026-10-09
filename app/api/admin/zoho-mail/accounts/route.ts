import { createZohoMailListReader } from '@gb-locacoes/backend/http'
import { getZohoAccessToken, makeZohoMailRequest } from '@/lib/zoho-mail'
import { getZohoAccountId } from '@/lib/zoho-mail/get-access-token'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success) {
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  }
  const { listAccounts } = createZohoMailListReader({
    getZohoAccessToken,
    getZohoAccountId,
    makeZohoMailRequest,
  })
  return listAccounts(auth.principal, auth.user.id, request)
}
