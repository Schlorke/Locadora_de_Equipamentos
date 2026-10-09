'use client'
import { createContext, useContext, type ReactNode } from 'react'

export type HrefResolver = (href: string) => string

const HrefResolverContext = createContext<HrefResolver | null>(null)

/**
 * Resolvedor de href da árvore (o mesmo que o host entrega ao `NavigationProvider`): no modo
 * legado acrescenta `?tenantSlug=`; no modo host é a identidade.
 */
export function HrefResolverProvider({ resolveHref, children }: { resolveHref: HrefResolver | null | undefined; children: ReactNode }) {
  return <HrefResolverContext.Provider value={resolveHref ?? null}>{children}</HrefResolverContext.Provider>
}

/** Resolvedor informado pelo host, ou `null` quando a árvore não tem um. */
export function useHrefResolver(): HrefResolver | null {
  return useContext(HrefResolverContext)
}
