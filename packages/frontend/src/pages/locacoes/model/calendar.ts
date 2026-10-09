import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  addWeeks,
  addMonths,
} from 'date-fns'
import type { Rental } from './contracts'
export type RentalCalendarView = 'daily' | 'weekly' | 'monthly'
export function rentalCalendarPeriod(rental: Rental) {
  const pendingDate =
    rental.status === 'PENDING' && rental.createdat
      ? new Date(rental.createdat)
      : null
  return {
    start: pendingDate ?? new Date(rental.startdate),
    end: pendingDate ?? new Date(rental.enddate),
  }
}
export function rentalCalendarDays(date: Date, view: RentalCalendarView) {
  const start =
    view === 'monthly'
      ? startOfMonth(date)
      : view === 'weekly'
        ? startOfWeek(date, { weekStartsOn: 1 })
        : startOfDay(date)
  const end =
    view === 'monthly'
      ? endOfMonth(date)
      : view === 'weekly'
        ? endOfWeek(date, { weekStartsOn: 1 })
        : endOfDay(date)
  return eachDayOfInterval({ start, end })
}
export function rentalsOnDay(rentals: Rental[], day: Date) {
  return rentals.filter((rental) => {
    const { start, end } = rentalCalendarPeriod(rental)
    return start <= endOfDay(day) && end >= startOfDay(day)
  })
}
export function moveRentalCalendar(
  date: Date,
  view: RentalCalendarView,
  direction: number
) {
  return view === 'monthly'
    ? addMonths(date, direction)
    : view === 'weekly'
      ? addWeeks(date, direction)
      : addDays(date, direction)
}
