import {
  createRentalAdministration,
  createRentalAvailability,
  createRentalLifecycle,
  createRentalTransaction,
  createQuoteConversion,
  type RentalAdministration,
  type RentalLifecycle,
  type TenantTransactionRunner,
} from '@gb-locacoes/backend/rentals'
import { getMissingClientDocumentsInTransaction } from '@gb-locacoes/backend/customers'
import { withTenantTransaction } from '@gb-locacoes/backend/identity'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

function rentals() {
  const prisma = getDatabaseRuntime().prisma
  const run: TenantTransactionRunner = (context, operation) =>
    withTenantTransaction(prisma, context, operation)
  const transactions = {
    withTenantTransaction: run,
    ...createRentalTransaction({ withTenantTransaction: run }),
  }
  const availability = createRentalAvailability(transactions)
  const lifecycle = createRentalLifecycle({
    ...transactions,
    assertRentalItemsAvailability: availability.assertRentalItemsAvailability,
    getMissingClientDocuments: getMissingClientDocumentsInTransaction,
  })
  const conversion = createQuoteConversion({
    ...transactions,
    assertRentalItemsAvailability: availability.assertRentalItemsAvailability,
  })
  return {
    ...lifecycle,
    ...createRentalAdministration({
      ...transactions,
      convertQuoteToRental: conversion.convertQuoteToRental,
      createManualRental: lifecycle.createManualRental,
    }),
  }
}

export function listAdminRentals(
  ...args: Parameters<RentalAdministration['listAdminRentals']>
) {
  return rentals().listAdminRentals(...args)
}
export function readAdminRental(
  ...args: Parameters<RentalAdministration['readAdminRental']>
) {
  return rentals().readAdminRental(...args)
}
export function createAdminRental(
  ...args: Parameters<RentalAdministration['createAdminRental']>
) {
  return rentals().createAdminRental(...args)
}
export function applyRentalLateFee(
  ...args: Parameters<RentalAdministration['applyRentalLateFee']>
) {
  return rentals().applyRentalLateFee(...args)
}
export function checkoutRental(
  ...args: Parameters<RentalLifecycle['checkoutRental']>
) {
  return rentals().checkoutRental(...args)
}
export function checkinRental(
  ...args: Parameters<RentalLifecycle['checkinRental']>
) {
  return rentals().checkinRental(...args)
}
export function updateRental(
  ...args: Parameters<RentalLifecycle['updateRental']>
) {
  return rentals().updateRental(...args)
}
export function extendRental(
  ...args: Parameters<RentalLifecycle['extendRental']>
) {
  return rentals().extendRental(...args)
}
