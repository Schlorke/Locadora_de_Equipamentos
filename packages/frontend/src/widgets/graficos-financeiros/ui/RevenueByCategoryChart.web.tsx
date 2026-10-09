'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gb-locacoes/ui'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'

interface RevenueByCategoryChartProps {
  data: Array<{
    categoryName: string
    revenue: number
  }>
  expanded?: boolean
}

const colors = [
  '#3b82f6', // blue-500 // token-check-allow: valor visual original do gráfico financeiro
  '#22c55e', // green-500 // token-check-allow: valor visual original do gráfico financeiro
  '#f59e0b', // amber-500 // token-check-allow: valor visual original do gráfico financeiro
  '#8b5cf6', // purple-500 // token-check-allow: valor visual original do gráfico financeiro
  '#06b6d4', // cyan-500 // token-check-allow: valor visual original do gráfico financeiro
  '#ec4899', // pink-500 // token-check-allow: valor visual original do gráfico financeiro
]

export function RevenueByCategoryChart({
  data,
  expanded,
}: RevenueByCategoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[280px] md:h-[320px]'} flex items-center justify-center text-gray-400`}
      >
        Sem dados disponíveis
      </div>
    )
  }

  // Ordenar por receita (maior para menor)
  const sortedData = [...data].sort((a, b) => b.revenue - a.revenue)

  return (
    <ChartContainer
      config={sortedData.reduce(
        (acc, item, index) => ({
          ...acc,
          [item.categoryName]: {
            label: item.categoryName,
            color: colors[index % colors.length],
          },
        }),
        {}
      )}
      className={`overflow-hidden ${expanded ? 'h-[320px] lg:h-[460px] w-full' : 'h-[280px] md:h-[320px]'}`}
    >
      <BarChart data={sortedData} layout="vertical">
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis
          dataKey="categoryName"
          type="category"
          width={120}
          tickLine={false}
          axisLine={false}
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
        <Bar dataKey="revenue" radius={[0, 8, 8, 0]}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
