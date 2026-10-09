import { AdminLogisticsPage } from '@gb-locacoes/frontend/pages/logistica'
import { pickEquipmentImageFiles } from '../../../host/equipment-upload.native'
import { renderEquipmentImage } from '../../../host/equipment-image.native'
export default function LogisticsRoute() {
  return (
    <AdminLogisticsPage
      pickImages={pickEquipmentImageFiles}
      image={renderEquipmentImage}
    />
  )
}
