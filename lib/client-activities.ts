import { createCustomerActivities } from '@gb-locacoes/backend/customers'
import { withTenantTransaction } from '@/lib/tenant'
export const { listClientActivities } = createCustomerActivities({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})
