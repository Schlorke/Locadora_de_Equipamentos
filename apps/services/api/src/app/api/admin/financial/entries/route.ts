import { requireTenantPermission } from '../../../../../host/permissions'
import { readFinancialEntries } from '../../../../../host/financial-read'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: Request) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal
    return Response.json(
      await readFinancialEntries(context, new URL(request.url).searchParams)
    )
  } catch (error) {
    console.error('Error listing financial entries:', error)
    return Response.json(
      { error: 'Erro ao carregar lançamentos financeiros' },
      { status: 500 }
    )
  }
}
