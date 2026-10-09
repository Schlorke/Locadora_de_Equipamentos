'use client'

import {
  SocialDivider,
  SocialLoginButtons,
} from '@gb-locacoes/ui'
import { LoginPage, LoginPageFallback } from '@gb-locacoes/frontend/pages/login'
import { hostAuth } from '../../../../../host/auth/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const errorParam = searchParams.get('error')

  return (
    <LoginPage
      callbackUrl={callbackUrl}
      errorParam={errorParam}
      replace={(href) => router.replace(href)}
      getSession={hostAuth.getSession}
      signInCredentials={hostAuth.signInCredentials}
      social={({ isLoading, onError, callbackUrl: socialCallback }) => (
        <>
          <SocialDivider>Ou continue com</SocialDivider>
          <SocialLoginButtons
            onSignIn={hostAuth.signInProvider}
            isLoading={isLoading}
            onError={onError}
            callbackUrl={socialCallback}
          />
        </>
      )}
    />
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={<LoginPageFallback />}
    >
      <LoginRoute />
    </Suspense>
  )
}
