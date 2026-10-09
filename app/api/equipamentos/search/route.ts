import { NextRequest, NextResponse } from 'next/server'
import { resolvePublicRequestTenant } from '@/lib/tenant'
import { searchPublicEquipments } from '@/lib/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolvePublicRequestTenant(request)
    if (!tenant.ok) return tenant.response
    const { searchParams } = new URL(request.url)
    return NextResponse.json(
      await searchPublicEquipments(tenant.context, searchParams.get('q'))
    )
  } catch (error) {
    console.error('Erro na busca de equipamentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
