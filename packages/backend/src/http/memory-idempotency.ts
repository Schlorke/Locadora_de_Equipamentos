/**
 * Simple in-memory idempotency cache.
 *
 * Stores the result of an operation keyed by a client-provided idempotency
 * token so that retries return the same response without re-executing.
 *
 * For production at scale, consider replacing with Redis.
 */

const IDEMPOTENCY_TTL = 5 * 60 * 1000 // 5 minutes

interface IdempotencyEntry {
  timestamp: number
  response: Record<string, unknown>
}

export function createMemoryIdempotencyCache() {
  const store = new Map<string, IdempotencyEntry>()

  /**
   * Check if an idempotency key has already been processed.
   * Returns the cached response if found and still valid, otherwise null.
   */
  function checkIdempotency(
    key: string | null | undefined
  ): Record<string, unknown> | null {
    if (!key) return null
    const entry = store.get(key)
    if (entry && Date.now() - entry.timestamp < IDEMPOTENCY_TTL) {
      return entry.response
    }
    if (entry) store.delete(key)
    return null
  }

  /**
   * Store the result of an operation for future idempotency checks.
   */
  function storeIdempotency(
    key: string | null | undefined,
    response: Record<string, unknown>
  ): void {
    if (!key) return
    store.set(key, { timestamp: Date.now(), response })

    // Probabilistic cleanup of expired entries (5 % chance)
    if (Math.random() < 0.05) {
      const now = Date.now()
      for (const [k, v] of store) {
        if (now - v.timestamp > IDEMPOTENCY_TTL) store.delete(k)
      }
    }
  }

  return { checkIdempotency, storeIdempotency }
}
