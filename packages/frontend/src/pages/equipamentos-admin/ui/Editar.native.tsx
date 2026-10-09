import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  Button,
  Card,
  ImageUpload,
  Input,
  Link,
  Textarea,
  useNavigate,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useEquipmentScope } from '../model/escopo'
import { useEditEquipment } from '../model/use-edit-equipment'
import {
  pickEquipmentImages,
  useEquipmentUpload,
} from '../model/use-equipment-upload'
import type { EquipmentFormPageProps } from '../model/tipos'
import { EquipmentForm } from './Formulario.native'
import { LossDateCalendar } from './CalendarioPerdas.native'
import {
  EquipmentConfirmation,
  useEquipmentConfirmation,
} from './Confirmacao.native'
import { EquipmentGallery } from './Galeria.native'
export function EditarEquipamentoPage(props: EquipmentFormPageProps = {}) {
  return (
    <EditContent
      key={useEquipmentScope(props.equipmentId ?? null)}
      {...props}
    />
  )
}
function EditContent({
  equipmentId = null,
  image,
  pickImages,
}: EquipmentFormPageProps) {
  const navigate = useNavigate(),
    m = useEditEquipment(equipmentId, (href) => navigate?.(href)),
    theme = useTheme(),
    c = useEquipmentConfirmation()
  const upload = useEquipmentUpload(
      m.api,
      m.apiClient,
      () => m.lossDraft.current
    ),
    busy = m.isSaving || m.isSavingLoss
  const choose = pickImages
    ? async (remaining: number) => {
        const revision = m.lossDraft.current
        return pickEquipmentImages(
          pickImages,
          upload,
          remaining,
          () => m.apiClient.isCurrent() && m.lossDraft.current === revision
        )
      }
    : undefined
  const remove = async (index: number) => {
    if (!m.apiClient.isCurrent() || busy) return
    const revision = m.lossDraft.current
    const loss = m.formData.partsLossHistory?.[index]
    if (!loss) return
    if (
      (await c.requestConfirmation(
        'Remover registro "' + loss.description + '"?'
      )) &&
      m.apiClient.isCurrent() &&
      m.lossDraft.current === revision
    )
      await m.handleRemovePartsLoss(index)
  }
  const text = { color: theme.text }
  if (!equipmentId)
    return (
      <Text accessibilityRole="alert" style={text}>
        Equipamento não informado.
      </Text>
    )
  if (m.isLoading) return <ActivityIndicator />
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/admin/equipamentos">Voltar aos Equipamentos</Link>
      <Text
        accessibilityRole="header"
        style={{
          ...text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Editar Equipamento
      </Text>
      <EquipmentForm
        model={m}
        image={image}
        pickImages={pickImages}
        busy={busy}
        editing
      />
      <Card>
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text accessibilityRole="header" style={text}>
            Registro de Perdas de Peças
          </Text>
          <Text style={text}>
            Total de perdas: {m.formData.partsLossCount || 0}
          </Text>
          {(m.formData.partsLossHistory || []).map((loss, index) => (
            <View key={index} style={{ gap: space.sm }}>
              <Text style={text}>
                {loss.date} — {loss.description} — Quantidade: {loss.quantity}
              </Text>
              {loss.images?.length ? (
                <EquipmentGallery
                  images={loss.images}
                  name={'Perda: ' + loss.description}
                  image={image}
                />
              ) : null}
              <Button
                variant="outline"
                disabled={busy}
                aria-label={'Editar Perda ' + (index + 1)}
                onClick={() => m.handleEditPartsLoss(index)}
              >
                Editar Perda {index + 1}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                aria-label={'Remover Perda ' + (index + 1)}
                onClick={() => void remove(index)}
              >
                Remover Perda {index + 1}
              </Button>
            </View>
          ))}
          <Text style={text}>
            {m.editingPartsLossIndex !== null
              ? 'Editar registro de perda'
              : 'Adicionar perda'}
          </Text>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => m.setIsPartsLossCalendarOpen(true)}
          >
            {m.partsLossDateDisplayText}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={m.clearPartsLossDate}
          >
            Limpar Data
          </Button>
          {m.isPartsLossCalendarOpen ? (
            <LossDateCalendar
              selected={m.newPartsLossSelectedDate}
              disabled={m.isPartsLossDateDisabled}
              onSelect={m.handlePartsLossDateSelect}
              onClose={() => m.setIsPartsLossCalendarOpen(false)}
            />
          ) : null}
          <Textarea
            aria-label="Descrição da perda"
            value={m.newPartsLossDescription}
            disabled={busy}
            onChangeText={m.setNewPartsLossDescription}
          />
          <Input
            type="number"
            aria-label="Quantidade perdida"
            value={m.newPartsLossQuantity}
            disabled={busy}
            onChangeText={m.setNewPartsLossQuantity}
          />
          <ImageUpload
            key={m.editingPartsLossIndex ?? 'new'}
            sectionTitle="Fotos da Perda"
            images={m.newPartsLossImages}
            maxImages={5}
            disabled={busy}
            chooseImages={choose}
            renderImage={
              image ? (src, alt) => image({ src, alt, height: 120 }) : undefined
            }
            onImagesChange={m.setNewPartsLossImages}
          />
          <Button disabled={busy} onClick={() => void m.handleSavePartsLoss()}>
            {m.editingPartsLossIndex !== null
              ? 'Atualizar Perda'
              : 'Registrar Perda'}
          </Button>
          <Button variant="outline" onClick={m.handleCancelEditPartsLoss}>
            Cancelar Registro de Perda
          </Button>
        </View>
      </Card>
      <EquipmentConfirmation message={c.message} finish={c.finish} />
    </ScrollView>
  )
}
