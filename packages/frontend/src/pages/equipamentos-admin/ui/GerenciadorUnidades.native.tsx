import { ActivityIndicator, Text, View } from 'react-native'
import {
  Button,
  Card,
  Dialog,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useEquipmentScope } from '../model/escopo'
import { useEquipmentUnits } from '../model/use-equipment-units'
import type { EquipmentUnitsManagerProps } from '../model/tipos'
import {
  EquipmentConfirmation,
  useEquipmentConfirmation,
} from './Confirmacao.native'
const statuses = [
  ['AVAILABLE', 'Disponível'],
  ['RESERVED', 'Reservado'],
  ['RENTED', 'Locado'],
  ['MAINTENANCE', 'Manutenção'],
  ['RETIRED', 'Baixado'],
]
export function EquipmentUnitsManager(props: EquipmentUnitsManagerProps) {
  return (
    <EquipmentUnitsContent
      key={useEquipmentScope(props.equipmentId)}
      {...props}
    />
  )
}
function EquipmentUnitsContent({ equipmentId }: EquipmentUnitsManagerProps) {
  const confirmation = useEquipmentConfirmation(),
    theme = useTheme(),
    m = useEquipmentUnits(equipmentId, confirmation.requestConfirmation)
  if (m.loading) return <ActivityIndicator />
  return (
    <View style={{ gap: space.md }}>
      <Text
        accessibilityRole="header"
        style={{ color: theme.text, fontSize: typography.size.lg }}
      >
        Unidades Físicas ({m.units.length})
      </Text>
      <Button onClick={m.handleCreate}>Nova Unidade</Button>
      {m.units.length ? (
        m.units.map((unit) => (
          <Card key={unit.id}>
            <View style={{ padding: space.md, gap: space.sm }}>
              <Text accessibilityRole="header" style={{ color: theme.text }}>
                {unit.uniqueCode}
              </Text>
              <Text style={{ color: theme.text }}>
                {statuses.find(([value]) => value === unit.status)?.[1] ??
                  'Disponível'}
              </Text>
              {unit.hourMeter !== null ? (
                <Text style={{ color: theme.text }}>
                  Horímetro: {Number(unit.hourMeter).toFixed(1)}h
                </Text>
              ) : null}
              {unit.odometer !== null ? (
                <Text style={{ color: theme.text }}>
                  Odômetro: {Number(unit.odometer).toFixed(0)}km
                </Text>
              ) : null}
              {unit.serialNumber ? (
                <Text style={{ color: theme.text }}>
                  Série: {unit.serialNumber}
                </Text>
              ) : null}
              {unit.notes ? (
                <Text style={{ color: theme.text }}>Notas: {unit.notes}</Text>
              ) : null}
              <Button
                variant="outline"
                onClick={() => m.handleEdit(unit)}
                aria-label={'Editar Unidade ' + unit.uniqueCode}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                onClick={() => m.handleDelete(unit.id)}
                aria-label={'Excluir Unidade ' + unit.uniqueCode}
              >
                Excluir
              </Button>
            </View>
          </Card>
        ))
      ) : (
        <Text style={{ color: theme.textMuted }}>
          Nenhuma unidade física cadastrada
        </Text>
      )}
      <Dialog.Root open={m.isDialogOpen} onOpenChange={m.setIsDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {m.isEditing ? 'Editar Unidade' : 'Nova Unidade'}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <View style={{ gap: space.md }}>
                  <Text style={{ color: theme.text }}>Código Único *</Text>
                  <Input
                    aria-label="Código Único *"
                    value={m.uniqueCode}
                    onChangeText={m.setUniqueCode}
                    placeholder="Ex: BET-001, COMP-042"
                  />
                  <Text style={{ color: theme.text }}>Status</Text>
                  <Select value={m.status} onValueChange={m.setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map(([value, label]) => (
                        <SelectItem key={value} value={value!}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Text style={{ color: theme.text }}>Horímetro (horas)</Text>
                  <Input
                    aria-label="Horímetro (horas)"
                    type="number"
                    value={m.hourMeter}
                    onChangeText={m.setHourMeter}
                  />
                  <Text style={{ color: theme.text }}>Odômetro (km)</Text>
                  <Input
                    aria-label="Odômetro (km)"
                    type="number"
                    value={m.odometer}
                    onChangeText={m.setOdometer}
                  />
                  <Text style={{ color: theme.text }}>Número de Série</Text>
                  <Input
                    aria-label="Número de Série"
                    value={m.serialNumber}
                    onChangeText={m.setSerialNumber}
                  />
                  <Text style={{ color: theme.text }}>Notas</Text>
                  <Textarea
                    aria-label="Notas"
                    value={m.notes}
                    onChangeText={m.setNotes}
                  />
                </View>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => m.setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={m.handleSave}>
                  {m.isEditing ? 'Salvar' : 'Criar'}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <EquipmentConfirmation
        message={confirmation.message}
        finish={confirmation.finish}
      />
    </View>
  )
}
