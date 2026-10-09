import type { Prisma, PrismaClient } from '@prisma/client'
import type { OutboxMessage, OutboxRepository } from '../contracts'

export type EnqueueOutboxInput = {
  tenantId: string
  topic: string
  aggregateId: string
  payload: Prisma.InputJsonValue
  dedupeKey: string
}

export async function enqueueOutbox(tx: Prisma.TransactionClient, input: EnqueueOutboxInput) {
  if (!input.tenantId.trim() || !input.topic.trim() || !input.dedupeKey.trim()) {
    throw new Error('Outbox requires tenant, topic and deduplication key')
  }
  const dedupeKey = input.tenantId + ':' + input.dedupeKey
  return tx.outboxEvent.upsert({
    where: { dedupeKey },
    create: { ...input, dedupeKey },
    update: {},
  })
}

export function createPrismaOutboxRepository(prisma: PrismaClient, tenantId: string): OutboxRepository {
  if (!tenantId.trim()) throw new Error('Tenant is required')
  async function scoped<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      return operation(tx)
    })
  }
  return {
    claim(workerId, now, leaseMs) {
      return scoped(async tx => {
        const rows = await tx.$queryRaw<OutboxMessage[]>`
          UPDATE outbox_events SET status = 'PROCESSING', attempts = attempts + 1,
            "lockedBy" = ${workerId}, "lockedUntil" = ${new Date(now.getTime() + leaseMs)}
          WHERE id = (
            SELECT id FROM outbox_events
            WHERE "tenantId" = ${tenantId}
              AND ((status = 'PENDING' AND "availableAt" <= ${now})
                OR (status = 'PROCESSING' AND "lockedUntil" <= ${now}))
            ORDER BY "availableAt", "createdAt"
            FOR UPDATE SKIP LOCKED LIMIT 1
          )
          RETURNING id, "tenantId", topic, "aggregateId", payload, "dedupeKey", attempts, "lockedBy"
        `
        return rows[0] ?? null
      })
    },
    complete(message, now) {
      return scoped(async tx => {
        const result = await tx.outboxEvent.updateMany({
          where: { id: message.id, tenantId, status: 'PROCESSING', lockedBy: message.lockedBy },
          data: { status: 'COMPLETED', completedAt: now, lockedBy: null, lockedUntil: null, lastError: null },
        })
        return result.count === 1
      })
    },
    fail(message, code, availableAt, terminal) {
      return scoped(async tx => {
        const result = await tx.outboxEvent.updateMany({
          where: { id: message.id, tenantId, status: 'PROCESSING', lockedBy: message.lockedBy },
          data: { status: terminal ? 'FAILED' : 'PENDING', availableAt, lockedBy: null, lockedUntil: null, lastError: code },
        })
        return result.count === 1
      })
    },
  }
}
