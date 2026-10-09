import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryIdempotencyCache } from '../../packages/backend/src/http/memory-idempotency'

afterEach(() => vi.useRealTimers())
describe('legacy idempotency cache composition', () => {
  it('keeps the five-minute boundary and discards expired results', () => {
    vi.useFakeTimers()
    const cache = createMemoryIdempotencyCache()
    cache.storeIdempotency('alfa:operator:send:key', { success: true })
    vi.advanceTimersByTime(299_999)
    expect(cache.checkIdempotency('alfa:operator:send:key')).toEqual({
      success: true,
    })
    vi.advanceTimersByTime(1)
    expect(cache.checkIdempotency('alfa:operator:send:key')).toBeNull()
  })
  it('keeps composition stores independent and ignores absent keys', () => {
    const legacy = createMemoryIdempotencyCache(),
      service = createMemoryIdempotencyCache()
    legacy.storeIdempotency('same-key', { success: true })
    expect(service.checkIdempotency('same-key')).toBeNull()
    legacy.storeIdempotency(null, { success: true })
    expect(legacy.checkIdempotency(null)).toBeNull()
    expect(legacy.checkIdempotency(undefined)).toBeNull()
    expect(legacy.checkIdempotency('')).toBeNull()
  })
})
