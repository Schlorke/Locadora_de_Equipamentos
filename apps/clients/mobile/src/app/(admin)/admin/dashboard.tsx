import { AdminDashboard } from '@gb-locacoes/frontend/pages/dashboard'
import { useAreaExits } from '../../../host/use-area-exits'
import { openOnboardingPanel } from '../../../host/subscription-panel.native'

export default function Screen() {
  const exits = useAreaExits()
  return (
    <AdminDashboard
      onBack={exits.back}
      onSignOut={exits.signOut}
      openSetupPanel={openOnboardingPanel}
    />
  )
}
