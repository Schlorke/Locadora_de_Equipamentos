import type { ReactNode } from 'react'
export interface OnboardingCaptchaProps {
  siteKey: string
  attempt: number
  onToken(token: string | null): void
}
export interface OnboardingPageProps {
  signInCredentials(
    email: string,
    password: string
  ): Promise<{ ok?: boolean; error?: string }>
  captcha(props: OnboardingCaptchaProps): ReactNode
}
