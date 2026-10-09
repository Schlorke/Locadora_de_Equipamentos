'use client'
// Único ponto do frontend que lê `usePathname` (exceção da regra no-restricted-imports em eslint.config.js).
import { usePathname } from 'next/navigation'
import { toVisiblePathname, useInternalRoutePrefix } from './visible-pathname'

/**
 * `usePathname` sem o prefixo interno `/{slug}` do segmento de locadora.
 *
 * Use este hook no lugar de `usePathname` em todo o frontend (regra de lint): o resultado é o
 * mesmo no servidor e no navegador, inclusive em página pré-renderizada alcançada por rewrite.
 */
export function useVisiblePathname(): string {
  const pathname = usePathname() ?? '/'
  return toVisiblePathname(pathname, useInternalRoutePrefix())
}
