'use client'
import { createContext, useContext, type ReactNode } from 'react'

/**
 * Caminho visível a partir do caminho que o roteador informa.
 *
 * No host de locadora o proxy reescreve `/{caminho}` para o segmento interno `/{slug}{caminho}`.
 * Conforme a renderização, o roteador pode devolver qualquer um dos dois (no servidor o caminho
 * interno, no navegador o visível). Tirar o prefixo nos dois lados dá o mesmo texto no servidor e
 * no cliente, o que evita divergência de hidratação e `callbackUrl` com caminho interno.
 *
 * É determinístico porque o slug de locadora nunca coincide com um segmento de primeiro nível de
 * rota visível: esses segmentos são reservados (`reservedSubdomains` em `@gb-locacoes/contracts`).
 */
export function toVisiblePathname(pathname: string, internalPrefix: string | null | undefined): string {
  if (!internalPrefix) return pathname
  if (pathname === internalPrefix) return '/'
  if (pathname.startsWith(internalPrefix + '/')) return pathname.slice(internalPrefix.length)
  return pathname
}

/** Prefixo interno do segmento de locadora (`/{slug}`), ou `null` fora do modo host. */
export function internalRoutePrefixOf(tenantSlug: string | null | undefined): string | null {
  return tenantSlug ? '/' + tenantSlug : null
}

const InternalRoutePrefixContext = createContext<string | null>(null)

/** Informa aos componentes o prefixo interno de rewrite da árvore atual (modo host). */
export function InternalRoutePrefixProvider({ prefix, children }: { prefix: string | null | undefined; children: ReactNode }) {
  return <InternalRoutePrefixContext.Provider value={prefix ?? null}>{children}</InternalRoutePrefixContext.Provider>
}

export function useInternalRoutePrefix(): string | null {
  return useContext(InternalRoutePrefixContext)
}
