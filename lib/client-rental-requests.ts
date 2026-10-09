import {
  createClientRentalPortal,
  createClientRentalRequests,
} from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from '@/lib/tenant'
import { withRentalTransaction } from '@/lib/rental-transaction'

export const { requestClientRentalAction } = createClientRentalRequests({
  withRentalTransaction,
})

export const { listClientRentals, readClientRental, hideClientRental } =
  createClientRentalPortal({
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(context, operation),
  })
