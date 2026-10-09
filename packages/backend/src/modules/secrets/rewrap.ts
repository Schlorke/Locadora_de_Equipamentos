import type { PlatformScope } from '../platform-scope/index'
import { enqueuePlatformOutbox } from '../outbox/index'
import type { createSecretVault } from './vault'

const TOPIC = 'secrets.rewrap'
export function createSecretsRewrap(
  scope: PlatformScope,
  vault: ReturnType<typeof createSecretVault>,
  now: Date
) {
  return {
    enqueue: () =>
      scope.withPlatformTransaction((tx) =>
        enqueuePlatformOutbox(tx, {
          topic: TOPIC,
          aggregateId: 'secret-keyring',
          payload: {},
          availableAt: now,
          dedupeKey: `${TOPIC}:${Math.floor(now.getTime() / 60000)}`,
        })
      ),
    handlers: {
      [TOPIC]: async () => {
        const records = await scope.withPlatformTransaction((tx) =>
          vault.rewrapBatch(tx)
        )
        for (const row of records)
          await scope.withPlatformTransaction((tx) => vault.rewrap(tx, row.id))
      },
    },
  }
}
