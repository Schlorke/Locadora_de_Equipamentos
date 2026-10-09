import type { PublicRequestTenant } from '../modules/identity/index'
import {
  RentalMutationError,
  type RentalAvailability,
} from '../modules/rentals/index'

/** O transporte preserva períodos/erros; reservas são calculadas pelo módulo. */
export function createPublicEquipmentAvailabilityHandler(deps: {
  resolveTenant: (_request: Request) => Promise<PublicRequestTenant>
  calculateAvailability: RentalAvailability['calculateEquipmentCalendarAvailability']
}) {
  return async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
  ): Promise<Response> {
    try {
      const tenant = await deps.resolveTenant(request)
      if (!tenant.ok) return tenant.response
      const { id } = await props.params
      const { searchParams } = new URL(request.url)
      const monthParam = searchParams.get('month')
      const startParam = searchParams.get('startDate')
      const endParam = searchParams.get('endDate')
      let startDate: Date
      let endDate: Date
      if (monthParam) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam))
          return Response.json(
            { error: 'Formato de mês inválido. Use YYYY-MM' },
            { status: 400 }
          )
        const [year, month] = monthParam.split('-').map(Number)
        startDate = new Date(Date.UTC(year!, month! - 1, 1))
        endDate = new Date(Date.UTC(year!, month!, 0, 23, 59, 59, 999))
      } else if (startParam && endParam) {
        startDate = new Date(startParam)
        endDate = new Date(endParam)
        startDate.setUTCHours(0, 0, 0, 0)
        endDate.setUTCHours(23, 59, 59, 999)
      } else if (startParam || endParam) {
        return Response.json(
          { error: 'Informe data de início e fim' },
          { status: 400 }
        )
      } else {
        const now = new Date()
        startDate = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        )
        endDate = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            0,
            23,
            59,
            59,
            999
          )
        )
      }
      if (
        !Number.isFinite(startDate.getTime()) ||
        !Number.isFinite(endDate.getTime()) ||
        startDate > endDate ||
        endDate.getTime() - startDate.getTime() > 366 * 86400000
      ) {
        return Response.json(
          { error: 'Período inválido ou superior a 366 dias' },
          { status: 400 }
        )
      }
      const result = await deps.calculateAvailability(
        tenant.context,
        id,
        startDate,
        endDate
      )
      return Response.json({
        equipmentId: id,
        month: startDate.toISOString().slice(0, 7),
        ...result,
      })
    } catch (error) {
      if (error instanceof RentalMutationError)
        return Response.json({ error: error.message }, { status: error.status })
      console.error('Error checking availability:', error)
      return Response.json(
        { error: 'Erro ao verificar disponibilidade' },
        { status: 500 }
      )
    }
  }
}
