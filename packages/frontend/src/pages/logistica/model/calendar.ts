import { addHours, parseISO } from 'date-fns'
import type { CalendarEvent } from '../../../widgets/calendario'
import { type Delivery } from './contracts'
export function toLogisticsCalendarEvent(delivery: Delivery): CalendarEvent {
  const start = parseISO(delivery.scheduledAt)
  const end = addHours(start, 2)

  if (end < start) {
    const now = new Date()
    return {
      id: delivery.id,
      title: `${delivery.type === 'DELIVERY' ? 'Entrega' : 'Coleta'} - ${delivery.rental.users.name || 'Cliente'}`,
      start: now,
      end: addHours(now, 2),
      resourceId: delivery.vehicleId ?? `type-${delivery.type}`,
      // prettier-ignore
      color: delivery.type === 'DELIVERY' ? '#3B82F6' : '#8B5CF6' /* token-check-allow: azul de entrega e roxo de coleta */,
      type: delivery.type === 'DELIVERY' ? 'delivery' : 'pickup',
      status: delivery.status,
      metadata: {
        address: delivery.address,
        driverName: delivery.driverName,
        vehicleId: delivery.vehicleId,
      },
    }
  }

  return {
    id: delivery.id,
    title: `${delivery.type === 'DELIVERY' ? 'Entrega' : 'Coleta'} - ${delivery.rental.users.name || 'Cliente'}`,
    start,
    end,
    resourceId: delivery.vehicleId ?? `type-${delivery.type}`,
    // prettier-ignore
    color: delivery.type === 'DELIVERY' ? '#3B82F6' : '#8B5CF6' /* token-check-allow: azul de entrega e roxo de coleta */,
    type: delivery.type === 'DELIVERY' ? 'delivery' : 'pickup',
    status: delivery.status,
    metadata: {
      address: delivery.address,
      driverName: delivery.driverName,
      vehicleId: delivery.vehicleId,
    },
  }
}
