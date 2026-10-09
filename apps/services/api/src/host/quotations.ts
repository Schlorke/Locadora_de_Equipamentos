import {
  createQuoteRequests,
  createAdjustedQuoteDelivery,
  createQuoteAdministration,
  createQuoteAdjustments,
  createQuoteUpdates,
  createQuoteExpiration,
  createQuoteLateFees,
  type QuoteRequests,
  type AdjustedQuoteDelivery,
  type QuoteAdministration,
  type QuoteAdjustments,
  type QuoteUpdates,
} from '@gb-locacoes/backend/quotations'
import {
  createRentalTransaction,
  createRentalAvailability,
  createQuoteConversion,
  type TenantTransactionRunner,
} from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
export { QuoteUpdateRejected } from '@gb-locacoes/backend/quotations'

function quotations() {
  const prisma = getDatabaseRuntime().prisma
  const run: TenantTransactionRunner = (context, operation) =>
    withTenantTransaction(prisma, context, operation)
  const transactions = {
    withTenantTransaction: run,
    ...createRentalTransaction({ withTenantTransaction: run }),
  }
  const availability = createRentalAvailability(transactions)
  const conversion = createQuoteConversion({
    ...transactions,
    assertRentalItemsAvailability: availability.assertRentalItemsAvailability,
  })
  return {
    ...conversion,
    ...createQuoteExpiration(transactions),
    ...createQuoteLateFees(transactions),
    ...createQuoteRequests({
      ...transactions,
      assertRentalItemsAvailability: availability.assertRentalItemsAvailability,
    }),
    ...createAdjustedQuoteDelivery(transactions),
    ...createQuoteAdministration(transactions),
    ...createQuoteAdjustments(transactions),
    ...createQuoteUpdates({
      ...transactions,
      convertQuoteToRentalInTransaction:
        conversion.convertQuoteToRentalInTransaction,
      isEquipmentAvailableForRental: availability.isEquipmentAvailableForRental,
      autoGenerateBoletoOnApproval: () =>
        process.env.AUTO_GENERATE_BOLETO_ON_QUOTE === 'true',
    }),
  }
}
export function createQuoteRequest(
  ...args: Parameters<QuoteRequests['createQuoteRequest']>
) {
  return quotations().createQuoteRequest(...args)
}
export function requestAdjustedQuoteDelivery(
  ...args: Parameters<AdjustedQuoteDelivery['requestAdjustedQuoteDelivery']>
) {
  return quotations().requestAdjustedQuoteDelivery(...args)
}
export function deleteQuote(
  ...args: Parameters<QuoteAdministration['deleteQuote']>
) {
  return quotations().deleteQuote(...args)
}
export function calculateQuoteLateFee(
  ...args: Parameters<QuoteAdministration['calculateQuoteLateFee']>
) {
  return quotations().calculateQuoteLateFee(...args)
}
export function hasQuoteAdjustment(
  ...args: Parameters<QuoteAdministration['hasQuoteAdjustment']>
) {
  return quotations().hasQuoteAdjustment(...args)
}
export function listQuoteAdjustments(
  ...args: Parameters<QuoteAdjustments['listQuoteAdjustments']>
) {
  return quotations().listQuoteAdjustments(...args)
}
export function createQuoteAdjustment(
  ...args: Parameters<QuoteAdjustments['createQuoteAdjustment']>
) {
  return quotations().createQuoteAdjustment(...args)
}
export function updateQuote(...args: Parameters<QuoteUpdates['updateQuote']>) {
  return quotations().updateQuote(...args)
}
export function convertQuoteToRental(
  ...args: Parameters<
    ReturnType<typeof createQuoteConversion>['convertQuoteToRental']
  >
) {
  return quotations().convertQuoteToRental(...args)
}

export function convertPaidQuotePayment(
  ...args: Parameters<
    ReturnType<typeof createQuoteConversion>['convertPaidQuotePayment']
  >
) {
  return quotations().convertPaidQuotePayment(...args)
}

export function autoConvertApprovedQuotes(
  ...args: Parameters<
    ReturnType<typeof createQuoteConversion>['autoConvertApprovedQuotes']
  >
) {
  return quotations().autoConvertApprovedQuotes(...args)
}
export function checkAndExpireQuotes(
  ...args: Parameters<
    ReturnType<typeof createQuoteExpiration>['checkAndExpireQuotes']
  >
) {
  return quotations().checkAndExpireQuotes(...args)
}
export function calculateAndApplyLateFees(
  ...args: Parameters<
    ReturnType<typeof createQuoteLateFees>['calculateAndApplyLateFees']
  >
) {
  return quotations().calculateAndApplyLateFees(...args)
}
