import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { AppHostProviders } from '../../host/providers/AppHostProviders'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * Fluxos de conta da equipe no host `app`: /login, /admin/login, /recuperar-senha, /reset-password e /auth/callback.
 * O host `app` é o console da plataforma, não uma vitrine: estas telas usam a casca da plataforma (nome provisório,
 * sem navegação, rodapé e WhatsApp da vitrine, cujos links dão 404 aqui). No host de locadora, as mesmas telas
 * continuam na casca da vitrine.
 */
export default function AppAuthLayout({ children }: { children: ReactNode }) {
  return <AppHostProviders chrome="platform">{children}</AppHostProviders>
}
