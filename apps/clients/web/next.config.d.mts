// Tipos de next.config.mjs para os testes do host web (src/host/routing/next-config.test.ts).
import type { NextConfig } from 'next'

export interface PlatformBuildEnv {
  readonly environment: 'development' | 'preview' | 'staging' | 'production'
  readonly rootDomain: string
  readonly protocol: 'http' | 'https'
  readonly publicPort: number | null
}
export declare function readPlatformBuildEnv(
  env: Readonly<Record<string, string | undefined>>
): PlatformBuildEnv
export declare function createNextConfig(
  env?: Readonly<Record<string, string | undefined>>
): NextConfig
export interface RemoteImagePattern {
  readonly protocol: 'https'
  readonly hostname: string
}
export declare function readImageRemotePatterns(
  env: Readonly<Record<string, string | undefined>>
): RemoteImagePattern[]
export declare function tenantContentSecurityPolicy(options: {
  readonly development: boolean
}): string
declare const nextConfig: NextConfig
export default nextConfig
