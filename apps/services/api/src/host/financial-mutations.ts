import {
  createFinancialMutations,
  createBoletoReissueRequest,
} from '@gb-locacoes/backend/billing'
import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from './tenant-transaction'
const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction,
})
export const {
  updateFinancialSettings,
  updateFinancialStatus,
  inspectFinancialEntryDeletion,
} = createFinancialMutations({ withTenantTransaction, withRentalTransaction })
export const { requestBoletoReissue } = createBoletoReissueRequest({
  withRentalTransaction,
})
