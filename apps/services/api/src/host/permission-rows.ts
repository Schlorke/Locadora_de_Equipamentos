import {
  listTenantPermissions,
  replaceTenantPermissions,
  withTenantTransaction,
  type TenantPrincipal,
} from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { createPermissionReplacementHandler } from '@gb-locacoes/backend/http'
import { withTenantTransaction as run } from './tenant-transaction'

export function readPermissionRows(principal: TenantPrincipal) {
  return withTenantTransaction(
    getDatabaseRuntime().prisma,
    principal,
    (transaction) => listTenantPermissions(transaction, principal)
  )
}

export const replacePermissions = createPermissionReplacementHandler(
  (context, permissions) =>
    run(context, (tx) => replaceTenantPermissions(tx, context, permissions))
)
