import { useLocalSearchParams } from 'expo-router'
import { EquipmentDetailsPage } from '@gb-locacoes/frontend/pages/equipamentos-admin'
import { renderEquipmentImage } from '../../../../../host/equipment-image.native'
export default function AdminEquipmentDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  return (
    <EquipmentDetailsPage
      equipmentId={typeof id === 'string' ? id : null}
      image={renderEquipmentImage}
    />
  )
}
