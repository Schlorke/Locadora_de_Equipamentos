import { describe, expect, it, vi } from 'vitest'
import { dispatchOutbox, RetryDeliveryAtError } from './dispatch'
import type { OutboxMessage, OutboxRepository } from './contracts'

describe('outbox provider backoff', () => {
  it.each([300_000, 500])(
    'keeps the later provider or ordinary retry date (%i ms)',
    async (delay) => {
      const now = new Date('2026-10-03T16:00:00Z')
      const message: OutboxMessage<string | null> = {
        id: 'job',
        tenantId: null,
        topic: 'reconcile',
        aggregateId: 'sub',
        payload: {},
        dedupeKey: 'job',
        attempts: 1,
        lockedBy: 'worker',
      }
      const repository: OutboxRepository<string | null> = {
        claim: vi.fn().mockResolvedValue(message),
        complete: vi.fn(),
        fail: vi.fn().mockResolvedValue(true),
      }
      const result = await dispatchOutbox({
        repository,
        handlers: {
          reconcile: async () => {
            throw new RetryDeliveryAtError(
              new Date(now.getTime() + delay),
              'redacted'
            )
          },
        },
        workerId: 'worker',
        limit: 1,
        now: () => now,
      })
      expect(result).toMatchObject({ retried: 1, failed: 0 })
      expect(repository.complete).not.toHaveBeenCalled()
      expect(repository.fail).toHaveBeenCalledWith(
        message,
        'DELIVERY_FAILED',
        new Date(now.getTime() + Math.max(2000, delay)),
        false
      )
    }
  )
})
