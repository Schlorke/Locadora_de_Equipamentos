import { addHours, parseISO } from 'date-fns'
import type { CalendarEvent } from '../../../widgets/calendario'
import { type Maintenance, typeConfig } from './contracts'
export function toMaintenanceCalendarEvent(
  maintenance: Maintenance
): CalendarEvent {
  const start = parseISO(maintenance.scheduledAt)
  let end = maintenance.completedAt
    ? parseISO(maintenance.completedAt)
    : addHours(start, 4)

  if (end < start) {
    end = addHours(start, 4)
  } else {
    const maxEnd = addHours(start, 24)
    if (end > maxEnd) {
      end = maxEnd
    }
  }

  return {
    id: maintenance.id,
    title: `${typeConfig[maintenance.type] ?? 'Manutenção'} - ${maintenance.equipment.name}`,
    start,
    end,
    resourceId: maintenance.equipment.id,
    color:
      maintenance.type === 'PREVENTIVE'
        ? '#10B981' /* token-check-allow: verde da manutenção preventiva */
        : maintenance.type === 'CORRECTIVE'
          ? '#F59E0B' /* token-check-allow: âmbar da manutenção corretiva */
          : '#6366F1', // token-check-allow: índigo dos outros tipos de manutenção
    type: 'maintenance',
    status: maintenance.status,
    metadata: {
      technician: maintenance.technician,
      equipmentName: maintenance.equipment.name,
      cost: maintenance.cost,
    },
  }
}
