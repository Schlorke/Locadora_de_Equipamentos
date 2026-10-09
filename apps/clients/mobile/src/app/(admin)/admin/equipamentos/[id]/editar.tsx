import { useLocalSearchParams } from 'expo-router'
import { EditarEquipamentoPage } from '@gb-locacoes/frontend/pages/equipamentos-admin'
import { renderEquipmentImage } from '../../../../../host/equipment-image.native'
import { pickEquipmentImageFiles } from '../../../../../host/equipment-upload.native'
export default function EditEquipmentRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  return (
    <EditarEquipamentoPage
      equipmentId={typeof id === 'string' ? id : null}
      image={renderEquipmentImage}
      pickImages={pickEquipmentImageFiles}
    />
  )
}
