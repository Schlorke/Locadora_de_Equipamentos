import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { createDashboardRead } from '../modules/billing/dashboard-read'

export function createDashboardReadHandlers(
  reader: ReturnType<typeof createDashboardRead>
) {
  return {
    async readDashboard(context: TenantContext) {
      return Response.json(await reader.readDashboard(context))
    },
    async readKPIs(context: TenantContext, request: Request) {
      const { searchParams } = new URL(request.url)
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const kpis = await reader.readKPIs(
        context,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      )
      return Response.json({ kpis })
    },
  }
}
