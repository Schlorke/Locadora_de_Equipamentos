'use client'

import { AdminLayoutShell } from '@gb-locacoes/frontend/app'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect } from 'react'

interface AdminLayoutClientProps {
  children: ReactNode
}

export default function AdminLayoutClient({
  children,
}: AdminLayoutClientProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (status === 'loading' || isLoginPage) return

    if (!session) {
      router.push('/admin/login')
      return
    }

    // Role property is now correctly typed in session type
    const userRole = session.user?.role
    if (!['ADMIN', 'OPERATOR', 'FINANCIAL'].includes(userRole)) {
      router.push('/admin/login?error=unauthorized')
      return
    }

    if (
      userRole === 'FINANCIAL' &&
      !pathname.startsWith('/admin/financeiro') &&
      pathname !== '/admin/login'
    ) {
      router.push('/admin/financeiro')
    }
  }, [session, status, router, isLoginPage, pathname])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700 mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-slate-600 font-medium text-sm sm:text-base">
            Carregando painel administrativo...
          </p>
        </div>
      </div>
    )
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!session) {
    return null
  }

  return <AdminLayoutShell>{children}</AdminLayoutShell>
}
