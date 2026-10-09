import { addBusinessDays, endOfDay } from 'date-fns'

export function getBoletoDueDate(
  baseDate: Date = new Date(),
  businessDays: number = 3
) {
  return endOfDay(addBusinessDays(baseDate, businessDays))
}
