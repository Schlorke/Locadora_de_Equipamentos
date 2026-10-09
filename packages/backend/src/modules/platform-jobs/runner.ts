import type { PlatformScope } from '../platform-scope/index'
import { createPlatformOutboxRepository } from '../outbox/index'
import { dispatchOutbox } from '../outbox/dispatch'
import type { OutboxHandler } from '../outbox/contracts'

export function createPlatformJobs(options: {
  scope: PlatformScope
  handlers: Readonly<Record<string, OutboxHandler<string | null>>>
  workerId: () => string
  now?: () => Date
  limit?: number
  budgetMs?: number
  minRemainingMs?: number
}) {
  const handlers = Object.freeze(
    Object.assign(Object.create(null), options.handlers)
  ) as Readonly<Record<string, OutboxHandler<string | null>>>
  const topics = Object.keys(handlers)
  if (
    topics.some(
      (topic) => !topic.trim() || typeof handlers[topic] !== 'function'
    )
  )
    throw new Error('Platform jobs require named handlers')
  const repository = createPlatformOutboxRepository(
    options.scope.withPlatformTransaction,
    topics
  )
  return async () => {
    // Even an empty registry validates isolation, instead of reporting a false healthy configuration.
    await options.scope.withPlatformTransaction(async () => null)
    const result = await dispatchOutbox({
      repository,
      handlers,
      workerId: options.workerId(),
      now: options.now,
      limit: options.limit ?? 25,
      budgetMs: options.budgetMs ?? 180_000,
      minRemainingMs: options.minRemainingMs ?? 60_000,
    })
    return { success: true, ...result, registeredTopics: topics.length }
  }
}
