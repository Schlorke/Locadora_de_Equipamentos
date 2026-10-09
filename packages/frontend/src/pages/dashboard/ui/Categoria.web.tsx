'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@gb-locacoes/ui'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'

interface EquipmentByCategoryItem {
  categoryName: string
  count: number
  available: number
  categoryId: string
  bgColor: string
  fontColor: string
}

interface EquipmentByCategoryChartProps {
  data: EquipmentByCategoryItem[]
  defaultColor?: string
  expanded?: boolean
}

export function EquipmentByCategoryChart({
  data,
  defaultColor = '#3b82f6', // token-check-allow: azul padrão da categoria no gráfico
  expanded,
}: EquipmentByCategoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`${expanded ? 'h-[320px] lg:h-[460px]' : 'h-[400px]'} flex items-center justify-center text-gray-400`}
      >
        Sem dados disponíveis
      </div>
    )
  }

  const config = data.reduce<Record<string, { label: string; color: string }>>(
    (acc, item) => ({
      ...acc,
      [item.categoryName]: {
        label: item.categoryName,
        color: item.bgColor || defaultColor,
      },
    }),
    {}
  )

  return (
    <ChartContainer
      config={config}
      className={`overflow-hidden ${expanded ? 'h-[320px] lg:h-[460px] w-full' : 'h-[400px]'}`}
    >
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
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
              formatter={(value, name) => [`${value} equipamentos`, name]}
            />
          }
        />
        <Bar dataKey="count" radius={[0, 8, 8, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.bgColor || defaultColor} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
