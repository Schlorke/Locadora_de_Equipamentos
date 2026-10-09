import type { CalendarEvent, CalendarResource, ViewMode } from '../ui/types'

export interface AdvancedCalendarProps {
  events: CalendarEvent[]
  resources?: CalendarResource[]
  onEventClick?: (_event: CalendarEvent) => void
  onDateClick?: (_date: Date) => void
  onEventDrop?: (_eventId: string, _newStart: Date, _newEnd: Date) => void
  onCreateEvent?: (_event: Partial<CalendarEvent>) => void
  onEditEvent?: (_event: CalendarEvent) => void
  onRescheduleEvent?: (_event: CalendarEvent) => void
  onCompleteEvent?: (_event: CalendarEvent) => void
  onCancelEvent?: (_event: CalendarEvent) => void
  onOpenEquipment?: (_equipmentId?: string) => void
  onOpenRental?: (_rentalId: string) => void
  onOpenRoute?: (_event: CalendarEvent) => void
  defaultViewMode?: ViewMode
  defaultDate?: Date
  className?: string
  showFilters?: boolean
  fixedColumnWidth?: boolean // Para padronizar largura das colunas no modo diário
}
