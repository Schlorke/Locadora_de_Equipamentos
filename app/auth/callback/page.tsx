'use client'

import {
  AuthCallbackLoading,
  AuthCallbackPage,
  resolveAuthCallbackRedirect,
} from '@gb-locacoes/frontend/pages/auth-callback'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect } from 'react'

function AuthCallbackContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')

  const redirectAfterLogin = useCallback(
    (userEmail: string, userRole?: string) => {
      const href = resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: true,
        email: userEmail,
        role: userRole,
        callbackUrl,
      })
      if (href) router.replace(href)
    },
    [callbackUrl, router]
  )

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (session?.user) {
      redirectAfterLogin(
        session.user.email || '',
        session.user.role as string | undefined
      )
    }
  }, [session, status, router, redirectAfterLogin])

  return <AuthCallbackPage />
}

export default function Page() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
