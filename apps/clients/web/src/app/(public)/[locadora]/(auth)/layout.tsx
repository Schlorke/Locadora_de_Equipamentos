import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { tenantAccountEnabled } from '../../../../host/auth/mode'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Entrada e cadastro do cliente no host da locadora. Em `legacy` (NextAuth) ficam ocultos (desenho 4.6). */
export default function TenantAuthLayout({ children }: { children: ReactNode }) {
  if (!tenantAccountEnabled()) notFound()
  return <>{children}</>
}
