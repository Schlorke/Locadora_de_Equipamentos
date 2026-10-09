import { Text, View } from 'react-native'
import {
  ChartContainer,
  ChartPlot,
  ChartTooltip,
  ChartTooltipContent,
  useTheme,
} from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'

export interface DashboardPoint {
  label: string
  value: number
}

/** A variante nativa usa o gráfico interativo e acessível do design system. */
export function DashboardPlot({
  points,
  series,
  formatValue,
}: {
  points: DashboardPoint[]
  series: string
  formatValue?: (value: number) => string
}) {
  const theme = useTheme()
  if (!points.length)
    return <Text style={{ color: theme.textMuted }}>Sem dados disponíveis</Text>
  return (
    <View style={{ gap: space.sm }}>
      <ChartContainer
        config={{ value: { label: series, color: theme.primary } }}
      >
        <ChartPlot data={points} series="value" />
        <ChartTooltip content={<ChartTooltipContent />} />
      </ChartContainer>
      {formatValue
        ? points.map((point, index) => (
            <Text key={point.label + '-' + index} style={{ color: theme.text }}>
              {point.label}: {formatValue(point.value)}
            </Text>
          ))
        : null}
    </View>
  )
}
