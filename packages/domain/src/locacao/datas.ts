import {
  addBusinessDays,
  addDays,
  differenceInBusinessDays,
  differenceInCalendarDays,
  endOfDay,
  isWeekend,
  startOfDay,
} from 'date-fns'

type AutoDateRangeInput = {
  requestDate: Date
  days: number
  includeWeekends: boolean
}

const normalizeStartDate = (requestDate: Date, includeWeekends: boolean) => {
  const baseDate = startOfDay(requestDate)

  if (includeWeekends) {
    return baseDate
  }

  let current = baseDate
  while (isWeekend(current)) {
    current = addDays(current, 1)
  }

  return current
}

export const getAutoRentalDateRange = ({
  requestDate,
  days,
  includeWeekends,
}: AutoDateRangeInput) => {
  const safeDays = Math.max(1, Number(days) || 1)
  const startDate = normalizeStartDate(requestDate, includeWeekends)

  const endDate = includeWeekends
    ? endOfDay(addDays(startDate, safeDays - 1))
    : endOfDay(addBusinessDays(startDate, safeDays - 1))

  return { startDate, endDate }
}

/** Calcula dias entre duas datas (inclusive). Se includeWeekends=false, conta apenas dias úteis. */
export function countRentalDays(
  startDate: Date,
  endDate: Date,
  includeWeekends: boolean
): number {
  const start = startOfDay(startDate)
  const end = startOfDay(endDate)
  if (end < start) return 0
  if (includeWeekends) {
    return differenceInCalendarDays(end, start) + 1
  }
  const businessDays = differenceInBusinessDays(end, start) + 1
  return Math.max(1, businessDays)
}
