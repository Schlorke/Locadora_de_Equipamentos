import { Text, View } from 'react-native'
import { Button, Checkbox, Dialog, toast, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { useEquipmentPricing } from '../model/use-equipment-pricing'
import type { SmartEquipmentPricingProps } from '../model/pricing-contract'
import { EquipmentPricingSelector } from './EquipamentoPeriodo.native'
import { SmartQuoteButton } from './EquipamentoOrcamento.native'
import { EquipmentCalendar } from './EquipmentCalendar.native'
import { avisoInicio } from '../model/avisos'
import { entregaNaRegiao } from '../model/regiao'
import { useIdentidadePublica } from '../../../entities/organizacao'

export type { PricingOption } from '../model/pricing-contract'

export function SmartEquipmentPricing(props: SmartEquipmentPricingProps) {
  const m = useEquipmentPricing(props, toast)
  const theme = useTheme()
  // Região de entrega: a cidade do cartão da própria locadora (achado 143).
  const cidade = useIdentidadePublica()?.cidade ?? null
  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" style={{ color: theme.text }}>
        Escolha as datas da locação
      </Text>
      <Button
        variant="outline"
        onClick={() => {
          m.setIsCalendarOpen(true)
          if (m.shouldShowToasts() && !m.hasShownFirstClickToast.current) {
            m.hasShownFirstClickToast.current = true
            toast.info(avisoInicio.message, avisoInicio)
          }
        }}
      >
        {m.displayText}
      </Button>
      {m.startDate ? (
        <Button
          variant="ghost"
          onClick={() => m.handleClear({ stopPropagation() {} })}
        >
          Limpar datas
        </Button>
      ) : null}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <Checkbox
          checked={m.includeWeekends}
          onCheckedChange={(value) => {
            m.setIncludeWeekends(value === true)
            m.setIncludeWeekendsTouched(true)
          }}
          aria-label="Incluir finais de semana"
        />
        <Text style={{ color: theme.text }}>
          Incluir finais de semana (sábado e domingo)
        </Text>
      </View>
      <Text style={{ color: theme.textMuted }}>
        Sem essa opção, apenas dias úteis (segunda a sexta) são contados.
      </Text>
      <Dialog.Root open={m.isCalendarOpen} onOpenChange={m.setIsCalendarOpen}>
        <Dialog.Popup>
          <Dialog.Title>Selecione as datas de início e fim</Dialog.Title>
          <EquipmentCalendar
            selected={m.selectedRange}
            onSelect={m.handleCalendarSelect}
            disabled={m.isDateDisabled}
            min={m.today}
            max={m.maxDate}
          />
          <Dialog.Close
            render={<Button variant="outline">Fechar calendário</Button>}
          />
        </Dialog.Popup>
      </Dialog.Root>
      <EquipmentPricingSelector
        {...m.pricingProps}
        selectedPeriod={m.selectedPeriod}
        selectedDays={m.selectedDays}
        startDate={m.startDate}
        endDate={m.endDate}
        onPeriodChange={m.handlePeriodChange}
      />
      <SmartQuoteButton
        {...props}
        selectedPeriod={
          m.selectedPeriod ?? {
            id: 'daily',
            label: 'Diário',
            period: 'dia',
            multiplier: 1,
            discount: props.dailyDiscount ?? 0,
            popular: props.popularPeriod === 'daily',
          }
        }
        finalPrice={
          m.selectedPeriod || (m.startDate && m.endDate)
            ? m.finalPrice
            : props.pricePerDay
        }
        startDate={m.startDate}
        endDate={m.endDate}
        selectedDays={m.selectedDays}
        includeWeekends={m.includeWeekends}
        weekendSelectionConfirmed={m.includeWeekendsTouched}
        onWeekendSelectionConfirm={(value) => {
          m.setIncludeWeekends(value)
          m.setIncludeWeekendsTouched(true)
        }}
      />
      <Text style={{ color: theme.textMuted }}>{entregaNaRegiao(cidade)}</Text>
      <Text style={{ color: theme.textMuted }}>Resposta em até 2 horas</Text>
    </View>
  )
}
