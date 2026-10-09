import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button, Dialog, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
export function LossDateCalendar({
  selected,
  onSelect,
  disabled,
  onClose,
}: {
  selected: Date | null
  onSelect: (date: Date) => void
  disabled: (date: Date) => boolean
  onClose: () => void
}) {
  const [month, setMonth] = useState(
      () =>
        new Date(
          (selected || new Date()).getFullYear(),
          (selected || new Date()).getMonth(),
          1
        )
    ),
    theme = useTheme()
  const shift = (amount: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1))
  const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate(),
    offset = month.getDay()
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Data da perda</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <View style={{ gap: space.sm }}>
                <Button variant="outline" onClick={() => shift(-1)}>
                  Mês Anterior
                </Button>
                <Text style={{ color: theme.text }}>
                  {month.toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <Button variant="outline" onClick={() => shift(1)}>
                  Próximo Mês
                </Button>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: space.xs,
                  }}
                >
                  {Array.from({ length: offset }, (_, i) => (
                    <View key={'empty-' + i} style={{ width: '12%' }} />
                  ))}
                  {Array.from({ length: count }, (_, i) => {
                    const date = new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        i + 1
                      ),
                      active = selected?.toDateString() === date.toDateString()
                    return (
                      <View key={i} style={{ width: '12%' }}>
                        <Button
                          variant={active ? 'default' : 'outline'}
                          disabled={disabled(date)}
                          aria-label={date.toLocaleDateString('pt-BR')}
                          onClick={() => onSelect(date)}
                        >
                          {i + 1}
                        </Button>
                      </View>
                    )
                  })}
                </View>
              </View>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Fechar Calendário
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
