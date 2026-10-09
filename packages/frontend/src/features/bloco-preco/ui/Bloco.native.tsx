import { Text, View } from 'react-native'
import { useTheme } from '@gb-locacoes/ui'
import { space, typography, semanticThemes } from '@gb-locacoes/design-tokens'
import { formatCurrency } from '../../../shared/lib/moeda'
import type { EquipmentQuotePriceBlockProps } from './contract'
export function EquipmentQuotePriceBlock({
  equipmentName,
  originalPrice,
  finalPrice,
  variant,
  contentBeforeFinalPrice,
}: EquipmentQuotePriceBlockProps) {
  const theme = useTheme()
  return (
    <View style={{ gap: space.xs }}>
      <Text
        style={{ color: theme.text, fontWeight: typography.weight.semibold }}
      >
        {equipmentName}
      </Text>
      {variant.kind !== 'simple' ? (
        <Text
          style={{ color: theme.textMuted, textDecorationLine: 'line-through' }}
        >
          Preço original: {formatCurrency(originalPrice)}
        </Text>
      ) : null}
      {variant.kind === 'discount' ? (
        <>
          <Text style={{ color: theme.primary }}>
            {variant.periodLabel}: -{variant.appliedDiscount}%
          </Text>
          <Text style={{ color: theme.primary }}>
            -{formatCurrency(variant.discountAmount)}
          </Text>
        </>
      ) : null}
      {contentBeforeFinalPrice}
      <Text
        style={{
          color: semanticThemes.light.feedback.success,
          fontWeight: typography.weight.bold,
        }}
      >
        {variant.kind === 'direct' ? 'Valor direto:' : 'Preço final:'}{' '}
        {formatCurrency(
          variant.kind === 'direct' ? variant.directValue : finalPrice
        )}
      </Text>
    </View>
  )
}
