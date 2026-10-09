import { createFinancialMutations } from '@gb-locacoes/backend/billing'
import { withTenantTransaction } from '@/lib/tenant'
import { withRentalTransaction } from '@/lib/rental-transaction'
export const {
  updateFinancialSettings,
  updateFinancialStatus,
  inspectFinancialEntryDeletion,
} = createFinancialMutations({ withTenantTransaction, withRentalTransaction })
