'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gb-locacoes/ui'
import { Bar, BarChart, Cell, XAxis, YAxis, Legend } from 'recharts'

interface AgingChartProps {
  data: Array<{
    range: string
    amount: number
    count: number
    status:
      | 'current'
      | 'slight'
      | 'moderate'
      | 'severe'
      | 'critical'
      | 'onTime'
      | 'slightDelay'
      | 'severeDelay'
  }>
  expanded?: boolean
}

const statusColors: Record<string, string> = {
  current: '#16A34A', // green-600 // token-check-allow: valor visual original do gráfico financeiro
  slight: '#D97706', // amber-600 // token-check-allow: valor visual original do gráfico financeiro
  moderate: '#EA580C', // orange-600 // token-check-allow: valor visual original do gráfico financeiro
  severe: '#DC2626', // red-600 // token-check-allow: valor visual original do gráfico financeiro
  critical: '#991B1B', // red-800 // token-check-allow: valor visual original do gráfico financeiro
  // Legacy compatibility
  onTime: '#16A34A', // token-check-allow: valor visual original do gráfico financeiro
  slightDelay: '#D97706', // token-check-allow: valor visual original do gráfico financeiro
  severeDelay: '#DC2626', // token-check-allow: valor visual original do gráfico financeiro
}

const statusLabels: Record<string, string> = {
  current: 'A vencer',
  slight: '1-30 dias',
  moderate: '31-60 dias',
  severe: '61-90 dias',
  critical: '+90 dias',
  onTime: 'Em Dia',
  slightDelay: 'Atraso Leve',
  severeDelay: 'Atraso Grave',
}

export function AgingChart({ data, expanded }: AgingChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[280px] md:h-[320px]'} flex items-center justify-center text-gray-400`}
      >
        Sem dados disponíveis
      </div>
    )
  }

  // Build chart data: each bar gets its own color based on status
  const chartData = data.map((item) => ({
    range: item.range,
    amount: item.amount,
    count: item.count,
    fill: statusColors[item.status] || '#94a3b8', // token-check-allow: valor visual original do gráfico financeiro
  }))

  // Collect unique statuses for the legend
  const uniqueStatuses = [...new Set(data.map((d) => d.status))]

  const chartConfig = Object.fromEntries(
    uniqueStatuses.map((status) => [
      statusLabels[status] || status,
      {
        label: statusLabels[status] || status,
        color: statusColors[status] || '#94a3b8', // token-check-allow: valor visual original do gráfico financeiro
      },
    ])
  )

  return (
    <div className="w-full flex items-center justify-center">
      <ChartContainer
        config={chartConfig}
        className={`overflow-hidden ${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[280px] md:h-[320px]'} w-full max-w-full`}
      >
        <BarChart data={chartData}>
          <XAxis
            dataKey="range"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, props) => {
                  const entry = props?.payload
                  return [
                    value
                      ? `R$ ${Number(value).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} (${entry?.count || 0} lanç.)`
                      : 'R$ 0,00',
                    entry?.range || '',
                  ]
                }}
              />
            }
          />
          <Legend
            content={() => (
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {uniqueStatuses.map((status) => (
                  <div
                    key={status}
                    className="flex items-center gap-1.5 text-xs text-gray-600"
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor: statusColors[status] || '#94a3b8', // token-check-allow: valor visual original do gráfico financeiro
                      }}
                    />
                    {statusLabels[status] || status}
                  </div>
                ))}
              </div>
            )}
          />
          <Bar
            dataKey="amount"
            radius={[4, 4, 0, 0]}
            fill="#94a3b8" // token-check-allow: valor visual original do gráfico financeiro
            isAnimationActive={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
