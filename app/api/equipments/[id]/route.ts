import { NextResponse, type NextRequest } from 'next/server'
import { getPublicEquipment } from '@/lib/catalog'
import { publicCacheHeaders, resolvePublicRequestTenant } from '@/lib/tenant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const EQUIPMENT_ID = /^[A-Za-z0-9_-]{1,128}$/

const notFound = () =>
  NextResponse.json(
    { error: 'Equipamento não encontrado' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  )

/**
 * Detalhe público de um equipamento da locadora resolvida (host de locadora
 * ou tenantSlug explícito). Equipamento de outra locadora responde 404: a
 * leitura roda em transação com `app.tenant_id` e filtra por `tenantId`.
 * Só campos públicos: sem custo de aquisição, depreciação, horímetro,
 * odômetro, histórico de perdas ou especificações internas.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await resolvePublicRequestTenant(request)
    if (!tenant.ok) return tenant.response
    const { id } = await props.params
    if (!EQUIPMENT_ID.test(id)) return notFound()
    const equipment = await getPublicEquipment(tenant.context, id)
    if (!equipment) return notFound()
    return NextResponse.json(equipment, {
      headers: publicCacheHeaders(
        tenant.edge,
        'public, max-age=60, stale-while-revalidate=300'
      ),
    })
  } catch (error) {
    console.error('Erro ao buscar equipamento público:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar equipamento' },
      { status: 500 }
    )
  }
}
