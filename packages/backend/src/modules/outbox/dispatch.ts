import type { OutboxHandler, OutboxRepository } from './contracts'

export class PermanentDeliveryError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/** Provider backoff must also delay the persisted delivery, not just its aggregate. */
export class RetryDeliveryAtError extends Error {
  constructor(
    readonly availableAt: Date,
    code: string
  ) {
    super(code)
  }
}

export async function dispatchOutbox<
  Tenant extends string | null = string,
>(options: {
  repository: OutboxRepository<Tenant>
  handlers: Readonly<Record<string, OutboxHandler<Tenant>>>
  workerId: string
  limit?: number
  budgetMs?: number
  minRemainingMs?: number
  now?: () => Date
}) {
  const clock = options.now ?? (() => new Date())
  const startedAt = clock().getTime()
  const result = { completed: 0, retried: 0, failed: 0, lostLease: 0 }
  const limit = options.limit ?? 10
  for (let index = 0; index < limit; index += 1) {
    if (
      (options.budgetMs ?? 40000) - (clock().getTime() - startedAt) <=
      (options.minRemainingMs ?? 0)
    )
      break
    const message = await options.repository.claim(
      options.workerId,
      clock(),
      300000
    )
    if (!message) break
    try {
      const handler = options.handlers[message.topic]
      if (!handler) throw new PermanentDeliveryError('UNKNOWN_TOPIC')
      await handler(message)
      if (await options.repository.complete(message, clock()))
        result.completed += 1
      else result.lostLease += 1
    } catch (error) {
      const terminal =
        error instanceof PermanentDeliveryError || message.attempts >= 8
      // Error text may contain provider credentials or personal data. Persist codes only.
      const code =
        error instanceof PermanentDeliveryError ? error.code : 'DELIVERY_FAILED'
      const delay = Math.min(3600000, 1000 * 2 ** message.attempts)
      const saved = await options.repository.fail(
        message,
        code,
        new Date(
          Math.max(
            clock().getTime() + delay,
            error instanceof RetryDeliveryAtError
              ? error.availableAt.getTime()
              : 0
          )
        ),
        terminal
      )
      if (!saved) result.lostLease += 1
      else if (terminal) result.failed += 1
      else result.retried += 1
    }
  }
  return result
}
