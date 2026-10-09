import { Text, View } from 'react-native'
import { Button, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { formatCurrency } from '../../../shared/lib/moeda'
import { useEquipmentPeriod } from '../model/use-equipment-period'
import type { EquipmentPricingSelectorProps } from '../model/pricing-contract'

export function EquipmentPricingSelector(props: EquipmentPricingSelectorProps) {
  const m = useEquipmentPeriod(props)
  const theme = useTheme()
  const hasDate = props.startDate !== null && props.startDate !== undefined
  const days = props.selectedDays ?? 0
  const discount =
    days > 0 ? (m.pricingConfig?.discount ?? 0) : m.selectedPeriod.discount
  const periodDays = days > 0 ? days : m.selectedPeriod.multiplier
  return (
    <View style={{ gap: space.md }}>
      <Text
        accessibilityRole="header"
        style={{ color: theme.text, fontWeight: typography.weight.bold }}
      >
        Período de Locação
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {m.pricingOptions.map((option) => (
          <View key={option.id} style={{ gap: space.xs }}>
            <Button
              variant={
                m.selectedPeriod.id === option.id ? 'default' : 'outline'
              }
              disabled={hasDate || option.enabled === false}
              onClick={() => m.handlePeriodChange(option)}
            >
              {option.label}
            </Button>
            {option.enabled === false ? (
              <Text style={{ color: theme.textMuted }}>Indisponível</Text>
            ) : (
              <>
                {option.popular ? (
                  <Text style={{ color: theme.primary }}>Popular</Text>
                ) : null}
                {option.useDirectValue && option.directValue != null ? (
                  <Text style={{ color: theme.text }}>
                    {formatCurrency(option.directValue)}
                  </Text>
                ) : option.discount > 0 ? (
                  <Text style={{ color: theme.text }}>
                    {option.discount}% OFF
                  </Text>
                ) : null}
              </>
            )}
          </View>
        ))}
      </View>
      <Text style={{ color: theme.textMuted }}>
        Preço por{' '}
        {days > 0
          ? `${days} ${days === 1 ? 'dia' : 'dias'}`
          : m.selectedPeriod.period}
      </Text>
      {!m.isUsingDirectValue && discount > 0 ? (
        <Text style={{ color: theme.textMuted }}>
          De: {formatCurrency(m.originalPrice)} · {discount}% OFF
        </Text>
      ) : null}
      <Text
        style={{
          color: theme.primary,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        {formatCurrency(m.selectedPrice)}
      </Text>
      {!m.isUsingDirectValue && periodDays > 1 ? (
        <Text style={{ color: theme.text }}>
          {formatCurrency(m.selectedPrice / periodDays)} por dia
        </Text>
      ) : null}
      {!m.isUsingDirectValue && discount > 0 ? (
        <Text style={{ color: theme.text }}>
          Você economiza {formatCurrency(m.originalPrice - m.selectedPrice)} com
          este período!
        </Text>
      ) : null}
    </View>
  )
}
