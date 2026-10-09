import { AdminEquipmentsPage } from '@gb-locacoes/frontend/pages/equipamentos-admin'
import { renderEquipmentImage } from '../../../../host/equipment-image.native'
export default function AdminEquipmentListRoute() {
  return <AdminEquipmentsPage image={renderEquipmentImage} />
}
