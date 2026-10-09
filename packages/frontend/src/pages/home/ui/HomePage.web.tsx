'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import type { LocalBusinessData } from '../../../entities/configuracao'
import { StructuredData } from '../../../widgets/dados-estruturados'
import Hero from '../../../widgets/hero'
import type { HeroInitialSettings } from '../model/hero-settings'

const pulseFallback = <div className="h-96 bg-gray-100 animate-pulse" />

const HomeClienteLazy = dynamic(() => import('../../../widgets/home-cliente'), {
  loading: () => pulseFallback,
})

const PorQueEscolherLazy = dynamic(
  () => import('../../../widgets/por-que-escolher'),
  { loading: () => pulseFallback }
)

const ContatoHomeLazy = dynamic(() => import('../../../widgets/contato-home'), {
  loading: () => pulseFallback,
})

export type HomePageProps = {
  /** LocalBusiness da própria locadora; `null` sem identidade (nenhum padrão de outra locadora). */
  localBusiness: LocalBusinessData | null
  heroInitialSettings: HeroInitialSettings
}

export function HomePage({ localBusiness, heroInitialSettings }: HomePageProps) {
  return (
    <>
      <StructuredData localBusiness={localBusiness} />
      <main>
        <Hero initialSettings={heroInitialSettings} />
        <Suspense fallback={pulseFallback}>
          <HomeClienteLazy />
        </Suspense>
        <Suspense fallback={pulseFallback}>
          <PorQueEscolherLazy />
        </Suspense>
        <Suspense fallback={pulseFallback}>
          <ContatoHomeLazy />
        </Suspense>
      </main>
    </>
  )
}
