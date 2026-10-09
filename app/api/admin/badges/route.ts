import { NextResponse } from 'next/server'
import { createAdminBadges } from '@gb-locacoes/backend/communications'
import { rejectExplicitCrossOrigin } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from '@/lib/tenant'
import { requireAdminOrOperator } from '@/middlewares/require-admin'
import {
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
  isZohoOAuthConfigured,
} from '@/lib/zoho-mail'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: Request) {
  const auth = await requireAdminOrOperator(request)
  if (!auth.success) {
    return NextResponse.json(auth.body ?? { error: auth.error }, {
      status: auth.status,
      headers: auth.headers,
    })
  }
  // Origem irmã explícita continua recusada também neste GET (onda 45).
  const crossOrigin = rejectExplicitCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  const { readAdminBadges } = createAdminBadges({
    withTenantTransaction,
    getZohoAccessToken,
    getZohoAccountId,
    makeZohoMailRequest,
    isZohoOAuthConfigured,
  })
  try {
    return NextResponse.json(
      await readAdminBadges(auth.principal, auth.user.id)
    )
  } catch (error) {
    console.error('[GET /api/admin/badges] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao obter contagens' },
      { status: 500 }
    )
  }
}
