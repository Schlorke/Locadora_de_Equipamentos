import {
  consumeRateLimitWindow,
  platformRateLimitDigest,
  prismaRateLimitCounter,
} from '../directory/index'
import type { PlatformTransaction } from '../platform-scope/index'
import { OnboardingError } from './errors'

export function createOnboardingSlugLimit(ports: {
  transaction: PlatformTransaction
  secret: string
  now?: () => Date
}) {
  if (Buffer.byteLength(ports.secret, 'utf8') < 32)
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
  return async (ip: string | null) => {
    const now = (ports.now ?? (() => new Date()))().getTime()
    const decision = await ports.transaction((tx) =>
      consumeRateLimitWindow(
        prismaRateLimitCounter(tx),
        [
          'onboarding-slug',
          platformRateLimitDigest(ports.secret, 'ip', ip ?? 'unknown'),
        ],
        { windowMs: 60_000, max: 30 },
        now
      )
    )
    if (!decision.allowed)
      throw new OnboardingError(
        429,
        'ONBOARDING_RATE_LIMITED',
        Math.max(1, Math.ceil((decision.resetTime - now) / 1000))
      )
  }
}

/** Attempts commit independently of provisioning, including rejected attempts. No clear IP/user keys. */
export function createOnboardingCreationLimit(ports: {
  transaction: PlatformTransaction
  secret: string
  now?: () => Date
}) {
  if (Buffer.byteLength(ports.secret, 'utf8') < 32)
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
  return async (userId: string, ip: string | null) => {
    const now = (ports.now ?? (() => new Date()))().getTime()
    const expiresAt = new Date((Math.floor(now / 86_400_000) + 1) * 86_400_000)
    const allowed = await ports.transaction(async (tx) => {
      const counts = []
      for (const [kind, value, max] of [
        ['user', userId, 3],
        ['ip', ip ?? 'unknown', 5],
      ] as const) {
        const decision = await consumeRateLimitWindow(
          prismaRateLimitCounter(tx),
          [
            'onboarding-create',
            kind,
            platformRateLimitDigest(ports.secret, kind, value),
          ],
          { windowMs: 86_400_000, max },
          now
        )
        counts.push(decision.allowed)
      }
      return counts.every(Boolean)
    })
    if (!allowed)
      throw new OnboardingError(
        429,
        'ONBOARDING_RATE_LIMITED',
        Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))
      )
  }
}
