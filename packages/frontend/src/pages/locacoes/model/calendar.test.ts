import { expect, it } from 'vitest'
import {
  rentalCalendarPeriod,
  rentalCalendarDays,
  rentalsOnDay,
  moveRentalCalendar,
} from './calendar'
import type { Rental } from './contracts'
const rental = {
  id: 'r',
  status: 'ACTIVE',
  startdate: '2026-10-02T12:00:00',
  enddate: '2026-10-05T12:00:00',
  createdat: '2026-09-20T12:00:00',
} as Rental
it('pendente usa criação; demais intervalos incluem todos os dias e não incluem fora do período', () => {
  expect(rentalCalendarPeriod({ ...rental, status: 'PENDING' }).start).toEqual(
    new Date(rental.createdat!)
  )
  expect(
    rentalCalendarPeriod({ ...rental, status: 'PENDING', createdat: undefined })
      .start
  ).toEqual(new Date(rental.startdate))
  expect(rentalsOnDay([rental], new Date('2026-10-03T12:00:00'))).toEqual([
    rental,
  ])
  expect(rentalsOnDay([rental], new Date('2026-10-06T12:00:00'))).toEqual([])
  expect(
    rentalsOnDay(
      [{ ...rental, status: 'PENDING' }],
      new Date('2026-09-20T12:00:00')
    )
  ).toHaveLength(1)
  expect(
    rentalsOnDay(
      [{ ...rental, status: 'PENDING' }],
      new Date('2026-10-03T12:00:00')
    )
  ).toHaveLength(0)
})
it('dia/semana/mês preservam datas locais e navegação de período', () => {
  const date = new Date('2026-10-03T12:00:00')
  expect(rentalCalendarDays(date, 'daily')).toHaveLength(1)
  const week = rentalCalendarDays(date, 'weekly')
  expect(week).toHaveLength(7)
  expect(week[0]!.getDay()).toBe(1)
  expect(rentalCalendarDays(date, 'monthly')).toHaveLength(31)
  expect(moveRentalCalendar(date, 'weekly', 1).getDate()).toBe(10)
  expect(moveRentalCalendar(date, 'daily', -1).getDate()).toBe(2)
  expect(moveRentalCalendar(date, 'monthly', 1).getMonth()).toBe(10)
})
