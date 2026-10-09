import {
  endOfDay,
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  addWeeks,
  addMonths,
} from 'date-fns'
import type { Quote } from '../../../entities/orcamento'
export type QuoteCalendarView = 'daily' | 'weekly' | 'monthly'
export function quoteCalendarPeriod(quote: Quote, now = new Date()) {
  if (quote.status === 'rejected') {
    const date = new Date(
      quote.rejectedAt || quote.updatedAt || quote.createdAt
    )
    return { start: date, end: date, createdAt: date }
  }
  if (quote.status === 'pending') {
    const date = quote.createdAt ? new Date(quote.createdAt) : now
    return { start: date, end: date, createdAt: date }
  }
  const startValue = quote.startDate || quote.items?.[0]?.startDate,
    endValue = quote.endDate || quote.items?.[0]?.endDate
  const start = new Date(startValue || quote.createdAt)
  return { start, end: endValue ? new Date(endValue) : start }
}
export function quoteCalendarDays(date: Date, view: QuoteCalendarView) {
  return eachDayOfInterval({
    start:
      view === 'monthly'
        ? startOfMonth(date)
        : view === 'weekly'
          ? startOfWeek(date, { weekStartsOn: 1 })
          : startOfDay(date),
    end:
      view === 'monthly'
        ? endOfMonth(date)
        : view === 'weekly'
          ? endOfWeek(date, { weekStartsOn: 1 })
          : endOfDay(date),
  })
}
export function quotesOnDay(quotes: Quote[], date: Date) {
  return quotes.filter((quote) => {
    const period = quoteCalendarPeriod(quote)
    return period.start <= endOfDay(date) && period.end >= startOfDay(date)
  })
}
export function moveQuoteCalendar(
  date: Date,
  view: QuoteCalendarView,
  direction: number
) {
  return view === 'monthly'
    ? addMonths(date, direction)
    : view === 'weekly'
      ? addWeeks(date, direction)
      : addDays(date, direction)
}
