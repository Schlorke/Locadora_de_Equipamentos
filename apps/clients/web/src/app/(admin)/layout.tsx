import type { ReactNode } from 'react'
import { AdminLayoutShell } from '@gb-locacoes/frontend/app'
import { AppHostProviders } from '../../host/providers/AppHostProviders'

/** Painel no host `app` (URLs /admin/** inalteradas). Locadora por seleção explícita e membership. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppHostProviders>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AppHostProviders>
  )
}
