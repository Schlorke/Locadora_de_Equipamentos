import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  UpdatePermissionsSchema,
  type PermissionReplacementInput,
} from '@gb-locacoes/contracts/permissions'
import type { replaceTenantPermissions } from '../modules/identity/tenant-permissions-write'

export function createPermissionReplacementHandler(
  writeRows: (
    _context: TenantContext,
    _permissions: PermissionReplacementInput
  ) => ReturnType<typeof replaceTenantPermissions>
) {
  return async function replacePermissions(
    context: TenantContext,
    request: Request
  ) {
    const { permissions } = UpdatePermissionsSchema.parse(await request.json())
    const updated = await writeRows(context, permissions)
    return Response.json({ success: true, permissions: updated })
  }
}
