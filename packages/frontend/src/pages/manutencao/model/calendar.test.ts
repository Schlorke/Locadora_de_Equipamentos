import { expect, it } from 'vitest'
import { toMaintenanceCalendarEvent } from './calendar'
import { maintenance } from '../../../../../../tests/helpers/operation-fixtures'
it('mantém quatro horas padrão, fallback anterior e teto de 24 horas', () => {
  const item = maintenance(0),
    start = new Date(item.scheduledAt).getTime()
  expect(toMaintenanceCalendarEvent(item).end.getTime() - start).toBe(14400000)
  expect(
    toMaintenanceCalendarEvent({
      ...item,
      completedAt: new Date(start - 1).toISOString(),
    }).end.getTime() - start
  ).toBe(14400000)
  expect(
    toMaintenanceCalendarEvent({
      ...item,
      completedAt: new Date(start + 48 * 3600000).toISOString(),
    }).end.getTime() - start
  ).toBe(86400000)
  expect(toMaintenanceCalendarEvent(item).color).toBe('#10B981')
  expect(
    toMaintenanceCalendarEvent({ ...item, type: 'CORRECTIVE' }).color
  ).toBe('#F59E0B')
  expect(
    toMaintenanceCalendarEvent({ ...item, type: 'INSPECTION' }).color
  ).toBe('#6366F1')
})
