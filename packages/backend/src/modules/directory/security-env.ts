import {
  resolvePlatformEnv,
  type PlatformEnvSource,
} from '@gb-locacoes/contracts/platform'
import { platformRateLimitSecret } from './rate-limit'

/**
 * Production as the rest of the platform decides it: the environment of
 * `resolvePlatformEnv` (explicit `PLATFORM_ENV`, else `VERCEL_ENV`, else
 * `NODE_ENV`), the same function that makes PLATFORM_EDGE_SECRET mandatory.
 * A Vercel preview or a local `next start` with `PLATFORM_ENV=development` is
 * not production; `PLATFORM_ENV=production` is, whatever `NODE_ENV` says.
 * When the platform environment is invalid it cannot tell, so any production
 * signal counts (fails closed).
 */
export function isPlatformProduction(
  env: PlatformEnvSource = process.env
): boolean {
  try {
    return resolvePlatformEnv(env).environment === 'production'
  } catch {
    return [env.PLATFORM_ENV, env.VERCEL_ENV, env.NODE_ENV].some(
      (value) => value?.trim() === 'production'
    )
  }
}

/**
 * `PLATFORM_RATE_LIMIT_SECRET` for the identity windows, required in
 * production by `isPlatformProduction` (never by `NODE_ENV` alone).
 */
export function identityRateLimitSecret(
  env: PlatformEnvSource = process.env
): string {
  return platformRateLimitSecret({
    PLATFORM_RATE_LIMIT_SECRET: env.PLATFORM_RATE_LIMIT_SECRET,
    NODE_ENV: isPlatformProduction(env) ? 'production' : 'development',
  })
}
