import { NextResponse, type NextRequest } from 'next/server'
import { calculateEquipmentCalendarAvailability } from '@/lib/equipment-availability'
import { RentalMutationError } from '@/lib/rental-transaction'
import { resolvePublicRequestTenant } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await resolvePublicRequestTenant(request)
    if (!tenant.ok) return tenant.response
    const context = tenant.context
    const { id } = await props.params
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')
    let startDate: Date
    let endDate: Date
    if (monthParam) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam))
        return NextResponse.json(
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
      return NextResponse.json(
        { error: 'Informe data de início e fim' },
        { status: 400 }
      )
    } else {
      const now = new Date()
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
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
      return NextResponse.json(
        { error: 'Período inválido ou superior a 366 dias' },
        { status: 400 }
      )
    }
    const result = await calculateEquipmentCalendarAvailability(
      context,
      id,
      startDate,
      endDate
    )
    return NextResponse.json({
      equipmentId: id,
      month: startDate.toISOString().slice(0, 7),
      ...result,
    })
  } catch (error) {
    if (error instanceof RentalMutationError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    console.error('Error checking availability:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar disponibilidade' },
      { status: 500 }
    )
  }
}
