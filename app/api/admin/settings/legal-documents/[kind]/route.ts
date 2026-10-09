import { isTrustedMutationOrigin } from '@/lib/security/mutation-origin'
import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantPermission } from '@/lib/tenant-permissions'
import { adminStorefrontLegal } from '../../actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

type Context = { params: Promise<{ kind: string }> }

/** Texto legal da locadora no painel (onda 134): leitura com `SETTINGS` READ. */
export async function GET(request: NextRequest, { params }: Context) {
  const { kind } = await params
  const access = await requireTenantPermission(request, 'SETTINGS', 'READ')
  if (!access.ok) return access.response
  return adminStorefrontLegal.read(access.principal, kind)
}

/** Publica o texto legal: `SETTINGS` WRITE e mesma origem; registro em audit_logs. */
export async function PUT(request: NextRequest, { params }: Context) {
  const { kind } = await params
  const access = await requireTenantPermission(request, 'SETTINGS', 'WRITE')
  if (!access.ok) return access.response
  if (!isTrustedMutationOrigin(request))
    return NextResponse.json(
      { success: false, error: 'Origem não permitida.' },
      { status: 403 }
    )
  return adminStorefrontLegal.publish(access.principal, kind, request)
}

/** Despublica o texto legal: `SETTINGS` WRITE e mesma origem; registro em audit_logs. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const { kind } = await params
  const access = await requireTenantPermission(request, 'SETTINGS', 'WRITE')
  if (!access.ok) return access.response
  if (!isTrustedMutationOrigin(request))
    return NextResponse.json(
      { success: false, error: 'Origem não permitida.' },
      { status: 403 }
    )
  return adminStorefrontLegal.unpublish(access.principal, kind)
}
