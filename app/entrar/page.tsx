'use client'

import { EntrarPage } from '@gb-locacoes/frontend/pages/entrar'
import { getSession, signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'

function EntrarRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const push = useCallback((href: string) => router.push(href), [router])
  const refresh = useCallback(() => router.refresh(), [router])

  return (
    <EntrarPage
      errorParam={errorParam}
      push={push}
      refresh={refresh}
      getSession={async () => getSession()}
      signInCredentials={async (email, password) =>
        signIn('credentials', { redirect: false, email, password })
      }
      signInProvider={async (provider) => {
        await signIn(provider, { callbackUrl: '/auth/callback' })
      }}
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
      <EntrarRoute />
    </Suspense>
  )
}
