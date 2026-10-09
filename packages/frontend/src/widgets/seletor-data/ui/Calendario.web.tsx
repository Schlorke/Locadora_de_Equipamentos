"use client";

import { clsx, type ClassValue } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import {
  DayPicker,
  Dropdown as DayPickerDropdown,
  type DropdownProps,
  type Matcher,
  useDayPicker,
} from "react-day-picker";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function mergeDisabled(
  disabled: Matcher | Matcher[] | undefined,
  fromDate: Date | undefined,
  toDate: Date | undefined
): Matcher | Matcher[] | undefined {
  const bounds: Matcher[] = []
  if (fromDate) bounds.push({ before: fromDate })
  if (toDate) bounds.push({ after: toDate })
  if (!disabled) return bounds.length > 0 ? bounds : undefined
  const current = Array.isArray(disabled) ? disabled : [disabled]
  return [...bounds, ...current]
}

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /**
   * Quando true, finais de semana (sábado e domingo) estão incluídos na seleção.
   * Por padrão é false, o que significa que apenas dias úteis (seg-sex) são considerados.
   */
  includeWeekends?: boolean
  /**
   * Quando true, remove opcoes desabilitadas dos dropdowns (meses/anos).
   */
  hideDisabledDropdownOptions?: boolean
  /**
   * Quando true, ao trocar o ano o calendario volta para janeiro (ou o primeiro mes disponivel).
   */
  resetMonthOnYearChange?: boolean
  /** Limite antigo do react-day-picker v9. Vira startMonth e bloqueia dias anteriores. */
  fromDate?: Date
  /** Limite antigo do react-day-picker v9. Vira endMonth e bloqueia dias posteriores. */
  toDate?: Date
  fromMonth?: Date
  toMonth?: Date
  fromYear?: number
  toYear?: number
  /** Removido no react-day-picker v10. Mantido para não quebrar quem ainda passa a prop. */
  initialFocus?: boolean
}

// Componente customizado para MonthCaption - botões dentro da mesma div
function CustomMonthCaption(props: React.ComponentProps<'div'>) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker()

  return (
    <div className="rdp-month_caption">
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className="rdp-button_previous"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="rdp-dropdowns">{props.children}</div>
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className="rdp-button_next"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// Componente customizado para Nav - retorna fragment vazio pois os botões estão no Caption
function CustomNav() {
  return <></>
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  includeWeekends = true,
  hideDisabledDropdownOptions = false,
  resetMonthOnYearChange = false,
  components: externalComponents,
  modifiers: externalModifiers,
  modifiersClassNames: externalModifiersClassNames,
  fromDate,
  toDate,
  fromMonth,
  toMonth,
  fromYear,
  toYear,
  initialFocus: _initialFocus,
  ...props
}: CalendarProps) {
  const {
    startMonth: startMonthProp,
    endMonth: endMonthProp,
    disabled: disabledProp,
    ...dayPickerProps
  } = props
  // Função para verificar se uma data é final de semana
  const isWeekend = React.useCallback((date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6 // 0 = domingo, 6 = sábado
  }, [])

  // Modifiers para finais de semana
  const modifiers = React.useMemo(
    () => ({
      weekend: isWeekend,
      ...externalModifiers,
    }),
    [isWeekend, externalModifiers]
  )

  // Classes para os modifiers
  const modifiersClassNames = React.useMemo(
    () => ({
      weekend: 'rdp-weekend',
      ...externalModifiersClassNames,
    }),
    [externalModifiersClassNames]
  )

  const filteredDropdown = React.useCallback((dropdownProps: DropdownProps) => {
    const filteredOptions = dropdownProps.options?.filter(
      (option) => !option.disabled
    )
    return (
      <DayPickerDropdown
        {...dropdownProps}
        options={
          filteredOptions?.length ? filteredOptions : dropdownProps.options
        }
      />
    )
  }, [])

  const components = React.useMemo(() => {
    const YearDropdownStartMonth = (dropdownProps: DropdownProps) => {
      const {
        dayPickerProps,
        goToMonth,
        components: contextComponents,
      } = useDayPicker()

      const handleYearChange = (
        event: React.ChangeEvent<HTMLSelectElement>
      ) => {
        const selectedYear = Number(event.target.value)
        const startMonth = dayPickerProps.startMonth

        const normalizedStartMonth = startMonth
          ? new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)
          : undefined

        const startYear = normalizedStartMonth?.getFullYear()
        const targetMonth =
          startYear === selectedYear
            ? (normalizedStartMonth?.getMonth() ?? 0)
            : 0

        goToMonth(new Date(selectedYear, targetMonth, 1))
      }

      const Dropdown = contextComponents.Dropdown ?? DayPickerDropdown

      return <Dropdown {...dropdownProps} onChange={handleYearChange} />
    }

    const baseComponents = {
      MonthCaption: CustomMonthCaption,
      Nav: CustomNav,
      Chevron: ({
        orientation,
      }: {
        orientation?: 'up' | 'down' | 'left' | 'right'
      }) => {
        const Icon =
          orientation === 'left' || orientation === 'up'
            ? ChevronLeft
            : ChevronRight
        return <Icon className="h-4 w-4" />
      },
      ...(hideDisabledDropdownOptions ? { Dropdown: filteredDropdown } : {}),
      ...(resetMonthOnYearChange
        ? { YearsDropdown: YearDropdownStartMonth }
        : {}),
    }

    return { ...baseComponents, ...externalComponents }
  }, [
    externalComponents,
    filteredDropdown,
    hideDisabledDropdownOptions,
    resetMonthOnYearChange,
  ])

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      className={cn('p-2 sm:p-3', className)}
      classNames={{
        root: cn(
          'rdp-root',
          includeWeekends ? 'rdp-include-weekends' : 'rdp-exclude-weekends'
        ),
        months: 'rdp-months flex flex-col gap-4',
        month: 'rdp-month',
        month_caption: 'rdp-month_caption',
        caption_label: 'rdp-caption_label',
        nav: 'rdp-nav',
        button_previous: 'rdp-button_previous',
        button_next: 'rdp-button_next',
        month_grid: 'rdp-month_grid',
        weekdays: 'rdp-weekdays',
        weekday: 'rdp-weekday',
        week: 'rdp-week',
        day: 'rdp-day',
        day_button: 'rdp-day_button',
        range_end: 'rdp-range_end',
        selected: 'rdp-selected',
        today: 'rdp-today',
        outside: 'rdp-outside',
        disabled: 'rdp-disabled',
        range_middle: 'rdp-range_middle',
        range_start: 'rdp-range_start',
        hidden: 'rdp-hidden',
        dropdowns: 'rdp-dropdowns',
        dropdown: 'rdp-dropdown',
        dropdown_root: 'rdp-dropdown_root',
        ...classNames,
      }}
      modifiers={modifiers}
      modifiersClassNames={modifiersClassNames}
      components={components}
      {...dayPickerProps}
      startMonth={
        startMonthProp ??
        fromMonth ??
        fromDate ??
        (typeof fromYear === 'number' ? new Date(fromYear, 0, 1) : undefined)
      }
      endMonth={
        endMonthProp ??
        toMonth ??
        toDate ??
        (typeof toYear === 'number' ? new Date(toYear, 11, 1) : undefined)
      }
      disabled={mergeDisabled(disabledProp, fromDate, toDate)}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
