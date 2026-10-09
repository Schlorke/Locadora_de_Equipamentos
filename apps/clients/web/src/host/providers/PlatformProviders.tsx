'use client'
import type { ReactNode } from 'react'
import { AppProviders } from '@gb-locacoes/frontend/app'
import { hostApiClient, useHostNavigate } from './host-navigation'

const sameHref = (href: string) => href

/**
 * Providers do apex (`<raiz>`): páginas da plataforma, sem locadora e sem sessão. Não monta o shell da vitrine
 * (cabeçalho, rodapé e WhatsApp dependem de uma locadora).
 */
export function PlatformProviders({ children }: { children: ReactNode }) {
  const navigate = useHostNavigate(sameHref)
  return (
    <AppProviders apiClient={hostApiClient} navigate={navigate}>
      {children}
    </AppProviders>
  )
}
