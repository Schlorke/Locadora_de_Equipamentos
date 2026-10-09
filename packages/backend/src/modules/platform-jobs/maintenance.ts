import type { PlatformScope } from '../platform-scope/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import { purgeExpiredPlatformRateLimits } from '../directory/index'

const TOPIC = 'platform.rate-limits.purge'

/** Reuses the existing expiry/grace policy. Registration is not a second scheduler. */
export function createPlatformMaintenance(scope: PlatformScope, now: Date) {
  return {
    enqueue: () =>
      scope.withPlatformTransaction((tx) =>
        enqueuePlatformOutbox(tx, {
          topic: TOPIC,
          aggregateId: 'platform-rate-limits',
          dedupeKey: TOPIC + ':' + Math.floor(now.getTime() / 60_000),
          payload: {},
          availableAt: now,
        })
      ),
    handlers: {
      [TOPIC]: async () => {
        await scope.withPlatformTransaction((tx) =>
          purgeExpiredPlatformRateLimits(tx, now.getTime())
        )
      },
    },
  }
}
