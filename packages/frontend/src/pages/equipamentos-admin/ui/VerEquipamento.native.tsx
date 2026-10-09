import { Text, View } from 'react-native'
import { Button, Dialog, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import type {
  EquipmentImagePort,
  ViewEquipmentDialogProps,
} from '../model/tipos'
import { formatDate, formatPrice } from '../model/use-equipment-list'
import { EquipmentGallery } from './Galeria.native'
export function ViewEquipmentDialog({
  equipment,
  isOpen,
  onClose,
  onEdit,
  image,
}: ViewEquipmentDialogProps & EquipmentImagePort) {
  const theme = useTheme()
  if (!equipment) return null
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{equipment.name}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <View style={{ gap: space.md }}>
                <EquipmentGallery
                  key={equipment.id}
                  images={equipment.images}
                  name={equipment.name}
                  image={image}
                />
                <Text style={{ color: theme.text }}>
                  {formatPrice(equipment.pricePerDay)} / dia
                </Text>
                <Text style={{ color: theme.text }}>
                  {equipment.isAvailable ? 'Disponível' : 'Indisponível'}
                </Text>
                <Text style={{ color: theme.text }}>
                  {equipment.category?.name ?? 'Sem categoria'}
                </Text>
                <Text style={{ color: theme.text }}>
                  {equipment.description || 'Sem descrição'}
                </Text>
                <Text style={{ color: theme.textMuted }}>
                  Cadastrado em {formatDate(equipment.createdAt)}
                </Text>
                <Text style={{ color: theme.text }}>
                  Total de perdas: {equipment.partsLossCount ?? 0}
                </Text>
                {equipment.partsLossHistory?.map((loss, index) => (
                  <View key={loss.date + index} style={{ gap: space.sm }}>
                    <Text style={{ color: theme.text }}>
                      {formatDate(loss.date)} — {loss.description} — Quantidade:{' '}
                      {loss.quantity}
                    </Text>
                    {loss.images?.length ? (
                      <EquipmentGallery
                        images={loss.images}
                        name={loss.description}
                        image={image}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Fechar Visualização
              </Button>
              <Button onClick={() => onEdit(equipment)}>
                Editar Equipamento
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
