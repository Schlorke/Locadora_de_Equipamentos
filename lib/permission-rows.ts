import { replaceTenantPermissions } from '@gb-locacoes/backend/identity'
import { createPermissionReplacementHandler } from '@gb-locacoes/backend/http'
import { withTenantTransaction } from './tenant'
export const replacePermissions = createPermissionReplacementHandler(
  (context, permissions) =>
    withTenantTransaction(context, (tx) =>
      replaceTenantPermissions(tx, context, permissions)
    )
)
