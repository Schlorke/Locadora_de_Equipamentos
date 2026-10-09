'use client'
import { useEquipmentPricing } from '../model/use-equipment-pricing'
import type { SmartEquipmentPricingProps } from '../model/pricing-contract'
export type { PricingOption } from '../model/pricing-contract'

import { EquipmentPricingSelector } from './EquipamentoPeriodo.web'
import { SmartQuoteButton } from './EquipamentoOrcamento'
import { Calendar } from '../../../widgets/seletor-data'
import { Calendar as CalendarIcon, X, Info } from 'lucide-react'
import { Checkbox, Label } from '../../../shared/ui'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { HybridTooltip } from '@gb-locacoes/ui'
import { toast } from 'sonner'
import { ptBR } from 'date-fns/locale'
import { avisoInicio } from '../model/avisos'
import { entregaNaRegiao } from '../model/regiao'
import { useIdentidadePublica } from '../../../entities/organizacao'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function SmartEquipmentPricing({
  equipmentId,
  equipmentName,
  pricePerDay,
  isAvailable,
  dailyDiscount = 0,
  weeklyDiscount = 0,
  biweeklyDiscount = 0,
  monthlyDiscount = 0,
  popularPeriod = 'weekly',
  maxStock,
  description,
  category,
  images,
  className,
  // Campos de valor direto
  dailyDirectValue = 0,
  weeklyDirectValue = 0,
  biweeklyDirectValue = 0,
  monthlyDirectValue = 0,
  // Campos de controle de método de preço
  dailyUseDirectValue = false,
  weeklyUseDirectValue = false,
  biweeklyUseDirectValue = false,
  monthlyUseDirectValue = false,
  dailyRentalEnabled = true,
  weeklyRentalEnabled = true,
  biweeklyRentalEnabled = true,
  monthlyRentalEnabled = true,
}: SmartEquipmentPricingProps) {
  // Região de entrega: a cidade do cartão da própria locadora (achado 143).
  const cidade = useIdentidadePublica()?.cidade ?? null
  const {
    selectedPeriod,
    finalPrice,
    startDate,
    endDate,
    selectedDays,
    isCalendarOpen,
    setIsCalendarOpen,
    selectedRange,
    includeWeekends,
    setIncludeWeekends,
    includeWeekendsTouched,
    setIncludeWeekendsTouched,
    hasShownFirstClickToast,
    shouldShowToasts,
    handlePeriodChange,
    today,
    maxSelectableYears,
    maxDate,
    handleCalendarSelect,
    handleClear,
    firstDayOfCurrentMonth,
    maxMonth,
    isDateDisabled,
    displayText,
  } = useEquipmentPricing(
    {
      equipmentId,
      equipmentName,
      pricePerDay,
      isAvailable,
      dailyDiscount,
      weeklyDiscount,
      biweeklyDiscount,
      monthlyDiscount,
      popularPeriod,
      maxStock,
      description,
      category,
      images,
      className,
      dailyDirectValue,
      weeklyDirectValue,
      biweeklyDirectValue,
      monthlyDirectValue,
      dailyUseDirectValue,
      weeklyUseDirectValue,
      biweeklyUseDirectValue,
      monthlyUseDirectValue,
      dailyRentalEnabled,
      weeklyRentalEnabled,
      biweeklyRentalEnabled,
      monthlyRentalEnabled,
    },
    toast
  )

  return (
    <div className={className}>
      {/* Sistema de Preços */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm space-y-4">
        {/* Título */}
        <h4 className="text-sm font-semibold text-gray-900">
          Período de Locação
        </h4>

        {/* Botão de seleção de datas */}
        <button
          type="button"
          onClick={() => {
            setIsCalendarOpen(!isCalendarOpen)

            // Toast 1: Mostrar ao clicar no botão pela primeira vez
            if (
              !startDate &&
              !endDate &&
              !hasShownFirstClickToast.current &&
              shouldShowToasts()
            ) {
              hasShownFirstClickToast.current = true
              toast.info(avisoInicio.message, {
                description: avisoInicio.description,
                position: avisoInicio.position,
                duration: avisoInicio.duration,
              })
            }
          }}
          className={cn(
            'flex h-10 w-full items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors overflow-hidden',
            'hover:bg-gray-50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !startDate && !endDate
              ? 'justify-center text-gray-500'
              : 'justify-center relative'
          )}
        >
          {!startDate && !endDate ? (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="whitespace-nowrap">{displayText}</span>
              <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          ) : (
            <>
              <span className="flex-1 text-center whitespace-nowrap">
                {displayText}
              </span>
              <X
                className="h-4 w-4 text-gray-400 hover:text-gray-600 absolute right-3"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear(e)
                }}
              />
            </>
          )}
        </button>

        {/* Toggle para incluir finais de semana */}
        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id="include-weekends"
            checked={includeWeekends}
            onCheckedChange={(checked) => {
              setIncludeWeekendsTouched(true)
              setIncludeWeekends(checked === true)
            }}
          />
          <Label
            htmlFor="include-weekends"
            className="text-sm font-normal text-gray-700 cursor-pointer select-none"
          >
            Incluir finais de semana
          </Label>
          <HybridTooltip
            content="💡 Quando ativado, sábados e domingos são incluídos na contagem de dias da locação. Por padrão, apenas dias úteis (segunda a sexta) são considerados no cálculo do preço."
            side="top"
            align="center"
          >
            <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
          </HybridTooltip>
        </div>

        {/* Calendário inline - aparece quando isCalendarOpen é true */}
        {isCalendarOpen && (
          <div className="border border-gray-200 rounded-md bg-white p-0 shadow-md overflow-hidden max-w-full">
            <Calendar
              mode="range"
              defaultMonth={startDate || today}
              selected={selectedRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              disabled={isDateDisabled}
              locale={ptBR}
              fromDate={today}
              fromMonth={firstDayOfCurrentMonth}
              toDate={maxDate}
              toMonth={maxMonth}
              fromYear={today.getFullYear()}
              toYear={maxDate.getFullYear()}
              showOutsideDays={false}
              includeWeekends={includeWeekends}
              hideDisabledDropdownOptions
              resetMonthOnYearChange
            />
            <div className="border-t border-gray-200 px-3 py-2">
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div>Período mínimo: 1 dia</div>
                <div>Período máximo: {maxSelectableYears} anos</div>
                {selectedDays > 0 && (
                  <div className="text-green-600 font-medium">
                    ✓ {selectedDays} {selectedDays === 1 ? 'dia' : 'dias'}{' '}
                    {includeWeekends ? 'totais' : 'úteis'} selecionado
                    {selectedDays === 1 ? '' : 's'}
                  </div>
                )}
                {!includeWeekends && selectedDays === 0 && (
                  <div className="text-orange-600 font-medium">
                    ⚠️ Apenas dias úteis (seg-sex)
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Seletor de Período - Mostra preços baseados nas datas selecionadas */}
        <EquipmentPricingSelector
          pricePerDay={pricePerDay}
          dailyDiscount={dailyDiscount}
          weeklyDiscount={weeklyDiscount}
          biweeklyDiscount={biweeklyDiscount}
          monthlyDiscount={monthlyDiscount}
          popularPeriod={popularPeriod}
          dailyDirectValue={dailyDirectValue}
          weeklyDirectValue={weeklyDirectValue}
          biweeklyDirectValue={biweeklyDirectValue}
          monthlyDirectValue={monthlyDirectValue}
          dailyUseDirectValue={dailyUseDirectValue}
          weeklyUseDirectValue={weeklyUseDirectValue}
          biweeklyUseDirectValue={biweeklyUseDirectValue}
          monthlyUseDirectValue={monthlyUseDirectValue}
          dailyRentalEnabled={dailyRentalEnabled}
          weeklyRentalEnabled={weeklyRentalEnabled}
          biweeklyRentalEnabled={biweeklyRentalEnabled}
          monthlyRentalEnabled={monthlyRentalEnabled}
          onPeriodChange={handlePeriodChange}
          selectedDays={selectedDays}
          startDate={startDate}
          endDate={endDate}
          selectedPeriod={selectedPeriod}
        />
      </div>

      {/* Call-to-Action Principal */}
      <div className="space-y-3 mt-4">
        {selectedPeriod || (startDate && endDate) ? (
          <SmartQuoteButton
            equipmentId={equipmentId}
            equipmentName={equipmentName}
            pricePerDay={pricePerDay}
            isAvailable={isAvailable}
            selectedPeriod={
              selectedPeriod || {
                id: 'daily',
                label: 'Diário',
                period: 'dia',
                multiplier: 1,
                discount: dailyDiscount,
                popular: popularPeriod === 'daily',
              }
            }
            finalPrice={finalPrice}
            maxStock={maxStock}
            description={description}
            category={category}
            images={images}
            dailyDiscount={dailyDiscount}
            weeklyDiscount={weeklyDiscount}
            biweeklyDiscount={biweeklyDiscount}
            monthlyDiscount={monthlyDiscount}
            dailyDirectValue={dailyDirectValue}
            weeklyDirectValue={weeklyDirectValue}
            biweeklyDirectValue={biweeklyDirectValue}
            monthlyDirectValue={monthlyDirectValue}
            dailyUseDirectValue={dailyUseDirectValue}
            weeklyUseDirectValue={weeklyUseDirectValue}
            biweeklyUseDirectValue={biweeklyUseDirectValue}
            monthlyUseDirectValue={monthlyUseDirectValue}
            startDate={startDate}
            endDate={endDate}
            selectedDays={selectedDays}
            includeWeekends={includeWeekends}
            weekendSelectionConfirmed={includeWeekendsTouched}
            onWeekendSelectionConfirm={(value) => {
              setIncludeWeekends(value)
              setIncludeWeekendsTouched(true)
            }}
            variant="gradient"
            className={
              'w-full bg-[linear-gradient(to_right,#f97316,#ea580c,#f97316)] bg-[length:200%_100%] bg-left hover:bg-right transition-[background-position,transform,box-shadow] duration-500 ease-in-out' /* token-check-allow: gradiente laranja do botão de orçamento, orange-500 e orange-600 */
            }
          />
        ) : (
          <SmartQuoteButton
            equipmentId={equipmentId}
            equipmentName={equipmentName}
            pricePerDay={pricePerDay}
            isAvailable={isAvailable}
            selectedPeriod={{
              id: 'daily',
              label: 'Diário',
              period: 'dia',
              multiplier: 1,
              discount: dailyDiscount,
              popular: popularPeriod === 'daily',
            }}
            finalPrice={pricePerDay}
            maxStock={maxStock}
            description={description}
            category={category}
            images={images}
            dailyDiscount={dailyDiscount}
            weeklyDiscount={weeklyDiscount}
            biweeklyDiscount={biweeklyDiscount}
            monthlyDiscount={monthlyDiscount}
            dailyDirectValue={dailyDirectValue}
            weeklyDirectValue={weeklyDirectValue}
            biweeklyDirectValue={biweeklyDirectValue}
            monthlyDirectValue={monthlyDirectValue}
            dailyUseDirectValue={dailyUseDirectValue}
            weeklyUseDirectValue={weeklyUseDirectValue}
            biweeklyUseDirectValue={biweeklyUseDirectValue}
            monthlyUseDirectValue={monthlyUseDirectValue}
            includeWeekends={includeWeekends}
            weekendSelectionConfirmed={includeWeekendsTouched}
            onWeekendSelectionConfirm={(value) => {
              setIncludeWeekends(value)
              setIncludeWeekendsTouched(true)
            }}
            variant="gradient"
            className={
              'w-full bg-[linear-gradient(to_right,#f97316,#ea580c,#f97316)] bg-[length:200%_100%] bg-left hover:bg-right transition-[background-position,transform,box-shadow] duration-500 ease-in-out' /* token-check-allow: gradiente laranja do botão de orçamento, orange-500 e orange-600 */
            }
          />
        )}

        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{entregaNaRegiao(cidade)}</span>
          </div>
          <div className="text-xs text-gray-500">Resposta em até 2 horas</div>
        </div>
      </div>
    </div>
  )
}
