import { createContactRequests } from '@gb-locacoes/backend/quotations'
import { withRentalTransaction } from './rental-transaction'
export const createContactRequest = createContactRequests({
  withRentalTransaction,
})
