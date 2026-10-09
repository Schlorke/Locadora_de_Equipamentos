import { useState } from 'react'
import { View } from 'react-native'
import { Button, Card } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import type { useFinancialDataModel } from '../model/carga'
import {
  financialCalendarDays,
  moveFinancialCalendar,
  financialEventsOnDay,
  type FinancialCalendarView,
} from '../model/calendar'
import { formatFinancialDate } from '../model/display'
import { formatCurrency } from '../../../shared/lib/formatting'
import { statusLabel, type BillingStatus } from '../model/tipos'
import {
  FinancialChoices,
  FinancialSection,
  FinancialText,
} from './parts.native'
export function FinancialCalendar({
  events,
  onSelect,
}: {
  events: ReturnType<typeof useFinancialDataModel>['calendarEvents']
  onSelect(id: string): void
}) {
  const [date, setDate] = useState(() => new Date()),
    [view, setView] = useState<FinancialCalendarView>('monthly')
  return (
    <FinancialSection title="Calendário Financeiro">
      <FinancialChoices<FinancialCalendarView>
        value={view}
        options={[
          ['daily', 'Diário'],
          ['weekly', 'Semanal'],
          ['monthly', 'Mensal'],
        ]}
        onChange={setView}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          variant="outline"
          aria-label="Período anterior"
          onClick={() => setDate((d) => moveFinancialCalendar(d, view, -1))}
        >
          Anterior
        </Button>
        <Button variant="outline" onClick={() => setDate(new Date())}>
          Hoje
        </Button>
        <Button
          variant="outline"
          aria-label="Próximo período"
          onClick={() => setDate((d) => moveFinancialCalendar(d, view, 1))}
        >
          Próximo
        </Button>
      </View>
      {financialCalendarDays(date, view).map((day) => (
        <Card key={day.toISOString()}>
          <FinancialText>
            {formatFinancialDate(day.toISOString())}
          </FinancialText>
          {financialEventsOnDay(events, day).map((event) => (
            <View
              key={event.id}
              style={{ gap: space.sm, paddingVertical: space.sm }}
            >
              <FinancialText>
                {event.title} ·{' '}
                {statusLabel[event.status as BillingStatus] || event.status} ·{' '}
                {formatCurrency(Number(event.metadata?.amount ?? 0))}
              </FinancialText>
              <Button
                variant="outline"
                aria-label={'Exibir lançamento ' + event.id}
                onClick={() => onSelect(event.id)}
              >
                Exibir lançamento
              </Button>
            </View>
          ))}
          {!financialEventsOnDay(events, day).length ? (
            <FinancialText>Nenhum lançamento neste dia</FinancialText>
          ) : null}
        </Card>
      ))}
    </FinancialSection>
  )
}
