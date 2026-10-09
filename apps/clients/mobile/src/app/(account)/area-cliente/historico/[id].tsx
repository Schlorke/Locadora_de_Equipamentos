import { useLocalSearchParams } from 'expo-router'
import { RentalDetailsPage } from '@gb-locacoes/frontend/pages/historico-detalhe'
import { shareDownloadedContract } from '../../../../host/contract-share'
import { resolvePublicAssetUrl } from '../../../../host/api-config'
export default function Screen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  return (
    <RentalDetailsPage
      paramId={typeof id === 'string' ? id : null}
      onDownload={shareDownloadedContract}
      resolveAssetUrl={resolvePublicAssetUrl}
    />
  )
}
