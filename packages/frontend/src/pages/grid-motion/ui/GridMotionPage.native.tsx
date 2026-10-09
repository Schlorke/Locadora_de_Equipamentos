import { View, Text } from 'react-native'
import {
  AndaimeSuspenso,
  AndaimeTubular,
  Betoneira,
  CadeiraEletrica,
  Compressor,
  GridMotion,
  Lavagem,
  Rompedor,
  Terraplenagem,
  TrabalhoEmAltura,
  Transporte,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { gridItems } from '../model/items'
const icons = {
  AndaimeSuspenso,
  AndaimeTubular,
  Betoneira,
  CadeiraEletrica,
  Compressor,
  Lavagem,
  Rompedor,
  Terraplenagem,
  TrabalhoEmAltura,
  Transporte,
}
export function GridMotionPage() {
  const theme = useTheme()
  const items = gridItems.map((item, index) => {
    if (typeof item === 'string') return item
    const Icon = icons[item.icon]
    return (
      <View key={index} style={{ alignItems: 'center', gap: space.sm }}>
        <Icon size={space.xxl} color={item.color} />
        <Text style={{ color: theme.text, fontSize: typography.size.sm }}>
          {item.label}
        </Text>
      </View>
    )
  })
  return (
    <View style={{ flex: 1 }}>
      <GridMotion items={items} gradientColor={theme.secondary} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '45%',
          alignSelf: 'center',
          padding: space.lg,
          backgroundColor: theme.surface,
          borderRadius: space.md,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.semibold,
          }}
        >
          {PLATFORM.displayName}
        </Text>
        <Text style={{ color: theme.textMuted }}>
          Arraste para mover a grade
        </Text>
      </View>
    </View>
  )
}
