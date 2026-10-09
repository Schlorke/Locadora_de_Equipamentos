import { AdminConfiguracoesPage } from '@gb-locacoes/frontend/pages/configuracoes'
import { pickSettingsImages } from '../../../host/settings-image-picker.native'
import { renderEquipmentImage } from '../../../host/equipment-image.native'
export default function AdminSettingsScreen() {
  return (
    <AdminConfiguracoesPage
      pickImages={pickSettingsImages}
      image={renderEquipmentImage}
    />
  )
}
