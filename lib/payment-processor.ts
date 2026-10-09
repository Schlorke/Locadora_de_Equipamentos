import { createPaymentProcessor } from '@gb-locacoes/backend/billing'
import { withRentalTransaction } from '@/lib/rental-transaction'
export const { processPayment } = createPaymentProcessor({
  withRentalTransaction,
})
