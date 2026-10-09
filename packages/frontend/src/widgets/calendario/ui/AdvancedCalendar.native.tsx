import { useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type { AdvancedCalendarProps } from '../model/contract'
import type { ViewMode } from './types'
import { calendarDays, navigateCalendar, eventsForDay } from '../model/interval'
export function AdvancedCalendar({
  events,
  resources,
  onEventClick,
  onDateClick,
  defaultViewMode = 'weekly',
  defaultDate,
}: AdvancedCalendarProps) {
  const theme = useTheme(),
    [view, setView] = useState<ViewMode>(defaultViewMode),
    [date, setDate] = useState(() => defaultDate ?? new Date())
  const days = calendarDays(date, view),
    groups = resources?.length
      ? resources
      : [{ id: 'default', name: 'Eventos' }]
  const text = (label: string) => (
    <Text style={{ color: theme.text }}>{label}</Text>
  )
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(
          [
            ['daily', 'Diário'],
            ['weekly', 'Semanal'],
            ['monthly', 'Mensal'],
            ['timeline', 'Linha do tempo'],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            variant={view === mode ? 'default' : 'outline'}
            onClick={() => setView(mode)}
          >
            {label}
          </Button>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          variant="outline"
          aria-label="Período anterior"
          onClick={() => setDate((d) => navigateCalendar(d, view, -1))}
        >
          Anterior
        </Button>
        <Button variant="outline" onClick={() => setDate(new Date())}>
          Hoje
        </Button>
        <Button
          variant="outline"
          aria-label="Próximo período"
          onClick={() => setDate((d) => navigateCalendar(d, view, 1))}
        >
          Próximo
        </Button>
      </View>
      {text(
        days[0]!.toLocaleDateString('pt-BR') +
          ' — ' +
          days[days.length - 1]!.toLocaleDateString('pt-BR')
      )}
      <ScrollView horizontal>
        <View style={{ gap: space.sm }}>
          {groups.map((resource) => (
            <View key={resource.id} style={{ gap: space.sm }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: theme.text,
                  fontWeight: typography.weight.bold,
                }}
              >
                {resource.name}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space.sm,
                }}
              >
                {days.map((day) => {
                  const daily = eventsForDay(events, day).filter(
                    (event) =>
                      resource.id === 'default' ||
                      event.resourceId === resource.id
                  )
                  return (
                    <View
                      key={day.toISOString()}
                      style={{ width: space.xxl * 6, gap: space.sm }}
                    >
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDate(day)
                          onDateClick?.(day)
                        }}
                      >
                        {day.toLocaleDateString('pt-BR')}
                      </Button>
                      {daily.map((event) => (
                        <Card key={event.id}>
                          <View style={{ gap: space.sm }}>
                            {text(event.title)}
                            {text(
                              event.start.toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) +
                                ' — ' +
                                event.end.toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                            )}
                            {text(event.status)}
                            <Button
                              variant="outline"
                              aria-label={'Exibir evento ' + event.id}
                              onClick={() => onEventClick?.(event)}
                            >
                              Exibir evento
                            </Button>
                          </View>
                        </Card>
                      ))}
                      {!daily.length ? text('Nenhum evento') : null}
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
