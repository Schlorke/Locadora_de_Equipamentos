'use client'

import { Calendar } from './Calendario.web'
import {
  FOCUS_RING,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import { format, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import * as React from 'react'
import { DateRange } from 'react-day-picker'
import { toast } from '../../../shared/lib'

export interface DateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  onDateChange: (_start: Date | null, _end: Date | null) => void
  unavailableDates?: Date[]
  minDate?: Date
  maxDate?: Date
  allowPastDates?: boolean
  minDays?: number
  maxDays?: number
  className?: string
  placeholder?: string
  disabled?: boolean
  showClearButton?: boolean
  /**
   * Quando true, exibe toasts guiadas para orientar o usuário na seleção de datas.
   * Toast 1: Ao abrir o calendário pela primeira vez (selecione data de início)
   * Toast 2: Após selecionar data de início (selecione data final)
   * Toast 3: Após selecionar ambas as datas (sucesso)
   */
  showGuidedToasts?: boolean
}

export function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  unavailableDates = [],
  minDate,
  maxDate,
  allowPastDates = false,
  minDays,
  maxDays,
  className,
  placeholder = 'Selecionar período',
  disabled = false,
  showClearButton = true,
  showGuidedToasts = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedRange, setSelectedRange] = React.useState<
    DateRange | undefined
  >(
    startDate
      ? {
          from: startDate,
          to: endDate ?? undefined,
        }
      : undefined
  )

  // Refs para controlar exibição das toasts - resetam a cada reload da página
  const hasShownFirstClickToast = React.useRef(false)
  const hasShownStartDateToast = React.useRef(false)
  const hasShownSuccessToast = React.useRef(false)
  const toastsCompleted = React.useRef(false)

  // Verifica se deve mostrar toasts (ciclo não foi completado ainda)
  const shouldShowToasts = React.useCallback(() => {
    return showGuidedToasts && !toastsCompleted.current
  }, [showGuidedToasts])

  // Marca o ciclo de toasts como completado
  const markToastsAsShown = React.useCallback(() => {
    toastsCompleted.current = true
  }, [])

  React.useEffect(() => {
    if (startDate) {
      setSelectedRange({
        from: startDate,
        to: endDate ?? undefined,
      })
      return
    }
    setSelectedRange(undefined)
  }, [startDate, endDate])

  // Toast 2 e 3: Mostrar conforme o usuário seleciona datas
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!shouldShowToasts()) return

    // Toast 2: Quando data de início é selecionada (mas ainda não tem data final)
    if (startDate && !endDate && !hasShownStartDateToast.current) {
      hasShownStartDateToast.current = true
      toast.info('Agora selecione a data final', {
        description:
          'Clique novamente no calendário para escolher quando a locação termina',
        position: 'top-right',
        duration: 8000,
      })
    }

    // Toast 3: Quando ambas as datas são selecionadas (sucesso)
    if (startDate && endDate && !hasShownSuccessToast.current) {
      const days = differenceInCalendarDays(endDate, startDate) + 1
      hasShownSuccessToast.current = true
      toast.success('Datas selecionadas com sucesso!', {
        description: `Período de ${days} ${days === 1 ? 'dia' : 'dias'} configurado. Agora você pode escolher o período de locação.`,
        position: 'top-right',
        duration: 8000,
      })
      markToastsAsShown()
    }
  }, [startDate, endDate, shouldShowToasts, markToastsAsShown])

  // Handler para quando o popover abre/fecha
  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen)

      // Toast 1: Mostrar ao abrir o calendário pela primeira vez
      if (
        isOpen &&
        !startDate &&
        !endDate &&
        !hasShownFirstClickToast.current &&
        shouldShowToasts()
      ) {
        hasShownFirstClickToast.current = true
        toast.info('Selecione a data de início', {
          description:
            'Clique no calendário para escolher quando a locação começa',
          position: 'top-right',
          duration: 8000,
        })
      }
    },
    [startDate, endDate, shouldShowToasts]
  )

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      // Verificar se é o mesmo dia (primeiro clique)
      const isSameDay =
        range.from.getFullYear() === range.to.getFullYear() &&
        range.from.getMonth() === range.to.getMonth() &&
        range.from.getDate() === range.to.getDate()

      if (isSameDay) {
        // Primeiro clique: atualizar estado interno apenas com from (sem to)
        // para manter consistência entre estado visual e estado do pai
        setSelectedRange({ from: range.from, to: undefined })
        onDateChange(range.from, null)
        return
      }

      // Validar período mínimo
      if (minDays) {
        const days = Math.ceil(
          (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (days < minDays - 1) {
          // -1 porque o cálculo é inclusivo
          return
        }
      }

      // Validar período máximo
      if (maxDays) {
        const days = Math.ceil(
          (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (days > maxDays - 1) {
          // -1 porque o cálculo é inclusivo
          return
        }
      }

      // Range válido com from e to diferentes: atualizar estado e fechar
      setSelectedRange(range)
      onDateChange(range.from, range.to)
      setOpen(false)
    } else if (range?.from) {
      // Apenas início selecionado, aguardar fim
      setSelectedRange({ from: range.from, to: undefined })
      onDateChange(range.from, null)
    } else {
      setSelectedRange(undefined)
      onDateChange(null, null)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRange(undefined)
    onDateChange(null, null)
  }

  // Data mínima: hoje (sem horas para comparação correta)
  const today = React.useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  // Data mínima efetiva: usar minDate se fornecido, senão usar hoje
  const effectiveMinDate = React.useMemo(() => {
    if (minDate) {
      const date = new Date(minDate)
      date.setHours(0, 0, 0, 0)
      return date
    }
    if (allowPastDates) {
      const date = new Date(1970, 0, 1)
      date.setHours(0, 0, 0, 0)
      return date
    }
    return today
  }, [minDate, today, allowPastDates])

  const calendarStartMonth = React.useMemo(() => {
    const date = new Date(effectiveMinDate)
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    return date
  }, [effectiveMinDate])

  const calendarEndMonth = React.useMemo(() => {
    // Se maxDate definido, usar o mês de maxDate como limite
    if (maxDate) {
      const date = new Date(maxDate)
      date.setDate(1)
      date.setHours(0, 0, 0, 0)
      return date
    }
    // Caso contrário, permitir até dezembro do próximo ano
    const endYear = today.getFullYear() + 1
    return new Date(endYear, 11, 1) // Dezembro do próximo ano
  }, [maxDate, today])

  const isDateDisabled = (date: Date) => {
    const dateToCheck = new Date(date)
    dateToCheck.setHours(0, 0, 0, 0)

    // Datas passadas (antes de hoje)
    if (dateToCheck < effectiveMinDate) {
      return true
    }

    // Datas futuras além do máximo
    if (maxDate) {
      const maxDateCheck = new Date(maxDate)
      maxDateCheck.setHours(0, 0, 0, 0)
      if (dateToCheck > maxDateCheck) {
        return true
      }
    }

    // Datas indisponíveis
    return unavailableDates.some((unavailableDate) => {
      const unavailable = new Date(unavailableDate)
      unavailable.setHours(0, 0, 0, 0)
      return dateToCheck.getTime() === unavailable.getTime()
    })
  }

  const displayText = React.useMemo(() => {
    if (startDate && endDate) {
      return `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
    }
    if (startDate) {
      return format(startDate, 'dd/MM/yyyy', { locale: ptBR })
    }
    return placeholder
  }, [startDate, endDate, placeholder])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors',
            'hover:bg-gray-50',
            // Foco: o anel da marca só pelo teclado (token --focus-ring); nada muda no clique.
            FOCUS_RING,
            'disabled:cursor-not-allowed disabled:opacity-50',
            !startDate && !endDate && 'text-gray-500',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            <span>{displayText}</span>
          </div>
          {showClearButton && (startDate || endDate) && (
            <X
              className="ml-2 h-4 w-4 text-gray-400 hover:text-gray-600"
              onClick={handleClear}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 shadow-xl border-gray-200"
        align="start"
      >
        <Calendar
          mode="range"
          defaultMonth={startDate || today}
          selected={selectedRange}
          onSelect={handleSelect}
          numberOfMonths={1}
          disabled={isDateDisabled}
          locale={ptBR}
          className="rounded-lg"
          fromDate={effectiveMinDate} // Data mínima: hoje
          startMonth={calendarStartMonth} // Primeiro mês disponível (v9 API)
          endMonth={calendarEndMonth} // Último mês disponível (v9 API)
          toDate={maxDate} // Data máxima se fornecida
          showOutsideDays={false} // Não mostrar dias de outros meses
        />
        {(minDays || maxDays) && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              {minDays && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Período mínimo:</span>
                  <span>
                    {minDays} {minDays === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
              )}
              {maxDays && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Período máximo:</span>
                  <span>
                    {maxDays} {maxDays === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
