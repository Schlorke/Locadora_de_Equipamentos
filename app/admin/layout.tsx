import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import AdminLayoutClient from './admin-layout-client'

export const viewport: Viewport = {
  // iOS Safari usa esse valor para colorir status/address bar no admin.
  themeColor: '#334155',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  other: {
    // Evita alternância para preto no Safari quando combinado com barras translúcidas.
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

interface AdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
