import { View, Text } from 'react-native'
import { Checkbox, Input, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import {
  deliveryChecklistItems,
  pickupChecklistItems,
} from '../model/checklist'
type Value = boolean | string | number
export function DeliveryChecklist({
  checklist,
  onChecklistChange,
  type,
}: {
  checklist: Record<string, Value>
  onChecklistChange(value: Record<string, Value>): void
  type: 'DELIVERY' | 'PICKUP'
}) {
  const theme = useTheme(),
    items = type === 'DELIVERY' ? deliveryChecklistItems : pickupChecklistItems
  const completed = items.filter((item) =>
    item.type === 'boolean'
      ? checklist[item.key] === true || checklist[item.key] === 'true'
      : checklist[item.key]
  ).length
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: theme.text }}>
        Checklist de {type === 'DELIVERY' ? 'Entrega' : 'Coleta'} · {completed}/
        {items.length} concluídos
      </Text>
      {items.map((item) => (
        <View key={item.key} style={{ gap: space.xs }}>
          <Text style={{ color: theme.text }}>
            {item.label}
            {item.required ? ' *' : ''}
          </Text>
          {item.type === 'boolean' ? (
            <Checkbox
              aria-label={item.label}
              checked={
                checklist[item.key] === true || checklist[item.key] === 'true'
              }
              onCheckedChange={(value) =>
                onChecklistChange({ ...checklist, [item.key]: value })
              }
            />
          ) : (
            <Input
              aria-label={item.label}
              value={
                item.type === 'number'
                  ? checklist[item.key]
                    ? String(Number(checklist[item.key]))
                    : ''
                  : String(checklist[item.key] || '')
              }
              onChangeText={(value) =>
                onChecklistChange({
                  ...checklist,
                  [item.key]:
                    item.type === 'number'
                      ? value
                        ? Number(value)
                        : ''
                      : value,
                })
              }
            />
          )}
        </View>
      ))}
    </View>
  )
}
