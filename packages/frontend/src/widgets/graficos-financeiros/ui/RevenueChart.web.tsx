'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gb-locacoes/ui'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import { semanticThemes } from '@gb-locacoes/design-tokens'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
  }>
  expanded?: boolean
}

export function RevenueChart({ data, expanded }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[280px] md:h-[320px]'} flex items-center justify-center text-gray-400`}
      >
        Sem dados disponíveis
      </div>
    )
  }

  return (
    <ChartContainer
      config={{
        revenue: {
          label: 'Receita',
          color: semanticThemes.light.brand.default,
        },
      }}
      className={`overflow-hidden ${expanded ? 'h-[320px] lg:h-[460px] w-full' : 'h-[280px] md:h-[320px]'}`}
    >
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={semanticThemes.light.brand.default}
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor={semanticThemes.light.brand.vivid}
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={45}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [
                `R$ ${Number(value).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`,
                'Receita',
              ]}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#ea580c" // token-check-allow: valor visual original do gráfico financeiro
          strokeWidth={2}
          fill="url(#colorRevenue)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
