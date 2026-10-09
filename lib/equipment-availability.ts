import { createRentalAvailability } from '@gb-locacoes/backend/rentals'
import { withTenantTransaction } from '@/lib/tenant'

export type {
  AvailabilityOptions,
  AvailabilityResult,
  RentalAvailabilityItem,
} from '@gb-locacoes/backend/rentals'

export const {
  calculateEquipmentAvailability,
  isEquipmentAvailableForRental,
  assertRentalItemsAvailability,
  calculateEquipmentCalendarAvailability,
} = createRentalAvailability({
  withTenantTransaction: (context, operation) =>
    withTenantTransaction(context, operation),
})
