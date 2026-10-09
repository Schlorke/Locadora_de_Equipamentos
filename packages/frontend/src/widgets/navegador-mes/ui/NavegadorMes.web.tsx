'use client'

import { Button } from '@gb-locacoes/ui'
import { FILTER_CARD } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import {
  format,
  startOfMonth,
  addYears,
  subYears,
  isSameMonth,
  setMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'

interface KanbanMonthNavigatorProps {
  selectedDate: Date
  onDateChange: (_date: Date) => void
  itemCountsByMonth?: Record<string, number>
  className?: string
}

export function KanbanMonthNavigator({
  selectedDate,
  onDateChange,
  itemCountsByMonth = {},
  className,
}: KanbanMonthNavigatorProps) {
  const displayYear = selectedDate.getFullYear()

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      startOfMonth(setMonth(new Date(displayYear, 0, 1), i))
    )
  }, [displayYear])

  const activeIndex = months.findIndex((m) => isSameMonth(m, selectedDate))

  const getCountForMonth = useCallback(
    (monthDate: Date) => {
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
      return itemCountsByMonth[key] || 0
    },
    [itemCountsByMonth]
  )

  // Slider animation (ViewToggle pattern)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [sliderStyle, setSliderStyle] = useState({ width: 0, left: 0 })

  const updateSliderPosition = useCallback(() => {
    if (activeIndex === -1 || !containerRef.current) return

    const activeButton = buttonRefs.current[activeIndex]
    if (!activeButton) return

    // Usar offsetLeft/offsetWidth — valores relativos ao conteúdo do container,
    // independente de scroll ou posição na viewport.
    setSliderStyle({
      width: activeButton.offsetWidth,
      left: activeButton.offsetLeft,
    })
  }, [activeIndex])

  useEffect(() => {
    // requestAnimationFrame garante que o layout já foi calculado após re-render
    const frameId = requestAnimationFrame(() => {
      updateSliderPosition()
    })
    return () => cancelAnimationFrame(frameId)
  }, [updateSliderPosition, selectedDate, months])

  useEffect(() => {
    window.addEventListener('resize', updateSliderPosition)
    return () => window.removeEventListener('resize', updateSliderPosition)
  }, [updateSliderPosition])

  // Auto-scroll active month into view on mobile
  useEffect(() => {
    if (activeIndex === -1) return
    const activeButton = buttonRefs.current[activeIndex]
    activeButton?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeIndex])

  const handlePrevYear = () =>
    onDateChange(startOfMonth(subYears(selectedDate, 1)))
  const handleNextYear = () =>
    onDateChange(startOfMonth(addYears(selectedDate, 1)))
  const handleToday = () => onDateChange(startOfMonth(new Date()))
  const handleSelectMonth = (monthDate: Date) =>
    onDateChange(startOfMonth(monthDate))

  const isCurrentMonth = isSameMonth(selectedDate, new Date())

  const headerClasses = cn(
    'relative flex shrink-0 items-center gap-3 p-4 md:p-6 rounded-t-lg overflow-hidden',
    // Gradiente laranja identidade visual — from/orange-500 via/orange-600 to/orange-700
    'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700',
    // Camada de profundidade sutil (padrão sobre/cta-section)
    "before:absolute before:inset-0 before:content-[''] before:bg-gradient-to-tr before:from-transparent before:via-orange-400/10 before:to-orange-800/15 before:pointer-events-none",
    // Highlight superior refinado
    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]',
    // Transição suave para conteúdo abaixo
    'border-b border-orange-800/25'
  )

  return (
    <div
      className={cn(
        FILTER_CARD,
        'rounded-lg text-card-foreground overflow-visible border-0 bg-white backdrop-blur-sm transition-all duration-300',
        className
      )}
    >
      {/* Gradientes de profundidade (igual AdminFilterCard) */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40" />

      {/* Header estilo dialog: Year nav + Hoje — bg laranja identidade visual */}
      <div className={cn(headerClasses, 'relative z-10')} role="banner">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevYear}
              className="h-8 w-8 p-0 text-white/90 hover:text-white hover:bg-white/15 transition-colors duration-200"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={4} />
            </Button>
            <span className="font-extrabold text-base text-white min-w-[3.5rem] text-center tabular-nums drop-shadow-sm">
              {displayYear}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextYear}
              className="h-8 w-8 p-0 text-white/90 hover:text-white hover:bg-white/15 transition-colors duration-200"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={4} />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            disabled={isCurrentMonth}
            className={cn(
              'relative z-10 h-8 md:h-10 font-semibold text-sm gap-1.5 border-gray-200 bg-white shadow-sm disabled:opacity-100 ',
              isCurrentMonth
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:text-orange-600'
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Hoje
          </Button>
        </div>
      </div>

      <div className="relative z-10 p-4 sm:p-6">
        {/* Month pills strip */}
        <div
          ref={containerRef}
          className="relative flex items-center gap-0.5 overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory"
        >
          {/* Animated slider pill */}
          {sliderStyle.width > 0 && (
            <motion.div
              className="absolute bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg z-0"
              initial={false}
              animate={{
                x: sliderStyle.left,
                width: sliderStyle.width,
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              style={{
                top: 0,
                left: 0,
                height: '100%',
              }}
            />
          )}

          {months.map((monthDate, index) => {
            const count = getCountForMonth(monthDate)
            const isActive = activeIndex === index
            const hasItems = count > 0

            return (
              <button
                key={index}
                ref={(el) => {
                  buttonRefs.current[index] = el
                }}
                onClick={() => handleSelectMonth(monthDate)}
                className={cn(
                  'relative z-10 flex flex-col items-center justify-center snap-center',
                  'px-2 sm:px-3 py-2 rounded-lg font-semibold text-[14px] md:text-[16px] transition-colors duration-200',
                  'flex-1 min-w-[2.5rem] sm:min-w-0 min-h-12',
                  isActive
                    ? 'text-white'
                    : hasItems
                      ? 'text-gray-600 hover:text-orange-600'
                      : 'text-gray-300 hover:text-gray-400'
                )}
              >
                <span className="capitalize leading-none">
                  {format(monthDate, 'MMM', { locale: ptBR })}
                </span>
                {count > 0 && (
                  <span
                    className={cn(
                      'text-sm md:text-[16px] leading-none mt-1 tabular-nums font-semibold',
                      isActive ? 'text-orange-100' : 'text-orange-500'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
