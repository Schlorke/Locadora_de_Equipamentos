import { expect, it } from 'vitest'
import { calendarDays, navigateCalendar, eventsForDay } from './interval'
it('semanas começam na segunda e grade mensal cobre dias adjacentes como o web', () => {
  const date = new Date(2024, 1, 15, 12),
    week = calendarDays(date, 'weekly'),
    month = calendarDays(date, 'monthly')
  expect(week).toHaveLength(7)
  expect(week[0]!.getDay()).toBe(1)
  expect(calendarDays(date, 'daily')).toHaveLength(1)
  expect(calendarDays(date, 'timeline')).toEqual(week)
  expect(month).toHaveLength(35)
  expect(month[0]!).toEqual(new Date(2024, 0, 29))
  expect(month.at(-1)!).toEqual(new Date(2024, 2, 3))
  expect(navigateCalendar(date, 'monthly', 1).getMonth()).toBe(2)
  expect(navigateCalendar(date, 'weekly', -1).getDate()).toBe(8)
  expect(navigateCalendar(date, 'daily', 1).getDate()).toBe(16)
})
it('eventos sobrepostos ao dia são visíveis mesmo iniciando no anterior', () => {
  const base = {
    id: 'evento',
    title: 'Evento',
    color: '',
    type: 'delivery' as const,
    status: 'SCHEDULED',
    start: new Date(2024, 1, 14, 23),
    end: new Date(2024, 1, 15, 1),
  }
  expect(eventsForDay([base], new Date(2024, 1, 15))).toEqual([base])
  expect(eventsForDay([base], new Date(2024, 1, 16))).toEqual([])
})
