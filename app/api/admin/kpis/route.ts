import { requireTenantPermission } from '@/lib/tenant-permissions'
import { readKPIs } from '@/lib/dashboard-read'
// GET - Obter todas as métricas KPI
export async function GET(request: Request) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    return await readKPIs(access.principal, request)
  } catch (error) {
    console.error('Error calculating KPIs:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
