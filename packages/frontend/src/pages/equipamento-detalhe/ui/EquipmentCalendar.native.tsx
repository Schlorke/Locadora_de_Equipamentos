import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTheme,
} from '@gb-locacoes/ui'
import { radius, space, typography } from '@gb-locacoes/design-tokens'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { EquipmentDateRange } from '../model/use-equipment-pricing'

const monthNames = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2026, i, 1), 'MMMM', { locale: ptBR })
)
const monthNumber = (d: Date) => d.getFullYear() * 12 + d.getMonth()
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** Seleção de datas da locação; preço e contagem permanecem no modelo comum. */
export function EquipmentCalendar({
  selected,
  onSelect,
  disabled,
  min,
  max,
}: {
  selected?: EquipmentDateRange
  onSelect(range: EquipmentDateRange): void
  disabled(date: Date): boolean
  min: Date
  max: Date
}) {
  const [month, setMonth] = useState(() => selected?.from ?? min)
  const theme = useTheme()
  const current = monthNumber(month)
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const length = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate()
  const years = Array.from(
    { length: max.getFullYear() - min.getFullYear() + 1 },
    (_, i) => min.getFullYear() + i
  )
  const changeMonth = (year: number, index: number) => {
    const date = new Date(year, index, 1)
    const bounded = Math.max(
      monthNumber(min),
      Math.min(monthNumber(max), monthNumber(date))
    )
    setMonth(new Date(Math.floor(bounded / 12), bounded % 12, 1))
  }
  const select = (date: Date) => {
    if (disabled(date)) return
    const from = selected?.from
    if (!from || (selected?.to && !sameDay(from, selected.to)))
      onSelect({ from: date, to: date })
    else if (date < from) onSelect({ from: date, to: from })
    else onSelect({ from, to: date })
  }
  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Button
          variant="outline"
          aria-label="Mês anterior"
          disabled={current <= monthNumber(min)}
          onClick={() => changeMonth(month.getFullYear(), month.getMonth() - 1)}
        >
          ‹
        </Button>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: theme.text,
            fontWeight: typography.weight.bold,
          }}
        >
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </Text>
        <Button
          variant="outline"
          aria-label="Próximo mês"
          disabled={current >= monthNumber(max)}
          onClick={() => changeMonth(month.getFullYear(), month.getMonth() + 1)}
        >
          ›
        </Button>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text }}>Mês</Text>
          <Select
            value={String(month.getMonth())}
            onValueChange={(value) =>
              changeMonth(month.getFullYear(), Number(value))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((name, i) => (
                <SelectItem
                  key={i}
                  value={String(i)}
                  disabled={
                    month.getFullYear() * 12 + i < monthNumber(min) ||
                    month.getFullYear() * 12 + i > monthNumber(max)
                  }
                >
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text }}>Ano</Text>
          <Select
            value={String(month.getFullYear())}
            onValueChange={(value) =>
              changeMonth(Number(value), month.getMonth())
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
          <Text
            key={day}
            style={{
              width: '14.285714%',
              textAlign: 'center',
              paddingVertical: space.sm,
              color: theme.textMuted,
            }}
          >
            {day}
          </Text>
        ))}
        {Array.from({ length: first.getDay() }, (_, i) => (
          <View key={`empty-${i}`} style={{ width: '14.285714%' }} />
        ))}
        {Array.from({ length }, (_, i) => {
          const date = new Date(month.getFullYear(), month.getMonth(), i + 1)
          const isDisabled = disabled(date)
          const chosen =
            !!selected?.from &&
            (sameDay(selected.from, date) ||
              (!!selected.to && date >= selected.from && date <= selected.to))
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={format(date, 'dd/MM/yyyy')}
              accessibilityState={{ disabled: isDisabled, selected: chosen }}
              disabled={isDisabled}
              onPress={() => select(date)}
              style={{
                width: '14.285714%',
                paddingVertical: space.md,
                borderRadius: radius.sm,
                backgroundColor: chosen ? theme.primary : theme.surface,
                opacity: isDisabled ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  color: chosen ? theme.onPrimary : theme.text,
                }}
              >
                {i + 1}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
