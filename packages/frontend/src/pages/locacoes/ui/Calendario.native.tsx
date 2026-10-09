import { useState } from 'react'
import { View, Text } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type { Rental } from '../model/contracts'
import { rentalStatusLabels } from '../model/contracts'
import { formatCurrency, formatDate } from '../model/formatters'
import {
  rentalCalendarDays,
  rentalsOnDay,
  moveRentalCalendar,
  type RentalCalendarView,
} from '../model/calendar'
export function RentalCalendar({
  rentals,
  onSelect,
}: {
  rentals: Rental[]
  onSelect: (rental: Rental) => void
}) {
  const [date, setDate] = useState(() => new Date()),
    [view, setView] = useState<RentalCalendarView>('weekly'),
    theme = useTheme()
  const days = rentalCalendarDays(date, view),
    text = { color: theme.text }
  return (
    <View style={{ gap: space.md }}>
      <Text
        accessibilityRole="header"
        style={{ ...text, fontSize: typography.size.lg }}
      >
        Calendário de Locações
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(
          [
            ['daily', 'Diário'],
            ['weekly', 'Semanal'],
            ['monthly', 'Mensal'],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            variant={view === mode ? 'default' : 'outline'}
            aria-label={label}
            onClick={() => setView(mode)}
          >
            {label}
          </Button>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button
          variant="outline"
          aria-label="Período anterior"
          onClick={() => setDate((d) => moveRentalCalendar(d, view, -1))}
        >
          Anterior
        </Button>
        <Button variant="outline" onClick={() => setDate(new Date())}>
          Hoje
        </Button>
        <Button
          variant="outline"
          aria-label="Próximo período"
          onClick={() => setDate((d) => moveRentalCalendar(d, view, 1))}
        >
          Próximo
        </Button>
      </View>
      <Text style={text}>
        {formatDate(days[0]!.toISOString())} —{' '}
        {formatDate(days.at(-1)!.toISOString())}
      </Text>
      {days.map((day) => {
        const entries = rentalsOnDay(rentals, day)
        return (
          <Card key={day.toISOString()}>
            <Text accessibilityRole="header" style={text}>
              {formatDate(day.toISOString())}
            </Text>
            {entries.length === 0 ? (
              <Text style={{ color: theme.textMuted }}>
                Nenhuma locação neste dia
              </Text>
            ) : (
              entries.map((rental) => (
                <View
                  key={rental.id}
                  style={{ gap: space.sm, paddingVertical: space.sm }}
                >
                  <Text style={text}>
                    {rental.users.name || 'Sem nome'} —{' '}
                    {rentalStatusLabels[rental.status] || rental.status}
                  </Text>
                  <Text style={text}>
                    {rental.rental_items
                      .map((item) => item.equipments.name)
                      .join(', ')}
                  </Text>
                  <Text style={text}>{formatCurrency(rental.total)}</Text>
                  <Button
                    variant="outline"
                    aria-label={
                      'Exibir ' +
                      rental.id +
                      ' em ' +
                      formatDate(day.toISOString())
                    }
                    onClick={() => onSelect(rental)}
                  >
                    Exibir locação
                  </Button>
                </View>
              ))
            )}
          </Card>
        )
      })}
    </View>
  )
}
