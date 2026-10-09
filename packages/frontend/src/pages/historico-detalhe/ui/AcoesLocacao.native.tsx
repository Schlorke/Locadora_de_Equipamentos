import { View } from 'react-native'
import { Button, Dialog, Input, Link } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { useRentalActions } from '../model/use-rental-actions'
import { useRentalDetailScope } from '../model/use-rental-detail'
import type { RentalActionsProps } from '../model/actions-contract'
const noop = () => {}
export function RentalActions(
  props: RentalActionsProps & { onRefresh?: () => void }
) {
  return (
    <ActionsContent key={useRentalDetailScope(props.rentalId)} {...props} />
  )
}
function ActionsContent({
  rentalId,
  status,
  endDate,
  hasBoleto,
  boletoPaymentId,
  onRefresh = noop,
}: RentalActionsProps & { onRefresh?: () => void }) {
  const m = useRentalActions(rentalId, onRefresh)
  return (
    <View style={{ gap: space.sm }}>
      {hasBoleto && status === 'PENDING' && boletoPaymentId ? (
        <Link
          href={
            '/area-cliente/pagamentos/' + encodeURIComponent(boletoPaymentId)
          }
        >
          Ver Boleto
        </Link>
      ) : null}
      {status === 'ACTIVE' && new Date() < endDate ? (
        <Button
          variant="outline"
          onClick={() => m.setShowExtensionDialog(true)}
        >
          Solicitar Prorrogação
        </Button>
      ) : null}
      {status === 'ACTIVE' ? (
        <Button variant="outline" onClick={() => m.setShowPickupDialog(true)}>
          Solicitar Coleta
        </Button>
      ) : null}
      <Dialog.Root
        open={m.showExtensionDialog}
        onOpenChange={m.setShowExtensionDialog}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>Solicitar Prorrogação</Dialog.Title>
            <Dialog.Description>
              Informe quantos dias adicionais você precisa
            </Dialog.Description>
            <Input
              value={String(m.extensionDays)}
              type="number"
              aria-label="Dias Adicionais"
              onChangeText={(value) => m.setExtensionDays(parseInt(value) || 1)}
            />
            <Button
              disabled={m.loading}
              onClick={() => void m.handleRequestExtension()}
            >
              {m.loading ? 'Enviando...' : 'Enviar Pedido'}
            </Button>
            <Dialog.Close
              render={<Button variant="outline">Cancelar</Button>}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={m.showPickupDialog}
        onOpenChange={m.setShowPickupDialog}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>Solicitar Coleta</Dialog.Title>
            <Dialog.Description>
              Solicite a coleta do equipamento no endereço da obra
            </Dialog.Description>
            <Button
              disabled={m.loading}
              onClick={() => void m.handleRequestPickup()}
            >
              {m.loading ? 'Enviando...' : 'Confirmar Solicitação'}
            </Button>
            <Dialog.Close
              render={<Button variant="outline">Cancelar</Button>}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </View>
  )
}
