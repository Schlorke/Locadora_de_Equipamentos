'use client'

import { ResetPasswordPage } from '@gb-locacoes/frontend/pages/reset-password'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ResetPasswordRoute() {
  const searchParams = useSearchParams()
  const token = (searchParams.get('token') || '').trim()
  return <ResetPasswordPage token={token} />
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
      <ResetPasswordRoute />
    </Suspense>
  )
}
