import { isSameOriginMutation as isTrustedMutationOrigin } from '@gb-locacoes/backend/identity'
import { NextResponse, type NextRequest } from 'next/server'
import { requireTenantPermission } from '../../../../host/permissions'
import { SettingsSchema } from '@gb-locacoes/contracts/settings'
import { getSettings, updateSettings } from '../../../../host/branding'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  const access = await requireTenantPermission(request, 'SETTINGS', 'READ')
  if (!access.ok) return access.response
  const result = await getSettings(access.principal)
  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
    headers: { 'Cache-Control': 'no-store' },
  })
}
export async function PUT(request: NextRequest) {
  const access = await requireTenantPermission(request, 'SETTINGS', 'WRITE')
  if (!access.ok) return access.response
  if (!isTrustedMutationOrigin(request))
    return NextResponse.json(
      { success: false, error: 'Origem não permitida.' },
      { status: 403 }
    )
  const body: unknown = await request.json().catch(() => null)
  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: 'Configurações inválidas.' },
      { status: 400 }
    )
  const result = await updateSettings(access.principal, parsed.data)
  return NextResponse.json(result, {
    status: result.success ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  })
}
