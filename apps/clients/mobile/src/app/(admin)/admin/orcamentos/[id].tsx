import { useLocalSearchParams } from 'expo-router'
import { useHostNavigation } from '../../../../host/use-host-navigation'
import { QuoteDetailPage } from '@gb-locacoes/frontend/pages/orcamentos-admin'
import { shareDownloadedContract } from '../../../../host/contract-share'
import { openRentalDocument } from '../../../../host/rental-documents.native'
export default function QuoteRoute() {
  const navigation = useHostNavigation()
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <QuoteDetailPage
      id={Array.isArray(id) ? id[0] || '' : id}
      navigate={navigation.push}
      shareDocument={shareDownloadedContract}
      openDocument={openRentalDocument}
    />
  )
}
