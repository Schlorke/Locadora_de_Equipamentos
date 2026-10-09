'use client'

import { startOfDay, endOfDay } from 'date-fns'
import { cn } from '../../../shared/lib/cn.web'
import type { CalendarEvent } from './types'

interface AllDaySectionProps {
  date: Date
  events: CalendarEvent[]
  onEventClick?: (_event: CalendarEvent) => void
  className?: string
}

/**
 * Classifica eventos como all-day/multi-day ou time-grid
 * Locações/Orçamentos = all-day/multi-day
 * Manutenção/Logística = time-grid
 */
export function classifyEventType(event: CalendarEvent): {
  isAllDay: boolean
  isMultiDay: boolean
} {
  // Se já está marcado explicitamente
  if (event.isAllDay !== undefined || event.isMultiDay !== undefined) {
    return {
      isAllDay: event.isAllDay ?? false,
      isMultiDay: event.isMultiDay ?? false,
    }
  }

  // Locações e orçamentos são tratados como multi-day
  if (event.type === 'rental') {
    const duration = event.end.getTime() - event.start.getTime()
    const days = duration / (1000 * 60 * 60 * 24)
    return {
      isAllDay: days >= 1,
      isMultiDay: days > 1,
    }
  }

  // Manutenção e logística ficam no time-grid
  return {
    isAllDay: false,
    isMultiDay: false,
  }
}

/**
 * Filtra eventos all-day/multi-day
 */
export function getAllDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((event) => {
    const { isAllDay, isMultiDay } = classifyEventType(event)
    return isAllDay || isMultiDay
  })
}

/**
 * Componente para renderizar eventos all-day/multi-day
 * em uma faixa superior separada da grade de horas
 *
 * IMPORTANTE: Este componente mostra APENAS solicitações pendentes.
 * Eventos aprovados ou rejeitados não aparecem aqui.
 */
export function AllDaySection({
  date,
  events,
  onEventClick,
  className,
}: AllDaySectionProps) {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  // Filtra apenas eventos all-day que são PENDENTES
  const allDayEvents = getAllDayEvents(events).filter((event) => {
    const overlapsDay = event.start <= dayEnd && event.end >= dayStart
    const isPending = event.status === 'pending'
    return overlapsDay && isPending
  })

  if (allDayEvents.length === 0) {
    return null
  }

  const pendingColor = '#F97316' // token-check-allow: valor visual original do calendário

  return (
    <div
      className={cn(
        'border-b border-slate-200 bg-slate-50/50 h-[40px] px-2 py-2 flex items-center',
        className
      )}
      style={{ minHeight: '40px', maxHeight: '40px' }}
    >
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
          DIA INTEIRO
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {allDayEvents.map((event) => (
          <div
            key={event.id}
            className="text-xs px-2 py-1.5 cursor-pointer hover:opacity-80 transition-opacity border-l-2 rounded-none h-full flex items-center"
            style={{
              backgroundColor: 'rgba(249, 115, 22, 0.125)', // token-check-allow: valor visual original do calendário
              borderLeftColor: pendingColor,
              color: '#1f2937', // token-check-allow: valor visual original do calendário
            }}
            onClick={() => onEventClick?.(event)}
            title="Solicitação pendente - Clique para ver detalhes"
          >
            <span className="truncate">Solicitação pendente</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Versão para visualização mensal - renderiza barras/itens por dia
 */
export function AllDaySectionMonthly({
  day,
  events,
  onEventClick,
  maxVisible = 2,
}: {
  day: Date
  events: CalendarEvent[]
  onEventClick?: (_event: CalendarEvent) => void
  maxVisible?: number
}) {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)

  const allDayEvents = getAllDayEvents(events).filter((event) => {
    return event.start <= dayEnd && event.end >= dayStart
  })

  if (allDayEvents.length === 0) {
    return null
  }

  const visibleEvents = allDayEvents.slice(0, maxVisible)

  return (
    <div className="space-y-1 shrink-0">
      {visibleEvents.map((event) => (
        <div
          key={event.id}
          className="text-xs px-2 py-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity border-l-2"
          style={{
            backgroundColor: event.color + '20',
            borderLeftColor: event.color,
            color: '#1f2937', // token-check-allow: valor visual original do calendário
          }}
          onClick={(e) => {
            e.stopPropagation()
            onEventClick?.(event)
          }}
        >
          {event.title}
        </div>
      ))}
    </div>
  )
}
