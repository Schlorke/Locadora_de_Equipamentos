import {
  createAdjustedQuoteDelivery,
  createAdminQuoteListing,
  createClientQuotePortal,
  createQuoteAdjustments,
  createQuoteAdministration,
  createQuoteRequests,
  createQuoteUpdates,
} from '@gb-locacoes/backend/quotations'
import { withTenantTransaction } from '@/lib/tenant'
import {
  assertRentalItemsAvailability,
  isEquipmentAvailableForRental,
} from '@/lib/equipment-availability'
import { convertQuoteToRentalInTransaction } from '@/lib/rental-converter'
import { withRentalTransaction } from '@/lib/rental-transaction'

export { QuoteUpdateRejected } from '@gb-locacoes/backend/quotations'
export type {
  AdminQuoteFilters,
  QuoteAdjustmentInput,
  QuoteRequestInput,
  QuoteUpdateBody,
} from '@gb-locacoes/backend/quotations'

export const { createQuoteRequest } = createQuoteRequests({
  withRentalTransaction,
  assertRentalItemsAvailability,
})

export const { requestAdjustedQuoteDelivery } = createAdjustedQuoteDelivery({
  withRentalTransaction,
})

export const { listClientQuotes, readClientQuote, hideClientQuote } =
  createClientQuotePortal({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(context, operation),
  })

export const { readAdminQuote, deleteQuote, hasQuoteAdjustment } =
  createQuoteAdministration({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(context, operation),
    withRentalTransaction,
  })

export const { listQuoteAdjustments, createQuoteAdjustment } =
  createQuoteAdjustments({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(context, operation),
    withRentalTransaction,
  })

export const { listAdminQuotes } = createAdminQuoteListing({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})

export const { updateQuote } = createQuoteUpdates({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
  withRentalTransaction,
  convertQuoteToRentalInTransaction,
  isEquipmentAvailableForRental,
  // Lido a cada aprovação, como no fluxo original.
  autoGenerateBoletoOnApproval: () =>
    process.env.AUTO_GENERATE_BOLETO_ON_QUOTE === 'true',
})
