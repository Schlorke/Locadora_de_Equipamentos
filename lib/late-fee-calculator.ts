import {
  createQuoteAdministration,
  createQuoteLateFees,
} from '@gb-locacoes/backend/quotations'
import { withTenantTransaction } from '@/lib/tenant'
import { withRentalTransaction } from '@/lib/rental-transaction'

export const { calculateAndApplyLateFees } = createQuoteLateFees({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})

export const { calculateQuoteLateFee } = createQuoteAdministration({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
  withRentalTransaction,
})
