'use client'
import type { EquipmentDetailScreenProps } from '../model/detail-contract'
import { usePublicEquipment } from '../model/use-public-equipment'
import { EquipamentoDetalhePage } from './EquipamentoDetalhePage.web'

/** A apresentação nativa é selecionada por Metro; o web conserva seu SSR. */
export function EquipmentDetailScreen(props: EquipmentDetailScreenProps) {
  const m = usePublicEquipment(props.id, props.tenantSlug)
  if (m.loading) return <p role="status">Carregando equipamento...</p>
  if (m.error)
    return (
      <div role="alert">
        {m.error}
        <button onClick={m.retry}>Tentar novamente</button>
      </div>
    )
  if (!m.equipment) return <p>Equipamento não encontrado.</p>
  const e = m.equipment
  return (
    <EquipamentoDetalhePage
      {...e}
      equipmentId={e.id}
      categoryName={e.category.name}
      categorySlug={e.category.slug}
      available={e.isAvailable}
      structuredData={null}
    />
  )
}
