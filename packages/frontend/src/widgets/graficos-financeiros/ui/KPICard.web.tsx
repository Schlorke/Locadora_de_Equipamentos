'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@gb-locacoes/ui'
import { primitives } from '@gb-locacoes/design-tokens'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

interface KPICardProps {
  title: string
  value: string | number
  trend: number // ex: 12 para 12%, -5 para -5%
  trendLabel: string
  sparklineData?: number[]
  icon?: React.ReactNode
  iconBg?: string
  iconColor?: string
  valueColor?: string
}

export function FinancialKPICard({
  title,
  value,
  trend,
  trendLabel,
  sparklineData = [],
  icon,
  iconBg = 'bg-orange-100',
  iconColor = 'text-orange-600',
  valueColor = 'text-gray-900',
}: KPICardProps) {
  const sparklineContainerRef = useRef<HTMLDivElement | null>(null)
  const [sparklineDimensions, setSparklineDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const isPositive = trend >= 0
  const formattedValue =
    typeof value === 'number'
      ? value.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : value

  // Preparar dados do sparkline
  const sparklineChartData =
    sparklineData.length > 0
      ? sparklineData.map((val, index) => ({
          value: val,
          index,
        }))
      : []

  useEffect(() => {
    if (sparklineChartData.length === 0) {
      setSparklineDimensions(null)
      return
    }

    const element = sparklineContainerRef.current
    if (!element) {
      setSparklineDimensions(null)
      return
    }

    let frame = 0
    let stabilityTimer: ReturnType<typeof setTimeout> | null = null

    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      const isValid = width > 0 && height > 0

      if (isValid) {
        // Aguarda estabilização antes de atualizar dimensões
        if (stabilityTimer) clearTimeout(stabilityTimer)
        stabilityTimer = setTimeout(() => {
          setSparklineDimensions({ width, height })
        }, 50)
      } else {
        // Se não é válido, limpa dimensões
        setSparklineDimensions(null)
      }
    }

    // Primeira medição com pequeno delay para garantir que o DOM esteja pronto
    const initialMeasure = setTimeout(measure, 10)

    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => {
        // Limpa dimensões durante resize
        setSparklineDimensions(null)
        cancelAnimationFrame(frame)
        frame = window.requestAnimationFrame(measure)
      }
      window.addEventListener('resize', onResize)
      return () => {
        setSparklineDimensions(null)
        if (stabilityTimer) clearTimeout(stabilityTimer)
        clearTimeout(initialMeasure)
        window.removeEventListener('resize', onResize)
        cancelAnimationFrame(frame)
      }
    }

    const observer = new ResizeObserver(() => {
      // Limpa dimensões durante resize
      setSparklineDimensions(null)
      cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    })
    observer.observe(element)

    return () => {
      setSparklineDimensions(null)
      if (stabilityTimer) clearTimeout(stabilityTimer)
      clearTimeout(initialMeasure)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [sparklineChartData.length])

  return (
    <Card className="relative overflow-hidden border border-gray-100 bg-gradient-to-br from-white via-white to-slate-50 text-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100/60 via-white to-slate-50/40"></div>
      <CardContent className="relative z-10 p-4 sm:p-5">
        <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
          {icon && (
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full flex items-center justify-center shadow-inner ${iconBg}`}
            >
              <div className={iconColor}>{icon}</div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-gray-500 leading-tight">
              {title}
            </p>
          </div>
        </div>
        <div className="mb-2 sm:mb-3">
          <p
            className={`text-sm sm:text-base lg:text-lg font-bold ${valueColor} truncate`}
          >
            {formattedValue}
          </p>
        </div>
        <div
          className={`flex items-center text-[11px] sm:text-xs mb-2 sm:mb-3 ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {isPositive ? (
            <ArrowUp className="h-4 w-4 mr-1" />
          ) : (
            <ArrowDown className="h-4 w-4 mr-1" />
          )}
          <span>
            {Math.abs(trend).toFixed(1)}% {trendLabel}
          </span>
        </div>
        {/* Sparkline Chart */}
        {sparklineChartData.length > 0 && (
          <div
            ref={sparklineContainerRef}
            className="h-[40px] w-full min-h-[40px] [&_svg]:outline-hidden [&:focus_svg]:outline-hidden [&:focus-visible_svg]:outline-hidden [&_svg[tabindex]]:outline-hidden [&:focus_svg[tabindex]]:outline-hidden [&_svg[tabindex]]:ring-0 [&_svg[tabindex]]:ring-offset-0 [&_svg[tabindex='0']]:outline-hidden [&:focus_svg[tabindex='0']]:outline-hidden [&:focus-visible_svg[tabindex='0']]:outline-hidden [&_path]:outline-hidden [&:focus_path]:outline-hidden [&:focus-visible_path]:outline-hidden [&_path.recharts-line-curve]:outline-hidden [&:focus_path.recharts-line-curve]:outline-hidden [&_circle]:outline-hidden [&:focus_circle]:outline-hidden [&:focus-visible_circle]:outline-hidden [&_circle.recharts-dot]:outline-hidden [&:focus_circle.recharts-dot]:outline-hidden [&_*]:outline-hidden [&:focus_*]:outline-hidden [&:focus-visible_*]:outline-hidden"
            style={{ minWidth: '100px' }}
          >
            {sparklineDimensions ? (
              <ResponsiveContainer
                width={sparklineDimensions.width}
                height={sparklineDimensions.height}
              >
                <LineChart
                  data={sparklineChartData}
                  margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                >
                  <YAxis
                    hide
                    domain={([dataMin, dataMax]) => {
                      const range = dataMax - dataMin
                      const padding =
                        range === 0
                          ? Math.max(1, Math.abs(dataMin || 0) * 0.01)
                          : range * 0.1
                      return [dataMin - padding, dataMax + padding]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={
                      isPositive
                        ? primitives.tailwind.green500
                        : primitives.tailwind.red500
                    }
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={true}
                    animationDuration={1000}
                  />
                  <Tooltip
                    contentStyle={{
                      display: 'none',
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div aria-hidden className="h-full w-full min-h-[40px]" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
