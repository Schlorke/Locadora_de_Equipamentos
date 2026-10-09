import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { readFinancialEntries } from '@/lib/financial-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal
    return NextResponse.json(
      await readFinancialEntries(context, new URL(request.url).searchParams)
    )
  } catch (error) {
    console.error('Error listing financial entries:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar lançamentos financeiros' },
      { status: 500 }
    )
  }
}
