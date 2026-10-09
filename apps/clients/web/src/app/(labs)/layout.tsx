import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolvePlatformEnv } from '@gb-locacoes/contracts/platform'
import { AppHostProviders } from '../../host/providers/AppHostProviders'

export const metadata: Metadata = { robots: { index: false, follow: false } }
// Avaliado por requisição: a flag vale no ambiente em execução, não no do build.
export const dynamic = 'force-dynamic'

function labsEnabled(): boolean {
  try {
    return resolvePlatformEnv(process.env).labsEnabled
  } catch {
    return false
  }
}

/** Laboratório: só com PLATFORM_LABS_ENABLED=true e fora de produção (o proxy aplica a mesma regra no host app). */
export default function LabsLayout({ children }: { children: ReactNode }) {
  if (!labsEnabled()) notFound()
  return <AppHostProviders>{children}</AppHostProviders>
}
