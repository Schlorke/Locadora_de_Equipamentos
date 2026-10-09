interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitWindow {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

interface RateLimitOptions<TRequest> extends RateLimitWindow {
  keyGenerator?: (_request: TRequest) => string
  /** Keys this limiter alone may track; defaults to `MAX_RATE_LIMIT_ENTRIES`. */
  maxEntries?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  error?: string
}

/** Upper bound on tracked keys per store (roughly 10 MB). */
export const MAX_RATE_LIMIT_ENTRIES = 50_000

/**
 * Fixed-window counters kept in memory for the generic request limiters
 * (`rateLimit`, `consumeRateLimit`): each server instance has its own. The
 * identity limiters below use `platform_rate_limits` instead, which never
 * evicts a live window.
 * Keys are bounded in number; when full, expired windows go first and then
 * the oldest ones, so a flood of new keys cannot grow the process heap
 * (evicted counters start over: the bound favors availability). Every
 * limiter built by `rateLimit` owns one store, so a flood only ever evicts
 * windows of the limiter it hits.
 */
export class MemoryRateLimitStore {
  // Map keeps attacker-influenced keys away from Object.prototype.
  private readonly entries = new Map<string, RateLimitEntry>()
  private lastFullSweep = Number.NEGATIVE_INFINITY
  private readonly maxEntries: number

  constructor(maxEntries: number = MAX_RATE_LIMIT_ENTRIES) {
    this.maxEntries = maxEntries
  }

  get size(): number {
    return this.entries.size
  }

  keys(): string[] {
    return [...this.entries.keys()]
  }

  /** Counts one hit and returns the window it landed in. */
  hit(key: string, windowMs: number, now: number): RateLimitEntry {
    let entry = this.entries.get(key)
    if (!entry || now > entry.resetTime) {
      // Re-inserted so iteration order follows window start.
      this.entries.delete(key)
      this.makeRoom(now)
      entry = { count: 0, resetTime: now + windowMs }
      this.entries.set(key, entry)
    }
    entry.count++
    return entry
  }

  consume(key: string, window: RateLimitWindow, now: number): RateLimitResult {
    const current = this.entries.get(key)
    if (
      current &&
      now <= current.resetTime &&
      current.count >= window.maxRequests
    )
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime,
        error: 'Rate limit exceeded',
      }
    const entry = this.hit(key, window.windowMs, now)
    return {
      allowed: true,
      remaining: window.maxRequests - entry.count,
      resetTime: entry.resetTime,
    }
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  deleteByPrefix(prefix: string): void {
    for (const key of [...this.entries.keys()])
      if (key.startsWith(prefix)) this.entries.delete(key)
  }

  sweep(now: number): void {
    for (const [key, entry] of this.entries)
      if (now > entry.resetTime) this.entries.delete(key)
  }

  private makeRoom(now: number): void {
    if (this.entries.size < this.maxEntries) return
    // A full sweep at most once per second keeps a flood from costing O(n) per hit.
    if (now - this.lastFullSweep >= 1000) {
      this.lastFullSweep = now
      this.sweep(now)
    }
    // Still full: drop the windows that started first.
    for (const key of this.entries.keys()) {
      if (this.entries.size < this.maxEntries) return
      this.entries.delete(key)
    }
  }
}

function consumeFrom(
  target: MemoryRateLimitStore,
  key: string,
  window: RateLimitWindow,
  now: number
): RateLimitResult {
  // Clean up expired entries periodically (1% of the calls).
  if (Math.random() < 0.01) target.sweep(now)
  return target.consume(key, window, now)
}

/** Each host composition owns independent process-local counters. No database I/O. */
export function createMemoryRateLimiters<
  TRequest extends { headers: Headers },
>(dependencies: { clientIp: (_headers: Headers) => string | null }) {
  const store = new MemoryRateLimitStore()
  /**
   * Consumes one attempt for an explicit key using a fixed window.
   * State is in memory: each server instance keeps its own counters.
   */
  function consumeRateLimit(
    key: string,
    window: RateLimitWindow,
    now: number = Date.now()
  ): RateLimitResult {
    return consumeFrom(store, key, window, now)
  }

  /**
   * Simple in-memory rate limiter. Each limiter is one scope with its own
   * bounded store: two limiters never share a counter for the same key (the
   * client IP), and new keys on one never evict another's windows.
   * For production, consider using Redis or a dedicated service
   */
  function rateLimit(options: RateLimitOptions<TRequest>) {
    const {
      windowMs,
      maxRequests,
      keyGenerator = (req) => dependencies.clientIp(req.headers) || 'anonymous',
      maxEntries,
    } = options
    const scope = new MemoryRateLimitStore(maxEntries)

    return (request: TRequest, now: number = Date.now()): RateLimitResult =>
      consumeFrom(scope, keyGenerator(request), { windowMs, maxRequests }, now)
  }

  /**
   * Pre-configured rate limiters for common use cases
   */
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
  })

  const apiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })

  const adminApiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute for admin operations
  })

  const strictRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute for sensitive operations
  })

  /**
   * Helper to check rate limit and return appropriate response
   */
  function checkRateLimit(
    request: TRequest,
    limiter: (_req: TRequest) => RateLimitResult
  ): {
    allowed: boolean
    response?: Response
    headers: Record<string, string>
  } {
    const result = limiter(request)

    const headers = {
      'X-RateLimit-Limit': String(
        limiter === authRateLimit
          ? 5
          : limiter === apiRateLimit
            ? 100
            : limiter === adminApiRateLimit
              ? 200
              : 10
      ),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    }

    if (!result.allowed) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(
                Math.ceil((result.resetTime - Date.now()) / 1000)
              ),
              ...headers,
            },
          }
        ),
        headers,
      }
    }

    return { allowed: true, headers }
  }
  return {
    consumeRateLimit,
    rateLimit,
    authRateLimit,
    apiRateLimit,
    adminApiRateLimit,
    strictRateLimit,
    checkRateLimit,
  }
}
