import {
  createRentalAdministration,
  createRentalLifecycle,
} from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from '@/lib/tenant'
import { getMissingClientDocuments } from '@/lib/client-documents'
import { assertRentalItemsAvailability } from '@/lib/equipment-availability'
import { convertQuoteToRental } from '@/lib/rental-converter'
import { withRentalTransaction } from '@/lib/rental-transaction'

export {
  rentalResponseInclude,
  rentalStatusFilter,
} from '@gb-locacoes/backend/rentals'
export type {
  AdminRentalFilters,
  ManualRentalInput,
  RentalExtensionInput,
  RentalLateFeeOutcome,
  RentalUpdateInput,
} from '@gb-locacoes/backend/rentals'

export const {
  checkoutRental,
  createManualRental,
  updateRental,
  extendRental,
  checkinRental,
} = createRentalLifecycle({
  withRentalTransaction,
  assertRentalItemsAvailability,
  getMissingClientDocuments: (context, options, tx) =>
    getMissingClientDocuments(context, options, tx),
})

export const {
  listAdminRentals,
  readAdminRental,
  createAdminRental,
  applyRentalLateFee,
} = createRentalAdministration({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
  withRentalTransaction,
  convertQuoteToRental,
  createManualRental,
})
