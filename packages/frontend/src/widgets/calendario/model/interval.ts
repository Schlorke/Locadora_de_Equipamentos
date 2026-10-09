import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
} from 'date-fns'
import type { CalendarEvent, ViewMode } from '../ui/types'
export function calendarDays(date: Date, view: ViewMode): Date[] {
  if (view === 'daily') return [startOfDay(date)]
  const start =
    view === 'monthly'
      ? startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
      : startOfWeek(date, { weekStartsOn: 1 })
  const end =
    view === 'monthly'
      ? endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
      : addDays(start, 6)
  return eachDayOfInterval({ start, end })
}
export function navigateCalendar(date: Date, view: ViewMode, amount: number) {
  return view === 'daily'
    ? addDays(date, amount)
    : view === 'monthly'
      ? addMonths(date, amount)
      : addWeeks(date, amount)
}
export function eventsForDay(events: CalendarEvent[], day: Date) {
  const start = startOfDay(day),
    end = addDays(start, 1)
  return events.filter(
    (event) =>
      event.start.getTime() < end.getTime() &&
      event.end.getTime() >= start.getTime()
  )
}
