'use client'

import { CadastroPage } from '@gb-locacoes/frontend/pages/cadastro'
import { hostAuth } from '../../../../../host/auth/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'

function CadastroRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const push = useCallback((href: string) => router.push(href), [router])

  return (
    <CadastroPage
      callbackUrl={callbackUrl}
      push={push}
      signInProvider={hostAuth.signInProvider}
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
      <CadastroRoute />
    </Suspense>
  )
}
