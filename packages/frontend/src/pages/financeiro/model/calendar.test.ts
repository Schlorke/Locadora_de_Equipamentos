import { expect, it } from 'vitest'
import {
  financialCalendarDays,
  financialEventsOnDay,
  moveFinancialCalendar,
} from './calendar'
it('navega três intervalos e encontra eventos pelo dia local', () => {
  const date = new Date(2032, 1, 29, 15)
  expect(financialCalendarDays(date, 'daily')).toHaveLength(1)
  expect(financialCalendarDays(date, 'weekly')).toHaveLength(7)
  expect(financialCalendarDays(date, 'monthly')).toHaveLength(29)
  expect(moveFinancialCalendar(date, 'daily', 1).getDate()).toBe(1)
  expect(moveFinancialCalendar(date, 'weekly', 1).getDate()).toBe(7)
  expect(moveFinancialCalendar(date, 'monthly', 1).getMonth()).toBe(2)
  expect(
    financialEventsOnDay(
      [{ start: date }, { start: new Date(2032, 2, 1) }],
      new Date(2032, 1, 29)
    )
  ).toEqual([{ start: date }])
})
