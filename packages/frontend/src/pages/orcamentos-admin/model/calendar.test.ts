import { expect, it } from 'vitest'
import {
  quoteCalendarPeriod,
  quoteCalendarDays,
  quotesOnDay,
  moveQuoteCalendar,
} from './calendar'
import type { Quote } from '../../../entities/orcamento'
const quote: Quote = {
  name: 'Cliente',
  email: 'a@example.test',
  phone: '123',
  equipments: [],
  totalPrice: 10,
  id: 'q',
  status: 'pending',
  createdAt: '2033-03-02T12:00:00',
  updatedAt: '2033-03-03T12:00:00',
  startDate: '2033-03-06T12:00:00',
  endDate: '2033-03-09T12:00:00',
  items: [],
}
it('pendente usa criação, rejeitado usa rejeição/alteração e aprovado usa intervalo', () => {
  expect(quoteCalendarPeriod(quote).start).toEqual(new Date(quote.createdAt))
  expect(
    quoteCalendarPeriod({
      ...quote,
      status: 'rejected',
      rejectedAt: '2033-03-04T12:00:00',
    }).start
  ).toEqual(new Date('2033-03-04T12:00:00'))
  expect(quoteCalendarPeriod({ ...quote, status: 'rejected' }).start).toEqual(
    new Date(quote.updatedAt)
  )
  expect(
    quotesOnDay(
      [{ ...quote, status: 'approved' }],
      new Date('2033-03-07T12:00:00')
    )
  ).toHaveLength(1)
  expect(quotesOnDay([quote], new Date('2033-03-07T12:00:00'))).toHaveLength(0)
})
it('intervalo cai para datas de itens, mês contém todos os dias e navega sem duplicar', () => {
  const item = quoteCalendarPeriod({
    ...quote,
    status: 'approved',
    startDate: '',
    endDate: '',
    items: [{ startDate: '2033-03-06', endDate: '2033-03-08' }],
  } as Quote)
  expect(item.start).toEqual(new Date('2033-03-06'))
  const date = new Date('2033-03-07T12:00:00')
  expect(quoteCalendarDays(date, 'monthly')).toHaveLength(31)
  expect(quoteCalendarDays(date, 'weekly')).toHaveLength(7)
  expect(
    quoteCalendarDays(
      moveQuoteCalendar(date, 'daily', 1),
      'daily'
    )[0]?.getDate()
  ).toBe(8)
})
