'use client'

import { useCallback, type ReactNode } from 'react'
import {
  resolveLoginRedirect,
  useCredentialsSignIn,
  type AuthSession,
  type CredentialsAdapter,
} from '../../../features/entrar'

export interface LoginPageProps extends CredentialsAdapter {
  callbackUrl?: string | null
  errorParam?: string | null
  requireReauthentication?: boolean
  social?: (input: {
    isLoading: boolean
    onError: (error: string) => void
    callbackUrl: string
  }) => ReactNode
  replace: (href: string) => void
  /**
   * Mostra o convite "Não tem uma conta? Cadastre-se" (padrão). O login da equipe no host `app` desliga: a equipe é
   * convidada e o host não tem /cadastro.
   */
  allowSignUp?: boolean
  /**
   * Casca em que a tela aparece, escolhida pelo host. `storefront` (padrão): sob o cabeçalho da vitrine, com a marca
   * da locadora. `platform` (fluxos de conta no host `app`): abaixo da barra da plataforma, com o nome provisório da
   * plataforma (`PLATFORM.displayName`) no lugar da marca.
   */
  shell?: 'storefront' | 'platform'
}

export function useLoginModel({
  callbackUrl = null,
  errorParam = null,
  requireReauthentication = false,
  replace,
  signInCredentials,
  getSession,
}: LoginPageProps) {
  const onAuthenticated = useCallback(
    (session: AuthSession, email: string) => {
      replace(
        resolveLoginRedirect({
          callbackUrl,
          email,
          role: session?.user?.role || undefined,
        })
      )
    },
    [callbackUrl, replace]
  )
  return useCredentialsSignIn({
    signInCredentials,
    getSession,
    onAuthenticated,
    errorParam,
    requireReauthentication,
  })
}
