import {
  CheckInSchema,
  UpdateRentalSchema,
} from '@gb-locacoes/contracts/rentals'
import { UpdateFinancialStatusSchema } from '@gb-locacoes/contracts/financial'

/** Strict payload classification shared by HTTP admission and decoded commands. */
export const rentalReturn = CheckInSchema.strict()
export const rentalClose = UpdateRentalSchema.pick({
  status: true,
  notes: true,
})
  .strict()
  .refine((body) => body.status === 'COMPLETED')
export const paymentSettlement = UpdateFinancialStatusSchema.strict().refine(
  (body) => body.billingStatus === 'PAID' || body.billingStatus === 'SETTLED'
)
