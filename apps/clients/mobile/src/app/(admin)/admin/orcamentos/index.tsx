import { useLocalSearchParams } from 'expo-router'
import { useHostNavigation } from '../../../../host/use-host-navigation'
import { AdminQuotesPageWrapper } from '@gb-locacoes/frontend/pages/orcamentos-admin'
import { shareDownloadedContract } from '../../../../host/contract-share'
import { openRentalDocument } from '../../../../host/rental-documents.native'
export default function QuotesRoute() {
  const navigation = useHostNavigation()
  const params = useLocalSearchParams<{ search?: string; quoteId?: string }>()
  return (
    <AdminQuotesPageWrapper
      initialSearch={
        Array.isArray(params.search) ? params.search[0] : params.search
      }
      requestedQuoteId={
        Array.isArray(params.quoteId) ? params.quoteId[0] : params.quoteId
      }
      navigate={navigation.push}
      shareDocument={shareDownloadedContract}
      openDocument={openRentalDocument}
    />
  )
}
