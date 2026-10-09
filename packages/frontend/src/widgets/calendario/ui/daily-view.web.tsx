'use client'

import { useMemo, useEffect, useState, useRef, useLayoutEffect } from 'react'
import {
  format,
  isSameDay,
  setHours,
  setMinutes,
  differenceInMinutes,
  startOfDay,
  startOfToday,
  endOfDay,
  max,
  min,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { EventBlock } from './event-block.web'
import { TimeIndicator } from './time-indicator.web'
import { AllDaySection, getAllDayEvents } from './all-day-section.web'
import { calculateEventPositions } from './event-overlap-manager'
import { HOUR_SLOT_HEIGHT, MINUTE_HEIGHT } from './constants'
import type { CalendarEvent, CalendarResource } from './types'

interface DailyViewProps {
  date: Date
  events: CalendarEvent[]
  resources?: CalendarResource[]
  onEventClick?: (_event: CalendarEvent) => void
  onDateClick?: (_date: Date) => void
  onCreateEvent?: (_event: Partial<CalendarEvent>) => void
  onColumnClick?: (
    _columnId: string,
    _columnName: string,
    _events: CalendarEvent[]
  ) => void
  fixedColumnWidth?: boolean // Para padronizar largura das colunas (ex: manutenção)
}

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 00:00 até 23:00

export function DailyView({
  date,
  events,
  resources,
  onEventClick,
  onDateClick: _onDateClick,
  onCreateEvent: _onCreateEvent,
  onColumnClick,
  fixedColumnWidth = false,
}: DailyViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [columnWidths, setColumnWidths] = useState<Map<string, number>>(
    new Map()
  )

  const hasResources = Boolean(resources?.length)
  const resourceColumns = useMemo<CalendarResource[]>(
    () => (hasResources ? resources! : [{ id: 'default', name: 'Eventos' }]),
    [hasResources, resources]
  )

  // Mede a largura real das colunas
  useLayoutEffect(() => {
    const updateWidths = () => {
      const newWidths = new Map<string, number>()
      columnRefs.current.forEach((el, key) => {
        if (el) {
          newWidths.set(key, el.clientWidth)
        }
      })

      // Só atualiza se os valores realmente mudaram
      setColumnWidths((prevWidths) => {
        let hasChanged = false
        if (prevWidths.size !== newWidths.size) {
          hasChanged = true
        } else {
          for (const [key, value] of newWidths) {
            if (prevWidths.get(key) !== value) {
              hasChanged = true
              break
            }
          }
        }
        return hasChanged ? newWidths : prevWidths
      })
    }

    // Usa requestAnimationFrame para evitar atualizações durante o render
    const rafId = requestAnimationFrame(() => {
      updateWidths()
    })

    window.addEventListener('resize', updateWidths)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updateWidths)
    }
  }, [date, resourceColumns.length]) // Depende de date e length, não do array em si

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Separa eventos all-day dos eventos do time-grid
  const allDayEvents = useMemo(() => getAllDayEvents(events), [events])

  const timeGridEvents = useMemo(() => {
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    return events.filter((event) => {
      // Exclui eventos all-day/multi-day
      if (event.isAllDay || event.isMultiDay) return false

      // Para eventos pendentes ou rejeitados, usa createdAt para determinar o dia
      if (event.isPendingRequest && event.createdAt) {
        return event.createdAt >= dayStart && event.createdAt <= dayEnd
      }

      // CORREÇÃO: Se o evento termina exatamente à meia-noite (00:00:00) do dia atual,
      // e começa antes deste dia, então ele não deve aparecer neste dia
      // (porque termina no início do dia, não durante o dia)
      const eventEndsAtMidnight =
        isSameDay(event.end, date) &&
        event.end.getHours() === 0 &&
        event.end.getMinutes() === 0 &&
        event.end.getSeconds() === 0 &&
        event.end.getMilliseconds() === 0

      if (eventEndsAtMidnight && event.start < dayStart) {
        // Evento termina no início deste dia e começa antes deste dia
        // Não deve aparecer neste dia
        return false
      }

      // Para outros eventos, inclui os que se sobrepõem ao dia
      return event.start <= dayEnd && event.end >= dayStart
    })
  }, [events, date])

  const getEventPosition = (event: CalendarEvent) => {
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    // Para eventos pendentes ou rejeitados, posiciona pelo horário de criação com altura auto
    if (event.isPendingRequest && event.createdAt) {
      const minutesFromDayStart = differenceInMinutes(event.createdAt, dayStart)
      return {
        top: Math.max(0, minutesFromDayStart * MINUTE_HEIGHT),
        height: 'auto' as const,
        isPending: true,
      }
    }

    // Limita o início e fim do evento ao dia atual
    let eventStart = max([event.start, dayStart])
    let eventEnd = min([event.end, dayEnd])

    // CORREÇÃO: Se o evento termina à meia-noite do dia seguinte (00:00:00),
    // e estamos visualizando o dia de início, o evento deve ocupar todo o dia (24 horas).
    // Isso acontece quando:
    // - event.end está no dia seguinte à meia-noite
    // - event.start está neste dia ou antes
    const eventEndsAtNextDayMidnight =
      !isSameDay(event.end, date) &&
      event.end.getHours() === 0 &&
      event.end.getMinutes() === 0 &&
      event.end.getSeconds() === 0 &&
      event.end.getMilliseconds() === 0

    if (eventEndsAtNextDayMidnight && event.start <= dayEnd) {
      // Evento termina à meia-noite do dia seguinte e começa neste dia ou antes
      // Deve ocupar todo este dia (até 23:59:59.999)
      eventEnd = dayEnd
    }

    // Calcula a posição dentro do dia (0-1439 minutos)
    const minutesFromDayStart = differenceInMinutes(eventStart, dayStart)
    const duration = differenceInMinutes(eventEnd, eventStart)

    // Se a duração for 0 ou negativa após os ajustes, garante altura mínima
    // Mas se o evento realmente termina à meia-noite deste dia e começa antes,
    // não deveria aparecer (será filtrado antes)
    const finalDuration = Math.max(duration, 0)

    // Limita a altura máxima a 24 horas (1440 minutos)
    const maxHeight = 1440 * MINUTE_HEIGHT
    const calculatedHeight = finalDuration * MINUTE_HEIGHT

    return {
      top: Math.max(0, minutesFromDayStart * MINUTE_HEIGHT),
      height: Math.min(Math.max(calculatedHeight, 30), maxHeight),
      isPending: false,
    }
  }

  return (
    <div
      className={`flex bg-white min-h-[500px] ${fixedColumnWidth ? 'relative' : ''}`}
    >
      {/* Coluna de Horas */}
      <div
        className={`w-16 shrink-0 border-r border-slate-200 bg-slate-50 ${fixedColumnWidth ? 'sticky left-0 z-30' : ''}`}
      >
        <div
          className={`h-12 border-b border-slate-200 ${fixedColumnWidth ? 'sticky top-0 z-40 bg-slate-50' : ''}`}
        />{' '}
        {/* Espaço para header */}
        {HOURS.map((hour) => (
          <div key={hour} className="h-[60px] relative">
            {hour !== 0 && (
              <div className="absolute -top-2.5 right-1 text-xs text-gray-600 bg-slate-50 px-1">
                {format(
                  setMinutes(setHours(startOfToday(), hour), 0),
                  'HH:mm',
                  {
                    locale: ptBR,
                  }
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Colunas de Recursos */}
      {fixedColumnWidth ? (
        <div className="flex-1 overflow-x-auto overflow-y-visible">
          <div className="flex min-w-max">
            {resourceColumns.map((resource, index) => (
              <div
                key={resource.id}
                className={`w-[200px] shrink-0 ${index < resourceColumns.length - 1 ? 'border-r border-slate-200' : ''}`}
              >
                {/* Header do Recurso */}
                <div
                  className="peer h-12 flex items-center justify-center border-b border-slate-200 bg-slate-50 sticky top-0 z-20 cursor-pointer hover:bg-orange-50 transition-colors group px-2"
                  onClick={() => {
                    const columnEvents = timeGridEvents.filter(
                      (event) =>
                        !hasResources || event.resourceId === resource.id
                    )
                    onColumnClick?.(resource.id, resource.name, columnEvents)
                  }}
                >
                  <span
                    className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors truncate w-full text-center"
                    title={resource.name}
                  >
                    {resource.name}
                  </span>
                </div>

                {/* Seção All-Day (apenas na primeira coluna) */}
                {index === 0 && (
                  <AllDaySection
                    date={date}
                    events={allDayEvents}
                    onEventClick={onEventClick}
                  />
                )}

                {/* Grade de Horas */}
                <div
                  ref={(el) => {
                    if (el) columnRefs.current.set(resource.id, el)
                  }}
                  className={`relative h-[1440px] peer-hover:bg-orange-50/30 transition-colors`}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="h-[60px] border-b border-slate-100 transition-colors"
                    />
                  ))}

                  {/* Eventos do Time-Grid com Overlap Manager */}
                  {(() => {
                    const resourceEvents = timeGridEvents.filter(
                      (event) =>
                        !hasResources || event.resourceId === resource.id
                    )
                    const containerWidth = columnWidths.get(resource.id) || 200
                    const positions = calculateEventPositions(
                      resourceEvents,
                      date,
                      containerWidth
                    )

                    return positions.map((pos) => {
                      const position = getEventPosition(pos.event)
                      return (
                        <EventBlock
                          key={pos.event.id}
                          event={pos.event}
                          style={{
                            ...position,
                            left: pos.left,
                            width: pos.width,
                          }}
                          onClick={onEventClick}
                        />
                      )
                    })
                  })()}

                  {/* Linha do Tempo Atual */}
                  {isSameDay(currentTime, date) && (
                    <TimeIndicator
                      currentTime={currentTime}
                      hourSlotHeight={HOUR_SLOT_HEIGHT}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex">
          {resourceColumns.map((resource, index) => (
            <div
              key={resource.id}
              className={`flex-1 ${index < resourceColumns.length - 1 ? 'border-r border-slate-200' : ''}`}
            >
              {/* Header do Recurso */}
              <div
                className="peer h-12 flex items-center justify-center border-b border-slate-200 bg-slate-50 sticky top-0 z-20 cursor-pointer hover:bg-orange-50 transition-colors group"
                onClick={() => {
                  const columnEvents = timeGridEvents.filter(
                    (event) => !hasResources || event.resourceId === resource.id
                  )
                  onColumnClick?.(resource.id, resource.name, columnEvents)
                }}
              >
                <span className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                  {resource.name}
                </span>
              </div>

              {/* Seção All-Day (apenas na primeira coluna) */}
              {index === 0 && (
                <AllDaySection
                  date={date}
                  events={allDayEvents}
                  onEventClick={onEventClick}
                />
              )}

              {/* Grade de Horas */}
              <div
                ref={(el) => {
                  if (el) columnRefs.current.set(resource.id, el)
                }}
                className={`relative h-[1440px] peer-hover:bg-orange-50/30 transition-colors`}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-slate-100 transition-colors"
                  />
                ))}

                {/* Eventos do Time-Grid com Overlap Manager */}
                {(() => {
                  const resourceEvents = timeGridEvents.filter(
                    (event) => !hasResources || event.resourceId === resource.id
                  )
                  const containerWidth = columnWidths.get(resource.id) || 200
                  const positions = calculateEventPositions(
                    resourceEvents,
                    date,
                    containerWidth
                  )

                  return positions.map((pos) => {
                    const position = getEventPosition(pos.event)
                    return (
                      <EventBlock
                        key={pos.event.id}
                        event={pos.event}
                        style={{
                          ...position,
                          left: pos.left,
                          width: pos.width,
                        }}
                        onClick={onEventClick}
                      />
                    )
                  })
                })()}

                {/* Linha do Tempo Atual */}
                {isSameDay(currentTime, date) && (
                  <TimeIndicator
                    currentTime={currentTime}
                    hourSlotHeight={HOUR_SLOT_HEIGHT}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
