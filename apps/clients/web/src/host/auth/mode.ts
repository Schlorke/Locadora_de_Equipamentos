/**
 * Modo de autenticação do host web (mesma variável de `auth/client.ts`). Em `legacy` (NextAuth), os hosts de
 * locadora escondem login e área do cliente (desenho 4.6): o login por subdomínio exige o Better Auth.
 *
 * A lista de modos, a validação e o `basePath` do Better Auth de cada modo são a regra única de
 * `@gb-locacoes/contracts/platform` (a mesma do app mobile e do backend).
 */
import { parseAuthMode, type AuthMode } from '@gb-locacoes/contracts/platform'

export type HostAuthMode = AuthMode

export function hostAuthMode(env: Readonly<Record<string, string | undefined>> = process.env): HostAuthMode {
  return parseAuthMode(env.NEXT_PUBLIC_AUTH_MODE, 'NEXT_PUBLIC_AUTH_MODE')
}

/** Login e área do cliente existem no host de locadora só fora do modo `legacy`. */
export function tenantAccountEnabled(env?: Readonly<Record<string, string | undefined>>): boolean {
  return hostAuthMode(env) !== 'legacy'
}
