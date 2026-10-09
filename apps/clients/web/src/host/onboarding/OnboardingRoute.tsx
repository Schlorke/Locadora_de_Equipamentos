'use client'
import { OnboardingPage } from '@gb-locacoes/frontend/pages/onboarding'
import { hostAuth } from '../auth/client'
import { OnboardingCaptcha } from './OnboardingCaptcha'
async function signInCredentials(email: string, password: string) {
  const result = await hostAuth.signInCredentials(email, password)
  return { ok: result?.ok === true, error: result?.error ?? undefined }
}
export function OnboardingRoute() {
  return (
    <OnboardingPage
      signInCredentials={signInCredentials}
      captcha={(props) => <OnboardingCaptcha {...props} />}
    />
  )
}
