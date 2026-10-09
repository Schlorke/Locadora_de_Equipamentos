import { NovoEquipamentoPage } from '@gb-locacoes/frontend/pages/equipamentos-admin'
import { renderEquipmentImage } from '../../../../host/equipment-image.native'
import { pickEquipmentImageFiles } from '../../../../host/equipment-upload.native'
export default function NewEquipmentRoute() {
  return (
    <NovoEquipamentoPage
      image={renderEquipmentImage}
      pickImages={pickEquipmentImageFiles}
    />
  )
}
