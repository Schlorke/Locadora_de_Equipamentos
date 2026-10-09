'use client'

import { ADMIN_LOGIN_REDIRECT, AdminLoginPage } from '@gb-locacoes/frontend/pages/admin-login'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace(ADMIN_LOGIN_REDIRECT)
  }, [router])

  return <AdminLoginPage />
}
