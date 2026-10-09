import { Prisma } from '@prisma/client'
import type { PlatformTransaction } from '../../platform-scope/index'
import type { OutboxMessage, OutboxRepository } from '../contracts'

type PlatformOutboxMessage = OutboxMessage<string | null>
type EnqueuePlatformOutboxInput = {
  tenantId?: string | null
  topic: string
  aggregateId: string
  payload: Prisma.InputJsonValue
  dedupeKey: string
  availableAt?: Date
}

export async function enqueuePlatformOutbox(
  tx: Prisma.TransactionClient,
  input: EnqueuePlatformOutboxInput
) {
  if (
    !input.topic.trim() ||
    !input.aggregateId.trim() ||
    !input.dedupeKey.trim()
  )
    throw new Error(
      'Platform outbox requires topic, aggregate and deduplication key'
    )
  const event = await tx.platformOutboxEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: { ...input, tenantId: input.tenantId ?? null },
    // Prisma's empty-update upsert can fall back to SELECT + INSERT and race.
    // A no-op key update enables PostgreSQL ON CONFLICT while preserving the original event.
    update: { dedupeKey: input.dedupeKey },
  })
  if (
    event.topic !== input.topic ||
    event.aggregateId !== input.aggregateId ||
    event.tenantId !== (input.tenantId ?? null)
  )
    throw new Error('PLATFORM_OUTBOX_DEDUPE_CONFLICT')
  return event
}

/** Only installed topics are claimable. A future consumer must not become UNKNOWN_TOPIC/FAILED. */
export function createPlatformOutboxRepository(
  transaction: PlatformTransaction,
  topics: readonly string[]
): OutboxRepository<string | null> {
  const allowed = [...new Set(topics)]
  if (allowed.some((topic) => !topic.trim()))
    throw new Error('Platform outbox topic is required')
  return {
    claim(workerId, now, leaseMs) {
      if (!workerId.trim() || !Number.isFinite(leaseMs) || leaseMs <= 0)
        throw new Error('Valid platform worker and lease are required')
      if (allowed.length === 0) return Promise.resolve(null)
      return transaction(async (tx) => {
        const rows = await tx.$queryRaw<PlatformOutboxMessage[]>`
          UPDATE platform_outbox_events SET status='PROCESSING', attempts=attempts+1,
            "lockedBy"=${workerId}, "lockedUntil"=${new Date(now.getTime() + leaseMs)}
          WHERE id=(
            SELECT id FROM platform_outbox_events
            WHERE topic IN (${Prisma.join(allowed)}) AND (
              (status='PENDING' AND "availableAt"<=${now}) OR
              (status='PROCESSING' AND "lockedUntil"<=${now})
            ) ORDER BY "availableAt", "createdAt", id
            FOR UPDATE SKIP LOCKED LIMIT 1
          ) RETURNING id, "tenantId", topic, "aggregateId", payload, "dedupeKey", attempts, "lockedBy"
        `
        return rows[0] ?? null
      })
    },
    complete(message, now) {
      return transaction(async (tx) => {
        const result = await tx.platformOutboxEvent.updateMany({
          where: {
            id: message.id,
            status: 'PROCESSING',
            lockedBy: message.lockedBy,
            attempts: message.attempts,
          },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            lockedBy: null,
            lockedUntil: null,
            lastError: null,
          },
        })
        return result.count === 1
      })
    },
    fail(message, code, availableAt, terminal) {
      return transaction(async (tx) => {
        const result = await tx.platformOutboxEvent.updateMany({
          where: {
            id: message.id,
            status: 'PROCESSING',
            lockedBy: message.lockedBy,
            attempts: message.attempts,
          },
          data: {
            status: terminal ? 'FAILED' : 'PENDING',
            availableAt,
            lockedBy: null,
            lockedUntil: null,
            lastError: /^[A-Z0-9_]{1,80}$/.test(code)
              ? code
              : 'DELIVERY_FAILED',
          },
        })
        return result.count === 1
      })
    },
  }
}
