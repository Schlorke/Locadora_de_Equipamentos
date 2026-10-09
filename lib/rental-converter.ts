import { createQuoteConversion } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from '@/lib/tenant'
import { assertRentalItemsAvailability } from '@/lib/equipment-availability'
import { withRentalTransaction } from '@/lib/rental-transaction'

export type { ConvertQuoteToRentalResult } from '@gb-locacoes/backend/rentals'

export const {
  convertQuoteToRental,
  convertQuoteToRentalInTransaction,
  convertPaidQuotePayment,
  autoConvertApprovedQuotes,
} = createQuoteConversion({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
  withRentalTransaction,
  assertRentalItemsAvailability,
})
