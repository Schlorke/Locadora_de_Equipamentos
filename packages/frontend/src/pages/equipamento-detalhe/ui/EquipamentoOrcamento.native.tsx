import { useMemo } from 'react'
import { Text, View } from 'react-native'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  Button,
  useNavigate,
  useTheme,
  toast,
} from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { avisoLogin } from '../model/avisos'
import { useEquipmentQuote } from '../model/use-equipment-quote'
import type { SmartQuoteButtonProps } from '../model/pricing-contract'

const notifyLogin = () =>
  toast.info(avisoLogin.message, {
    description: avisoLogin.description,
    position: avisoLogin.position,
    duration: avisoLogin.duration,
  })
export type { PricingOption } from '../model/pricing-contract'

export function SmartQuoteButton(props: SmartQuoteButtonProps) {
  const navigate = useNavigate()
  const theme = useTheme()
  const router = useMemo(
    () => ({ push: (href: string) => navigate?.(href) }),
    [navigate]
  )
  const m = useEquipmentQuote(props, {
    router,
    pathname: `/equipamentos/${encodeURIComponent(props.equipmentId)}`,
    query: '',
    notifyLogin,
  })
  return (
    <>
      <Button
        size={props.size ?? 'lg'}
        variant={props.variant ?? 'default'}
        disabled={!props.isAvailable}
        onClick={m.handleQuoteRequest}
        aria-busy={m.pendingQuoteRequest || undefined}
      >
        {props.isAvailable
          ? (props.children ?? 'Solicitar Orçamento Grátis')
          : 'Equipamento Indisponível'}
      </Button>
      <AlertDialog
        open={m.isWeekendDialogOpen}
        onOpenChange={(open) => {
          if (!open) m.handleWeekendCancel()
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Incluir finais de semana?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está solicitando locação de {props.equipmentName} sem ter
            selecionado datas específicas no calendário.
          </AlertDialogDescription>
          <View style={{ gap: space.md }}>
            <Text style={{ color: theme.text }}>
              Deseja incluir os finais de semana na contagem de dias?
            </Text>
            <Text style={{ color: theme.textMuted }}>
              Sim: sábados e domingos serão contados como dias de locação. Não:
              apenas dias úteis (segunda a sexta) serão contados.
            </Text>
            <Button
              variant="outline"
              onClick={() => m.handleWeekendConfirmation(false)}
            >
              Não, apenas dias úteis
            </Button>
            <Button onClick={() => m.handleWeekendConfirmation(true)}>
              Sim, incluir finais de semana
            </Button>
            <Button variant="ghost" onClick={m.handleWeekendCancel}>
              Fechar dialog
            </Button>
          </View>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
