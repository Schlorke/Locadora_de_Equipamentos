'use client'

import {
  AdminIndexPage,
  resolveAdminIndexRedirect,
} from '@gb-locacoes/frontend/pages/admin-entrada'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Page() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    const redirectTimer = setTimeout(() => {
      const href = resolveAdminIndexRedirect(
        status,
        Boolean(session)
      )
      if (href) router.push(href)
    }, 300)

    return () => clearTimeout(redirectTimer)
  }, [session, status, router])

  return <AdminIndexPage />
}
