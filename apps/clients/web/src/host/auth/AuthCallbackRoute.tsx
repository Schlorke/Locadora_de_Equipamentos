'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AuthCallbackLoading,
  AuthCallbackPage,
  resolveAuthCallbackRedirect,
} from '@gb-locacoes/frontend/pages/auth-callback'
import { hostAuth } from './client'

function CallbackRoute() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl')
  useEffect(() => {
    let active = true
    void hostAuth
      .getSession()
      .then((session) => {
        const href = resolveAuthCallbackRedirect({
          status: session?.user ? 'authenticated' : 'unauthenticated',
          hasUser: Boolean(session?.user),
          email: session?.user?.email || undefined,
          role: session?.user?.role || undefined,
          callbackUrl,
        })
        if (active && href) router.replace(href)
      })
      .catch(() => {
        if (active) router.replace('/login')
      })
    return () => {
      active = false
    }
  }, [router, callbackUrl])
  return <AuthCallbackPage />
}

/**
 * Rota de retorno do login (`/auth/callback`). Montada em dois pontos com a mesma tela: no host `app` (equipe) e
 * no host de locadora (cliente).
 */
export function AuthCallbackRoute() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <CallbackRoute />
    </Suspense>
  )
}
