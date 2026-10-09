import { AssinaturaAdminPage } from '@gb-locacoes/frontend/pages/assinatura-admin'
import { openSubscriptionPanel } from '../../../host/subscription-panel.native'

export default function Page() {
  return <AssinaturaAdminPage openPanel={openSubscriptionPanel} />
}
