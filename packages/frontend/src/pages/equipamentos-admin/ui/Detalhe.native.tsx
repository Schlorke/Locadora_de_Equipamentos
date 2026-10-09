import { useMemo } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  Badge,
  Button,
  Card,
  Link,
  useNavigate,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useEquipmentDetails } from '../model/use-equipment-details'
import { useEquipmentScope } from '../model/escopo'
import type { EquipmentDetailsPageProps } from '../model/tipos'
import { EquipmentGallery } from './Galeria.native'
import { EquipmentUnitsManager } from './GerenciadorUnidades.native'
import {
  EquipmentConfirmation,
  useEquipmentConfirmation,
} from './Confirmacao.native'
export function EquipmentDetailsPage(props: EquipmentDetailsPageProps = {}) {
  return (
    <EquipmentDetailContent
      key={useEquipmentScope(props.equipmentId ?? null)}
      {...props}
    />
  )
}
function EquipmentDetailContent({
  equipmentId = null,
  image,
}: EquipmentDetailsPageProps) {
  const navigate = useNavigate(),
    confirmation = useEquipmentConfirmation(),
    theme = useTheme()
  const ports = useMemo(
    () => ({
      navigate: (href: string) => navigate?.(href),
      requestConfirmation: confirmation.requestConfirmation,
    }),
    [navigate, confirmation.requestConfirmation]
  )
  const m = useEquipmentDetails(equipmentId, ports),
    e = m.equipment
  if (m.isLoading) return <ActivityIndicator />
  if (!e)
    return (
      <View style={{ padding: space.md, gap: space.md }}>
        <Text style={{ color: theme.text }}>Equipamento não encontrado</Text>
        <Link href="/admin/equipamentos">Voltar para Equipamentos</Link>
      </View>
    )
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/admin/equipamentos">Voltar para Equipamentos</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        {e.name}
      </Text>
      <Link
        href={'/admin/equipamentos/' + encodeURIComponent(e.id) + '/editar'}
      >
        Editar Equipamento
      </Link>
      <Button
        variant="outline"
        disabled={m.isDeleting}
        onClick={m.handleDelete}
      >
        {m.isDeleting ? 'Excluindo...' : 'Excluir Equipamento'}
      </Button>
      <Card>
        <View style={{ padding: space.md, gap: space.md }}>
          <EquipmentGallery
            key={e.id}
            images={e.images}
            name={e.name}
            image={image}
          />
          <Text style={{ color: theme.text }}>{e.category.name}</Text>
          <Text style={{ color: theme.text }}>
            Diária: R$ {e.pricePerDay.toFixed(2)}
          </Text>
          <Badge>{e.isAvailable ? 'Disponível' : 'Indisponível'}</Badge>
          <Text style={{ color: theme.text }}>
            Orçamentos: {e._count?.quoteItems ?? 0}
          </Text>
          <Text style={{ color: theme.text }}>
            Avaliações: {e._count?.reviews ?? 0}
          </Text>
          <Text style={{ color: theme.textMuted }}>
            Criado em {new Date(e.createdAt).toLocaleString('pt-BR')}
          </Text>
          <Text style={{ color: theme.textMuted }}>
            Atualizado em {new Date(e.updatedAt).toLocaleString('pt-BR')}
          </Text>
          <Text style={{ color: theme.text }}>{e.description}</Text>
          {Object.entries(e.specifications ?? {}).map(([label, value]) => (
            <Text key={label} style={{ color: theme.text }}>
              {label}: {String(value)}
            </Text>
          ))}
        </View>
      </Card>
      <EquipmentUnitsManager equipmentId={e.id} />
      <EquipmentConfirmation
        message={confirmation.message}
        finish={confirmation.finish}
      />
    </ScrollView>
  )
}
