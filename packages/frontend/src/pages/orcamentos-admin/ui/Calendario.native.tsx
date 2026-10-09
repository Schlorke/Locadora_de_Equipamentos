import { useState } from 'react'
import { View } from 'react-native'
import { Button, Card } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { formatDate, type Quote } from '../../../entities/orcamento'
import { formatCurrency } from '../../../shared/lib/formatting'
import {
  quoteCalendarDays,
  quotesOnDay,
  moveQuoteCalendar,
  type QuoteCalendarView,
} from '../model/calendar'
import { QuoteSection, QuoteText, QuoteChoices } from './parts.native'
export function QuotesCalendarView({
  quotes,
  onSelect,
}: {
  quotes: Quote[]
  onSelect: (quote: Quote) => void
}) {
  const [date, setDate] = useState(() => new Date()),
    [view, setView] = useState<QuoteCalendarView>('weekly')
  const days = quoteCalendarDays(date, view)
  return (
    <QuoteSection title="Calendário de Orçamentos">
      <QuoteChoices
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
          onClick={() => setDate((d) => moveQuoteCalendar(d, view, -1))}
        >
          Anterior
        </Button>
        <Button variant="outline" onClick={() => setDate(new Date())}>
          Hoje
        </Button>
        <Button
          variant="outline"
          aria-label="Próximo período"
          onClick={() => setDate((d) => moveQuoteCalendar(d, view, 1))}
        >
          Próximo
        </Button>
      </View>
      {days.map((day) => (
        <Card key={day.toISOString()}>
          <QuoteText>{formatDate(day.toISOString())}</QuoteText>
          {quotesOnDay(quotes, day).map((q) => (
            <View
              key={q.id}
              style={{ gap: space.sm, paddingVertical: space.sm }}
            >
              <QuoteText>
                {q.name} · {q.status} · {formatCurrency(q.totalPrice)}
              </QuoteText>
              <Button
                variant="outline"
                aria-label={
                  'Exibir ' + q.id + ' em ' + formatDate(day.toISOString())
                }
                onClick={() => onSelect(q)}
              >
                Exibir orçamento
              </Button>
            </View>
          ))}
          {!quotesOnDay(quotes, day).length ? (
            <QuoteText>Nenhum orçamento neste dia</QuoteText>
          ) : null}
        </Card>
      ))}
    </QuoteSection>
  )
}
