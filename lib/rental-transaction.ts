import { createRentalTransaction } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from '@/lib/tenant'

export {
  RentalMutationError,
  assertTenantCustomer,
} from '@gb-locacoes/backend/rentals'

/** Todas as decisões e escritas de reserva usam a mesma conexão e o mesmo lock. */
export const { withRentalTransaction } = createRentalTransaction({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})
