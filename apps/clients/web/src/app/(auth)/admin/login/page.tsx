'use client'

import { ADMIN_LOGIN_REDIRECT, AdminLoginPage } from '@gb-locacoes/frontend/pages/admin-login'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

/**
 * Entrada da equipe (/admin sem sessão e "Sair" do painel): segue para o login da equipe deste host, como o host
 * anterior fazia. O `callbackUrl` vai junto; o login só o aceita dentro do painel.
 */
function AdminLoginRoute() {
  const router = useRouter()
  const callbackUrl = useSearchParams().get('callbackUrl')
  useEffect(() => {
    router.replace(
      callbackUrl ? `${ADMIN_LOGIN_REDIRECT}?callbackUrl=${encodeURIComponent(callbackUrl)}` : ADMIN_LOGIN_REDIRECT
    )
  }, [router, callbackUrl])
  return <AdminLoginPage />
}

export default function Page() {
  return (
    <Suspense fallback={<AdminLoginPage />}>
      <AdminLoginRoute />
    </Suspense>
  )
}
