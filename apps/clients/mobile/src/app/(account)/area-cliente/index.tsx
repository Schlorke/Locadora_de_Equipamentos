import { AreaClientePage } from '@gb-locacoes/frontend/pages/area-cliente'
import { useAreaExits } from '../../../host/use-area-exits'

export default function Screen() {
  const exits = useAreaExits()
  return <AreaClientePage onBack={exits.back} onSignOut={exits.signOut} />
}
