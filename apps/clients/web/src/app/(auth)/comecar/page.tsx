import type { Metadata } from 'next'
import { OnboardingRoute } from '../../../host/onboarding/OnboardingRoute'
export const metadata: Metadata = {
  title: 'Cadastre sua locadora',
  robots: { index: false, follow: false },
}
export default function Page() {
  return <OnboardingRoute />
}
