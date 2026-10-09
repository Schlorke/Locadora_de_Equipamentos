import { NextResponse } from 'next/server'
import { readPublicTenantCard } from '@gb-locacoes/backend/directory'
import { prisma } from '@/lib/prisma'
import {
  publicCacheHeaders,
  publicTenantNotFound,
  resolvePublicRequestTenant,
} from '@/lib/tenant'
import { publicSiteHeaders } from '@gb-locacoes/backend/identity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Cartão público de uma locadora: slug, nome, cidade, UF e logo.
 * Nunca CNPJ, telefone, e-mail ou CEP. Locadora com slug inválido, reservado,
 * inexistente ou suspensa recebe o mesmo 404 neutro das rotas públicas.
 * Servida no apex e no host `app` (mobile); num host de locadora, um slug
 * diferente do host responde 400 `TENANT_CONFLICT`.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    // Identidade da locadora: continua com o site em pausa e leva o modo nos cabeçalhos (S13). Com
    // `?scope=client-area`, responde enquanto existe a área do cliente (B.5), inclusive com o site desligado.
    const tenant = await resolvePublicRequestTenant(request, {
      pathSlug: slug,
      surface: 'card',
    })
    if (!tenant.ok) return tenant.response
    const card = await readPublicTenantCard(prisma, {
      tenantId: tenant.context.tenantId,
      slug: tenant.slug,
    })
    if (!card) return publicTenantNotFound()
    return NextResponse.json(card, {
      headers: {
        ...publicCacheHeaders(
          tenant.edge,
          'public, max-age=60, stale-while-revalidate=300'
        ),
        ...publicSiteHeaders(tenant.site),
      },
    })
  } catch (error) {
    console.error('Erro ao montar cartão público da locadora:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar locadora' },
      { status: 500 }
    )
  }
}
