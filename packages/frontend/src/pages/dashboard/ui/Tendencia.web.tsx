'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gb-locacoes/ui'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'

const CHART_COLORS = {
  orange: '#ea580c', // token-check-allow: laranja da tendência de orçamentos
  orangeLight: '#f97316', // token-check-allow: laranja da tendência de orçamentos
}

interface QuotesTrendItem {
  date: string
  fullDate: string
  count: number
}

interface QuotesTrendChartProps {
  data: QuotesTrendItem[]
  expanded?: boolean
}

export function QuotesTrendChart({ data, expanded }: QuotesTrendChartProps) {
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
        count: {
          label: 'Orçamentos',
          color: CHART_COLORS.orange,
        },
      }}
      className={`overflow-hidden ${expanded ? 'h-[320px] lg:h-[460px] w-full' : 'h-[280px] md:h-[320px]'}`}
    >
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={CHART_COLORS.orange}
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor={CHART_COLORS.orangeLight}
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value} orçamentos`, 'Orçamentos']}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={CHART_COLORS.orange}
          strokeWidth={2}
          fill="url(#colorCount)"
        />
      </AreaChart>
    </ChartContainer>
  )
}
