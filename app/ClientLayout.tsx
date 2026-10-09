'use client'

import { ServiceWorkerRegister } from './service-worker-register'
import { ClientLayoutShell } from '@gb-locacoes/frontend/app'
import dynamic from 'next/dynamic'
import React, { Suspense } from 'react'

// Lazy load do scroll-reveal-init para reduzir bundle inicial e TBT.
// Host-only: sincroniza o carrossel 3D via evento scrollRevealReady.
const ScrollRevealInit = dynamic(
  () => import('./scroll-reveal-init'),
  {
    ssr: false,
  }
)

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientLayoutShell
      publicExtras={
        <Suspense fallback={null}>
          <ScrollRevealInit />
        </Suspense>
      }
      hostExtras={<ServiceWorkerRegister />}
    >
      {children}
    </ClientLayoutShell>
  )
}
