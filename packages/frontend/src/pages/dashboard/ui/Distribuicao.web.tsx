'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gb-locacoes/ui'
import { Cell, Legend, Pie, PieChart } from 'recharts'

interface StatusChartItem {
  name: string
  value: number
  color: string
}

interface StatusDistributionChartProps {
  data: StatusChartItem[]
  totalQuotes: number
  expanded?: boolean
}

export function StatusDistributionChart({
  data,
  totalQuotes,
  expanded,
}: StatusDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[280px] md:h-[320px]'} flex items-center justify-center text-gray-400`}
      >
        Sem dados disponíveis
      </div>
    )
  }

  const config = data.reduce<Record<string, { label: string; color: string }>>(
    (acc, item) => ({
      ...acc,
      [item.name]: {
        label: item.name,
        color: item.color,
      },
    }),
    {}
  )

  return (
    <div className="flex flex-col items-center flex-1 w-full">
      <ChartContainer
        config={config}
        className={`w-full ${expanded ? 'h-[280px] sm:h-[320px] lg:h-[460px]' : 'h-[220px] sm:h-[280px] md:h-[320px]'}`}
      >
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius="35%"
            outerRadius="60%"
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [`${value} orçamentos`, '']}
              />
            }
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => value}
            wrapperStyle={{
              fontSize:
                '12px' /* token-check-allow: tamanho da legenda do gráfico de status */,
            }}
          />
        </PieChart>
      </ChartContainer>
      <div className="mt-2 sm:mt-4 text-center">
        <p className="text-xl sm:text-2xl font-bold text-gray-900">
          {totalQuotes}
        </p>
        <p className="text-xs sm:text-sm text-gray-500">Total</p>
      </div>
    </div>
  )
}
