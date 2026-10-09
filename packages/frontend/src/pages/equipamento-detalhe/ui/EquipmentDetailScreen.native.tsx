import { ActivityIndicator, Text, View } from 'react-native'
import { Button, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { useApiClientRevision } from '../../../shared/api'
import { useTenantContext } from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { usePublicEquipment } from '../model/use-public-equipment'
import { EquipamentoDetalhePage } from './EquipamentoDetalhePage.native'
import type { EquipmentDetailScreenProps } from '../model/detail-contract'

function Content(props: EquipmentDetailScreenProps) {
  const m = usePublicEquipment(props.id, props.tenantSlug)
  const theme = useTheme()
  if (m.loading)
    return <ActivityIndicator accessibilityLabel="Carregando equipamento..." />
  if (m.error)
    return (
      <View style={{ padding: space.md, gap: space.sm }}>
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {m.error}
        </Text>
        <Button onClick={m.retry}>Tentar novamente</Button>
      </View>
    )
  if (!m.equipment)
    return (
      <Text style={{ color: theme.text }}>Equipamento não encontrado.</Text>
    )
  const e = m.equipment
  return (
    <EquipamentoDetalhePage
      {...e}
      equipmentId={e.id}
      categoryName={e.category.name}
      categorySlug={e.category.slug}
      available={e.isAvailable}
      structuredData={null}
      image={props.image}
      onShare={props.onShare}
    />
  )
}

export function EquipmentDetailScreen(props: EquipmentDetailScreenProps) {
  const tenant = useTenantContext()
  const { data: session, status } = useSession()
  const transport = useApiClientRevision()
  return (
    <Content
      key={JSON.stringify([
        props.id,
        props.tenantSlug,
        tenant,
        session?.user?.id,
        status,
        transport,
      ])}
      {...props}
    />
  )
}
