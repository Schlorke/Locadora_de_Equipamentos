import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from 'date-fns'
export type FinancialCalendarView = 'daily' | 'weekly' | 'monthly'
export function financialCalendarDays(date: Date, view: FinancialCalendarView) {
  if (view === 'daily') return [startOfDay(date)]
  return eachDayOfInterval(
    view === 'weekly'
      ? {
          start: startOfWeek(date, { weekStartsOn: 0 }),
          end: endOfWeek(date, { weekStartsOn: 0 }),
        }
      : { start: startOfMonth(date), end: endOfMonth(date) }
  )
}
export function moveFinancialCalendar(
  date: Date,
  view: FinancialCalendarView,
  direction: number
) {
  return view === 'daily'
    ? addDays(date, direction)
    : view === 'weekly'
      ? addWeeks(date, direction)
      : addMonths(date, direction)
}
export function financialEventsOnDay<T extends { start: Date }>(
  events: T[],
  day: Date
) {
  return events.filter((event) => isSameDay(event.start, day))
}
