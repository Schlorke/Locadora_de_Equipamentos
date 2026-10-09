'use client'

// Patch imediato para Three.js warnings que disparam em layout effects (antes do
// useEffect + requestIdleCallback). Clock deprecation e WebGL Context Lost vêm
// de @react-three/fiber/Three.js e aparecem assim que o Canvas monta.
if (typeof window !== 'undefined') {
  const _origWarn = console.warn
  console.warn = (...args: unknown[]) => {
    const msg = args
      .map((a) => (typeof a === 'string' ? a : String(a)))
      .join(' ')
      .toLowerCase()
    if (
      msg.includes('three') &&
      msg.includes('clock') &&
      (msg.includes('deprecated') || msg.includes('timer'))
    )
      return
    if (msg.includes('webglrenderer') && msg.includes('context lost')) return
    _origWarn.apply(console, args)
  }
}

import { Toaster } from '@gb-locacoes/ui'
import React, { useEffect, type ReactNode } from 'react'
import { useVisiblePathname } from '../../shared/lib/navigation/use-visible-pathname.web'
import { Header } from '../../widgets/cabecalho'
import { PlatformShell } from '../../widgets/casca-plataforma'
import Footer from '../../widgets/rodape'
import WhatsAppFAB from '../../widgets/whatsapp-flutuante'
import { PrivateAreaGate } from './RuntimeBootstrap'

export interface ClientLayoutShellProps {
  children: ReactNode
  /** Host-only: ScrollRevealInit (sincroniza carrossel 3D). Colocado só fora de /admin. */
  publicExtras?: ReactNode
  /** Host-only: ServiceWorkerRegister e similares. Sempre montados. */
  hostExtras?: ReactNode
  /**
   * Host-only: moldura escolhida pelo host. `storefront` (padrão): cabeçalho, rodapé e WhatsApp da vitrine, mais os
   * `publicExtras`, fora de /admin. `platform`: a casca mínima da plataforma (fluxos de conta da equipe no host
   * `app`), sem nada da vitrine, em toda rota do layout (inclusive /admin/login, que só redireciona ao /login): a
   * árvore da rota não muda de lugar ao navegar entre elas. `none`: sem moldura nenhuma; a página traz a própria
   * (vitrine em pausa, S13: sem navegação para catálogo, orçamento, carrinho ou busca).
   */
  chrome?: 'storefront' | 'platform' | 'none'
}

export function ClientLayoutShell({
  children,
  publicExtras,
  hostExtras,
  chrome = 'storefront',
}: ClientLayoutShellProps) {
  const pathname = useVisiblePathname()
  const isAdminRoute = pathname?.startsWith('/admin') || false
  const storefront = !isAdminRoute && chrome === 'storefront'
  const platform = chrome === 'platform'

  useEffect(() => {
    if (typeof document === 'undefined') return

    const ensureMetaTag = (name: string) => {
      const existingTags = document.head.querySelectorAll(
        `meta[name="${name}"]`
      )
      const primaryTag = existingTags[0] as HTMLMetaElement | undefined

      // Evita múltiplas tags concorrentes para o mesmo meta no iOS Safari.
      if (existingTags.length > 1) {
        for (let i = 1; i < existingTags.length; i += 1) {
          existingTags[i]?.remove()
        }
      }

      if (primaryTag) return primaryTag

      const newTag = document.createElement('meta')
      newTag.setAttribute('name', name)
      document.head.appendChild(newTag)
      return newTag
    }

    const themeColorTag = ensureMetaTag('theme-color')
    const statusBarTag = ensureMetaTag('apple-mobile-web-app-status-bar-style')
    const htmlElement = document.documentElement

    if (isAdminRoute) {
      themeColorTag.setAttribute(
        'content',
        '#334155' // token-check-allow: slate-700 theme-color admin (iOS status bar)
      )
      statusBarTag.setAttribute('content', 'default')
      htmlElement.style.backgroundColor = '#334155' // token-check-allow: slate-700 fundo admin (iOS Safari)
      return
    }

    themeColorTag.setAttribute(
      'content',
      '#ffffff' // token-check-allow: branco theme-color público (iOS status bar)
    )
    statusBarTag.setAttribute('content', 'black-translucent')
    htmlElement.style.backgroundColor = ''
  }, [isAdminRoute])

  // Suprimir warning de depreciação do Zustand vindo de dependências externas
  // (Vercel Analytics/Speed Insights ainda usam sintaxe antiga internamente)
  // 🚀 OTIMIZADO: Defer execução para reduzir TBT - executa após idle
  useEffect(() => {
    if (typeof window === 'undefined') {
      return // Early return para SSR - não fazer nada no servidor
    }

    // Defer execução usando requestIdleCallback (ou setTimeout fallback)
    // Isso reduz o impacto no TBT (Total Blocking Time)
    let cleanup: (() => void) | null = null

    const setupConsoleInterception = () => {
      // Interceptar console.warn de forma mais robusta
      const originalWarn = console.warn
      const originalError = console.error
      const originalLog = console.log

      const shouldSuppress = (...args: unknown[]): boolean => {
        // Converte todos os argumentos para string e junta
        const fullMessage = args
          .map((arg) => {
            if (typeof arg === 'string') return arg
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg)
              } catch {
                return String(arg)
              }
            }
            return String(arg)
          })
          .join(' ')
          .toLowerCase()

        // Google Maps ECL: warning de depreciação do Autocomplete (biblioteca de terceiros)
        if (
          fullMessage.includes('google.maps.places.autocomplete') &&
          (fullMessage.includes('placeautocompleteelement') ||
            fullMessage.includes('march 1st, 2025'))
        ) {
          return true
        }

        // THREE.Clock deprecation: @react-three/fiber usa Clock internamente;
        // migração para Timer depende de atualização da biblioteca
        if (
          fullMessage.includes('three') &&
          fullMessage.includes('clock') &&
          (fullMessage.includes('deprecated') || fullMessage.includes('timer'))
        ) {
          return true
        }

        // WebGL Context Lost: ocorre em dev com HMR ou ao trocar de aba
        if (
          fullMessage.includes('webglrenderer') &&
          fullMessage.includes('context lost')
        ) {
          return true
        }

        // Verifica múltiplos padrões para capturar todas as variações do Zustand
        const patterns = [
          '[deprecated]',
          'deprecated',
          'default export',
          'default export is deprecated',
          'import { create }',
          'zustand',
        ]

        // Deve conter pelo menos 3 dos padrões para ser o warning do Zustand
        const matches = patterns.filter((pattern) =>
          fullMessage.includes(pattern)
        ).length

        return matches >= 3 && fullMessage.includes('zustand')
      }

      console.warn = (...args: unknown[]) => {
        if (shouldSuppress(...args)) {
          return // Não exibir este warning
        }
        originalWarn.apply(console, args)
      }

      // Também verificar console.error caso o warning seja emitido como erro
      console.error = (...args: unknown[]) => {
        if (shouldSuppress(...args)) {
          return // Não exibir este warning
        }
        originalError.apply(console, args)
      }

      // Alguns warnings podem vir como console.log
      console.log = (...args: unknown[]) => {
        if (shouldSuppress(...args)) {
          return // Não exibir este warning
        }
        originalLog.apply(console, args)
      }

      cleanup = () => {
        console.warn = originalWarn
        console.error = originalError
        console.log = originalLog
      }
    }

    // Defer usando requestIdleCallback (executa quando o browser está idle)
    // Fallback para setTimeout se requestIdleCallback não estiver disponível
    if ('requestIdleCallback' in window) {
      const idleCallbackId = requestIdleCallback(setupConsoleInterception, {
        timeout: 2000, // Executar após 2s no máximo se não houver idle time
      })
      return () => {
        cancelIdleCallback(idleCallbackId)
        if (cleanup) cleanup()
      }
    } else {
      // Fallback para setTimeout (executa após próximo tick)
      const timeoutId = setTimeout(setupConsoleInterception, 0)
      return () => {
        clearTimeout(timeoutId)
        if (cleanup) cleanup()
      }
    }
  }, [])

  // Portão da área privada/awaitSession dentro da área: o cabeçalho e o resto do shell continuam montados.
  const area = (
    <PrivateAreaGate headerInContent={isAdminRoute}>{children}</PrivateAreaGate>
  )
  return (
    <div data-scroll-behavior="smooth" suppressHydrationWarning>
      {storefront && <Header />}
      <div
        className={`min-h-screen ${
          storefront
            ? 'pt-[calc(env(safe-area-inset-top,0px)+var(--header-offset))]'
            : ''
        }`}
      >
        {platform ? <PlatformShell>{area}</PlatformShell> : area}
      </div>
      {storefront && <Footer />}
      {storefront && <WhatsAppFAB />}
      {storefront && publicExtras}
      {hostExtras}
      <Toaster />
    </div>
  )
}
