'use client'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createHttpClient } from '@gb-locacoes/frontend/app'

/** Cliente HTTP do host web: caminhos relativos (mesma origem); o proxy decide o destino de cada `/api/*`. */
export const hostApiClient = createHttpClient()

const EXTERNAL_HREF = /^(https?:|mailto:|tel:)/i

/** `navigate` entregue ao AppProviders: links externos saem do app; internos passam pelo resolvedor da árvore. */
export function useHostNavigate(resolveHref: (_href: string) => string) {
  const router = useRouter()
  return useCallback(
    (href: string) => {
      if (EXTERNAL_HREF.test(href)) {
        window.location.assign(href)
        return
      }
      router.push(resolveHref(href))
    },
    [router, resolveHref]
  )
}

/** Caminho visível: remove o prefixo interno `/{slug}` do rewrite do host de locadora, se houver. */
export function visiblePathname(pathname: string, internalPrefix: string | null): string {
  if (!internalPrefix) return pathname
  if (pathname === internalPrefix) return '/'
  return pathname.startsWith(internalPrefix + '/') ? pathname.slice(internalPrefix.length) : pathname
}
