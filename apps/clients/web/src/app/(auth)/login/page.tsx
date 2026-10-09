'use client'

import { SocialDivider, SocialLoginButtons } from '@gb-locacoes/ui'
import {
  LoginPage,
  LoginPageFallback,
  resolvePanelCallback,
} from '@gb-locacoes/frontend/pages/login'
import { hostAuth } from '../../../host/auth/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

/**
 * Login da equipe no host `app` (painel da locadora assinante). É a mesma tela de login do produto: o login
 * universal (`ADMIN_LOGIN_REDIRECT`), o "Entrar" da área privada e o retorno sem sessão do /auth/callback chegam
 * aqui. O retorno fica preso ao painel: `callbackUrl` só vale para /admin/**; o padrão é /admin. A tela fica na casca
 * da plataforma do layout `(auth)` (`shell="platform"`: sem o deslocamento do cabeçalho da vitrine, com o nome da
 * plataforma no lugar da marca da locadora).
 */
function TeamLoginRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = resolvePanelCallback(searchParams.get('callbackUrl'))
  const errorParam = searchParams.get('error')

  return (
    <LoginPage
      callbackUrl={callbackUrl}
      errorParam={errorParam}
      requireReauthentication={searchParams.get('reauthenticate') === '1'}
      allowSignUp={false}
      shell="platform"
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
    <Suspense fallback={<LoginPageFallback shell="platform" />}>
      <TeamLoginRoute />
    </Suspense>
  )
}
