import { createOwnerSubscriptionReadHandlers } from '@gb-locacoes/backend/http'
import type { TenantPrincipal } from '@gb-locacoes/backend/identity'
import { withTenantTransaction } from './tenant'
export function readOwnerSubscription(principal: TenantPrincipal) {
  return createOwnerSubscriptionReadHandlers({
    withTenantTransaction,
  }).readOwnerSubscription(principal)
}
export function readOwnerInvoices(principal: TenantPrincipal) {
  return createOwnerSubscriptionReadHandlers({
    withTenantTransaction,
  }).readOwnerInvoices(principal)
}
