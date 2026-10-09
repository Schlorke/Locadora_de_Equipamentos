import { resolvePublicRequestTenant } from '@/lib/tenant'
import { getPublicSettings } from '@/lib/catalog'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    // Contato da locadora: a página de pausa e a área do cliente continuam usando (S13).
    const tenant = await resolvePublicRequestTenant(request, {
      trim: true,
      requiredCode: true,
      surface: 'identity',
    })
    if (!tenant.ok) return tenant.response
    const settings = await getPublicSettings(tenant.context)
    if (!settings)
      return NextResponse.json(
        {
          error: 'Configurações públicas indisponíveis nesta locadora',
          code: 'SETTINGS_NOT_CONFIGURED',
        },
        { status: 409 }
      )
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Erro ao buscar configurações públicas:', error)
    return NextResponse.json(
      { error: 'Não foi possível carregar as configurações públicas' },
      { status: 500 }
    )
  }
}
