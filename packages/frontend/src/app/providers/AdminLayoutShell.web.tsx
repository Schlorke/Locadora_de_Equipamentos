'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AdminDesktopHeader,
  AdminMobileHeader,
} from '../../widgets/cabecalho-admin-barra'
import { AdminSidebar, MobileSidebar } from '../../widgets/menu-admin'
import { useVisiblePathname } from '../../shared/lib/navigation/use-visible-pathname.web'
import { usePrivateAreaHeader } from './RuntimeBootstrap'

/** Composição visual do painel. Autenticação e seleção pertencem aos gates do host. */
export function AdminLayoutShell({ children }: { children: ReactNode }) {
  const pathname = useVisiblePathname()
  const privateHeader = usePrivateAreaHeader()
  const main = useRef<HTMLElement>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    document.body.classList.add('admin-body-layout')
    return () => document.body.classList.remove('admin-body-layout')
  }, [])
  useEffect(() => {
    main.current?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  if (pathname === '/admin/login') return <>{children}</>
  return (
    <div className="flex w-full h-screen overflow-hidden bg-[var(--surface-admin-canvas)]">
      <AdminSidebar
        onCollapseChange={setIsSidebarCollapsed}
        isCollapsed={isSidebarCollapsed}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0 relative z-[var(--layer-inset)]">
        <AdminMobileHeader onMenuOpen={() => setIsMobileMenuOpen(true)} />
        <MobileSidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <AdminDesktopHeader isSidebarCollapsed={isSidebarCollapsed} />
        <main
          ref={main}
          className="flex-1 overflow-y-auto overflow-x-hidden max-w-full pt-16 bg-[var(--surface-admin-canvas)]"
        >
          {privateHeader}
          {children}
        </main>
      </div>
    </div>
  )
}
