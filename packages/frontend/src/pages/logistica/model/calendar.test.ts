import { expect, it } from 'vitest'
import { toLogisticsCalendarEvent } from './calendar'
import { delivery } from '../../../../../../tests/helpers/operation-fixtures'
it('entrega e coleta mantêm duas horas, cores e recurso sem veículo', () => {
  const first = toLogisticsCalendarEvent(delivery(0)),
    second = toLogisticsCalendarEvent(delivery(1))
  expect(first.end.getTime() - first.start.getTime()).toBe(7200000)
  expect(first).toMatchObject({
    resourceId: 'type-DELIVERY',
    color: '#3B82F6',
    type: 'delivery',
  })
  expect(second).toMatchObject({
    resourceId: 'type-PICKUP',
    color: '#8B5CF6',
    type: 'pickup',
  })
})
