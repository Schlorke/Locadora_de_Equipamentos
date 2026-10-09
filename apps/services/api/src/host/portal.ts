import { createCustomerActivities } from '@gb-locacoes/backend/customers'
import {
  createClientRentalPortal,
  createClientRentalRequests,
  createRentalTransaction,
  type ClientRentalPortal,
  type ClientRentalRequests,
  type TenantTransactionRunner,
} from '@gb-locacoes/backend/rentals'
import {
  createClientQuotePortal,
  createAdminQuoteListing,
  createQuoteAdministration,
  type ClientQuotePortal,
  type AdminQuoteListing,
  type QuoteAdministration,
} from '@gb-locacoes/backend/quotations'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

function transactions() {
  const prisma = getDatabaseRuntime().prisma
  const run: TenantTransactionRunner = (context, operation) =>
    withTenantTransaction(prisma, context, operation)
  const { withRentalTransaction } = createRentalTransaction({
    withTenantTransaction: run,
  })
  return { withTenantTransaction: run, withRentalTransaction }
}

export function listClientRentals(
  ...args: Parameters<ClientRentalPortal['listClientRentals']>
) {
  return createClientRentalPortal(transactions()).listClientRentals(...args)
}
export function readClientRental(
  ...args: Parameters<ClientRentalPortal['readClientRental']>
) {
  return createClientRentalPortal(transactions()).readClientRental(...args)
}
export function hideClientRental(
  ...args: Parameters<ClientRentalPortal['hideClientRental']>
) {
  return createClientRentalPortal(transactions()).hideClientRental(...args)
}
export function requestClientRentalAction(
  ...args: Parameters<ClientRentalRequests['requestClientRentalAction']>
) {
  return createClientRentalRequests(transactions()).requestClientRentalAction(
    ...args
  )
}
export function readClientQuote(
  ...args: Parameters<ClientQuotePortal['readClientQuote']>
) {
  return createClientQuotePortal(transactions()).readClientQuote(...args)
}
export function hideClientQuote(
  ...args: Parameters<ClientQuotePortal['hideClientQuote']>
) {
  return createClientQuotePortal(transactions()).hideClientQuote(...args)
}
export function listAdminQuotes(
  ...args: Parameters<AdminQuoteListing['listAdminQuotes']>
) {
  return createAdminQuoteListing(transactions()).listAdminQuotes(...args)
}
export function readAdminQuote(
  ...args: Parameters<QuoteAdministration['readAdminQuote']>
) {
  return createQuoteAdministration(transactions()).readAdminQuote(...args)
}

export function listClientQuotes(
  ...args: Parameters<ClientQuotePortal['listClientQuotes']>
) {
  return createClientQuotePortal(transactions()).listClientQuotes(...args)
}

export function listClientActivities(
  ...args: Parameters<
    ReturnType<typeof createCustomerActivities>['listClientActivities']
  >
) {
  return createCustomerActivities(transactions()).listClientActivities(...args)
}
