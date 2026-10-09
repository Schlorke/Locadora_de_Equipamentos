import { createContactRequests } from '@gb-locacoes/backend/quotations'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from './tenant-transaction'
export const createContactRequest = createContactRequests(
  createRentalTransaction({ withTenantTransaction })
)
