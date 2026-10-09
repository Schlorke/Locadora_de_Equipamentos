import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { readFinancialSettings } from '@/lib/financial-read'
import { z } from 'zod'
import { UpdateFinancialSettingsSchema } from '@gb-locacoes/contracts/financial'
import { updateFinancialSettings } from '@/lib/financial-mutations'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export async function GET(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'READ')
    if (!access.ok) return access.response
    const context = access.principal
    return NextResponse.json(await readFinancialSettings(context))
  } catch (error) {
    console.error('Error fetching financial settings:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar alíquotas financeiras' },
      { status: 500 }
    )
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const access = await requireTenantPermission(request, 'FINANCIAL', 'WRITE')
    if (!access.ok) return access.response
    return NextResponse.json(
      await updateFinancialSettings(access.principal, async () =>
        UpdateFinancialSettingsSchema.parse(await request.json())
      )
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating financial settings:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar alíquotas financeiras' },
      { status: 500 }
    )
  }
}
