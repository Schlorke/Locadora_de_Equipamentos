'use client'

import { SocialDivider, SocialLoginButtons } from '@gb-locacoes/ui'
import { LoginPage } from '@gb-locacoes/frontend/pages/login'
import { getSession, signIn } from 'next-auth/react'
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
      requireReauthentication={searchParams.get('reauthenticate') === '1'}
      replace={(href) => router.replace(href)}
      getSession={async () => {
        const session = await getSession()
        return session
      }}
      signInCredentials={async (email, password) => {
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        })
        return result
      }}
      social={({ isLoading, onError, callbackUrl: socialCallback }) => (
        <>
          <SocialDivider>Ou continue com</SocialDivider>
          <SocialLoginButtons
            onSignIn={async (provider, callbackUrl) => {
              await signIn(provider, callbackUrl ? { callbackUrl } : {})
            }}
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
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      }
    >
      <LoginRoute />
    </Suspense>
  )
}
