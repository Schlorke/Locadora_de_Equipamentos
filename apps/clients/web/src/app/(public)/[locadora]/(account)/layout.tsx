import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AccountLayoutShell } from '@gb-locacoes/frontend/app'
import { tenantAccountEnabled } from '../../../../host/auth/mode'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * Área do cliente no host da locadora. Em `legacy` (NextAuth) fica oculta (desenho 4.6). Fora dele, a moldura da área
 * do cliente (menu lateral, notificações e saída; onda 135, A5), como a raiz legada montava.
 */
export default function TenantAccountLayout({ children }: { children: ReactNode }) {
  if (!tenantAccountEnabled()) notFound()
  return <AccountLayoutShell>{children}</AccountLayoutShell>
}
