import { createVehicleService } from '@gb-locacoes/backend/operations'
import { withRentalTransaction } from '@/lib/rental-transaction'

export { VehicleError } from '@gb-locacoes/backend/operations'

export const { listVehicles, createVehicle } = createVehicleService({
  withRentalTransaction,
})
