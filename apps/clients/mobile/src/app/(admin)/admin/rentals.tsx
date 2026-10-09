import { AdminRentalsPage } from '@gb-locacoes/frontend/pages/locacoes'
import {
  pickRentalDocument,
  openRentalDocument,
} from '../../../host/rental-documents.native'
export default function RentalsRoute() {
  return (
    <AdminRentalsPage
      pickDocument={pickRentalDocument}
      openDocument={openRentalDocument}
    />
  )
}
