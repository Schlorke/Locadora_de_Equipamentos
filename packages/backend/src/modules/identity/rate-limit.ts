import {
  consumeRateLimitWindow,
  hitRateLimitWindow,
  platformRateLimitDigest,
  rateLimitKeyPrefix,
  rateLimitWindowAt,
  rateLimitWindowKey,
  type RateLimitCounter,
} from '../directory/rate-limit'
import {
  AUTH_UNAVAILABLE_RETRY_SECONDS,
  normalizeEmail,
  type LegacySignInGuard,
} from './legacy-credentials'

interface RateLimitWindow {
  windowMs: number
  maxRequests: number
}
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  error?: string
}

/**
 * Identity limiters (sign-in, password reset, registration, account notices)
 * keep their windows in `platform_rate_limits`, shared by every instance
 * (ADR docs/architecture/adr-tenant-hosts.md, Lote 7a):
 * - each counted attempt is one atomic upsert; windows are fixed and aligned
 *   to the clock (`rateLimitWindowAt`);
 * - keys hold `HMAC(PLATFORM_RATE_LIMIT_SECRET, value)`, never the raw e-mail
 *   or IP. In production a missing or short secret is a configuration error:
 *   every identity limiter rejects (the flows answer with an error), never a
 *   silent per-instance window. Outside production each process keys with
 *   its own random secret. "Production" is the platform's own criterion
 *   (`isPlatformProduction`, the one that requires PLATFORM_EDGE_SECRET).
 * Generic per-process request limiters belong to `http/memory-rate-limit.ts`.
 */
const MINUTE = 60 * 1000

interface AccountDelayWindow {
  kind: 'delay'
  windowMs: number
  /** Attempts per window answered without delay. */
  freeAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  /**
   * Hard ceiling per window, all clients together. Counted atomically before
   * the password is checked, so parallel attempts past it never reach it.
   */
  maxRequests: number
}
interface AccountLimitWindow extends RateLimitWindow {
  kind: 'limit'
}
interface AuthAttemptPolicy {
  /** Hard window per client IP. */
  ip?: RateLimitWindow
  /** Hard window per (account, client IP): it only ever blocks the requester. */
  accountIp?: RateLimitWindow
  /** Window shared by every client of one account. */
  account?: AccountDelayWindow | AccountLimitWindow
}

/**
 * Legacy credential flows. Hard blocks are keyed by the requester, so nobody
 * can lock someone else out:
 * - sign-in: 20 per IP and 5 per (account, IP) every 15 min. Past 10
 *   attempts per account from all IPs, every attempt waits 0.5 s, doubling up
 *   to 5 s, and the password is still checked. The wait only slows attempts
 *   down; what bounds distributed guessing is the ceiling of 100 per account
 *   from all IPs, counted in the same atomic upsert before the password is
 *   checked, so N parallel attempts never let more than 100 through. Reaching
 *   it holds the account until the window ends, and takes at least 20 client
 *   IPs (5 each).
 * - password-reset: 5 per IP and 3 per (account, IP) every 15 min. The e-mail
 *   budget per account is silent (`consumeAccountNotice`).
 * - register: 10 per IP and 5 per target e-mail every 15 min; it only delays
 *   the creation of that address, never access to an existing account.
 * Without a trusted client IP the (account, IP) window falls back to one
 * bucket per account.
 */
const AUTH_ATTEMPT_POLICIES = {
  'sign-in': {
    ip: { windowMs: 15 * MINUTE, maxRequests: 20 },
    accountIp: { windowMs: 15 * MINUTE, maxRequests: 5 },
    account: {
      kind: 'delay',
      windowMs: 15 * MINUTE,
      freeAttempts: 10,
      baseDelayMs: 500,
      maxDelayMs: 5000,
      maxRequests: 100,
    },
  },
  'password-reset': {
    ip: { windowMs: 15 * MINUTE, maxRequests: 5 },
    accountIp: { windowMs: 15 * MINUTE, maxRequests: 3 },
  },
  register: {
    ip: { windowMs: 15 * MINUTE, maxRequests: 10 },
    account: { kind: 'limit', windowMs: 15 * MINUTE, maxRequests: 5 },
  },
} satisfies Record<string, AuthAttemptPolicy>

export type AuthAttemptScope = keyof typeof AUTH_ATTEMPT_POLICIES

export interface AuthAttemptResult extends RateLimitResult {
  /** Wait before answering; never a reason to refuse. */
  delayMs: number
}

export interface IdentityLimiterOptions {
  now?: number
  /** Window store; defaults to the runtime counter supplied by the host. */
  counter?: RateLimitCounter
  /** HMAC key for identifiers; defaults to `PLATFORM_RATE_LIMIT_SECRET`. */
  secret?: string
}

/** Anonymous account flows limited by `refuseAuthAttempt`. */
export type AccountFlowScope = Exclude<AuthAttemptScope, 'sign-in'>

/** Body of the 503 answered when an identity flow cannot count its attempt. */
const AUTH_UNAVAILABLE_MESSAGE =
  'Serviço temporariamente indisponível. Tente novamente em instantes.'

const ACCOUNT_NOTICE_WINDOWS = {
  // "Someone tried to register with your e-mail": at most one per 6 hours.
  'registration-attempt': { windowMs: 6 * 60 * MINUTE, maxRequests: 1 },
  'password-reset': { windowMs: 15 * MINUTE, maxRequests: 3 },
  // Verification e-mail resent to an unverified account that registers again (consumeVerificationResend).
  'verification-resend': { windowMs: 5 * MINUTE, maxRequests: 1 },
  'owner-verification-resend': { windowMs: MINUTE, maxRequests: 1 },
  'verification-resend-day': { windowMs: 24 * 60 * MINUTE, maxRequests: 3 },
} satisfies Record<string, RateLimitWindow>

export type AccountNoticeKind = keyof typeof ACCOUNT_NOTICE_WINDOWS

/**
 * A limiter or configuration failure as log fields without secrets: the error
 * name and code only (Prisma and pg messages may repeat query arguments, the
 * e-mail or the connection string). A `PlatformEnvError` keeps its message,
 * which by contract never carries values (contracts/platform).
 */
export function limiterFailureFields(error: unknown): {
  error: string
  code?: string
  detail?: string
} {
  const name = error instanceof Error ? error.name : 'unknown'
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined
  return {
    error: name,
    ...(code === undefined ? {} : { code }),
    ...(name === 'PlatformEnvError' && error instanceof Error
      ? { detail: error.message }
      : {}),
  }
}

/** The legacy guard delegates to the shared policies through the host's real ports. */
export function createLegacySignInGuard(
  dependencies: {
    clientIp: LegacySignInGuard['clientIp']
    consumeAuthAttempt(
      _scope: AuthAttemptScope,
      _attempt: { ip: string | null; account: string },
      _options: IdentityLimiterOptions
    ): Promise<AuthAttemptResult>
    clearAuthAccountAttempts(
      _scope: AuthAttemptScope,
      _account: string,
      _ip: string | null,
      _options: IdentityLimiterOptions
    ): Promise<void>
  },
  options: IdentityLimiterOptions = {}
): LegacySignInGuard {
  return {
    clientIp: (headers) => dependencies.clientIp(headers),
    consume: (attempt) =>
      dependencies.consumeAuthAttempt('sign-in', attempt, options),
    clear: ({ ip, account }) =>
      dependencies.clearAuthAccountAttempts('sign-in', account, ip, options),
  }
}

/** Persistent identity policies shared by HTTP hosts; runtime dependencies are ports. */
export function createIdentityLimiters(dependencies: {
  loadCounter(): Promise<RateLimitCounter>
  secret(): string
  clientIp: LegacySignInGuard['clientIp']
}) {
  let applicationCounter: Promise<RateLimitCounter> | undefined

  /**
   * The runtime counter is loaded lazily once for all concurrent attempts;
   * a failed load is retried on the next call.
   */
  function applicationRateLimitCounter(): Promise<RateLimitCounter> {
    applicationCounter ??= dependencies.loadCounter().then(
      (counter) => counter,
      (error: unknown) => {
        applicationCounter = undefined
        throw error
      }
    )
    return applicationCounter
  }

  async function limiterContext(options: IdentityLimiterOptions) {
    // Resolved first: without the secret in production nothing is counted.
    const secret = options.secret ?? dependencies.secret()
    const counter = options.counter ?? (await applicationRateLimitCounter())
    return { counter, secret, now: options.now ?? Date.now() }
  }

  type KeyContext = { secret: string }
  const ipPart = ({ secret }: KeyContext, ip: string) =>
    platformRateLimitDigest(secret, 'ip', ip)
  /** Same canonical form as the credential lookup (`normalizeEmail`). */
  const accountPart = ({ secret }: KeyContext, account: string) =>
    platformRateLimitDigest(secret, 'account', normalizeEmail(account))

  const ipScope = (keys: KeyContext, scope: AuthAttemptScope, ip: string) => [
    'auth',
    scope,
    'ip',
    ipPart(keys, ip),
  ]
  const accountIpOwner = (
    keys: KeyContext,
    scope: AuthAttemptScope,
    account: string
  ) => ['auth', scope, 'account-ip', accountPart(keys, account)]
  const accountIpScope = (
    keys: KeyContext,
    scope: AuthAttemptScope,
    account: string,
    ip: string | null
  ) => [
    ...accountIpOwner(keys, scope, account),
    ip ? ipPart(keys, ip) : 'unknown',
  ]
  const accountScope = (
    keys: KeyContext,
    scope: AuthAttemptScope,
    account: string
  ) => ['auth', scope, 'account', accountPart(keys, account)]

  async function consumeWindow(
    counter: RateLimitCounter,
    segments: string[],
    window: RateLimitWindow,
    now: number
  ): Promise<RateLimitResult> {
    const decision = await consumeRateLimitWindow(
      counter,
      segments,
      { windowMs: window.windowMs, max: window.maxRequests },
      now
    )
    return decision.allowed
      ? {
          allowed: true,
          remaining: decision.remaining,
          resetTime: decision.resetTime,
        }
      : {
          allowed: false,
          remaining: 0,
          resetTime: decision.resetTime,
          error: 'Rate limit exceeded',
        }
  }

  /**
   * Counts an authentication attempt before any account lookup, so the outcome
   * never depends on whether the account exists. Requester windows are checked
   * first: a blocked requester never touches the account counters. A storage
   * failure rejects the promise (the caller answers with an error, never with
   * an unlimited attempt).
   */
  async function consumeAuthAttempt(
    scope: AuthAttemptScope,
    input: { ip: string | null; account: string },
    options: IdentityLimiterOptions = {}
  ): Promise<AuthAttemptResult> {
    const policy: AuthAttemptPolicy = AUTH_ATTEMPT_POLICIES[scope]
    const { counter, secret, now } = await limiterContext(options)
    const keys = { secret }
    const results: RateLimitResult[] = []
    const withinLimit = async (segments: string[], window: RateLimitWindow) => {
      const result = await consumeWindow(counter, segments, window, now)
      results.push(result)
      return result.allowed
    }
    const refused = (): AuthAttemptResult => ({
      allowed: false,
      remaining: 0,
      resetTime: Math.max(
        ...results.filter((result) => !result.allowed).map((r) => r.resetTime)
      ),
      error: 'Rate limit exceeded',
      delayMs: 0,
    })

    if (
      input.ip &&
      policy.ip &&
      !(await withinLimit(ipScope(keys, scope, input.ip), policy.ip))
    )
      return refused()
    if (
      policy.accountIp &&
      !(await withinLimit(
        accountIpScope(keys, scope, input.account, input.ip),
        policy.accountIp
      ))
    )
      return refused()

    let delayMs = 0
    const shared = policy.account
    if (shared?.kind === 'limit') {
      if (
        !(await withinLimit(accountScope(keys, scope, input.account), shared))
      )
        return refused()
    } else if (shared?.kind === 'delay') {
      const { count, resetTime } = await hitRateLimitWindow(
        counter,
        accountScope(keys, scope, input.account),
        shared.windowMs,
        now
      )
      const allowed = count <= shared.maxRequests
      results.push({
        allowed,
        remaining: Math.max(0, shared.maxRequests - count),
        resetTime,
      })
      if (!allowed) return refused()
      const excess = count - shared.freeAttempts
      if (excess > 0)
        delayMs = Math.min(
          shared.baseDelayMs * 2 ** (excess - 1),
          shared.maxDelayMs
        )
    }
    return {
      allowed: true,
      remaining: results.length
        ? Math.min(...results.map((result) => result.remaining))
        : Number.POSITIVE_INFINITY,
      resetTime: results.length
        ? Math.max(...results.map((result) => result.resetTime))
        : now,
      delayMs,
    }
  }

  /** Windows are only ever cleared best-effort: a failure never blocks the caller. */
  async function clearWindows(
    label: string,
    operation: () => Promise<void>
  ): Promise<void> {
    try {
      await operation()
    } catch (error) {
      console.error('[rate-limit]', {
        event: 'auth_windows_not_cleared',
        scope: label,
        ...limiterFailureFields(error),
      })
    }
  }

  /**
   * A proven credential drops the shared account window and this requester's
   * own window; other requesters keep theirs.
   */
  async function clearAuthAccountAttempts(
    scope: AuthAttemptScope,
    account: string,
    ip: string | null,
    options: IdentityLimiterOptions = {}
  ): Promise<void> {
    await clearWindows(scope, async () => {
      const policy: AuthAttemptPolicy = AUTH_ATTEMPT_POLICIES[scope]
      const { counter, secret, now } = await limiterContext(options)
      const keys = { secret }
      const current = (segments: string[], windowMs: number) =>
        rateLimitWindowKey(segments, rateLimitWindowAt(now, windowMs).index)
      await counter.remove([
        ...(policy.account
          ? [
              current(
                accountScope(keys, scope, account),
                policy.account.windowMs
              ),
            ]
          : []),
        ...(policy.accountIp
          ? [
              current(
                accountIpScope(keys, scope, account, ip),
                policy.accountIp.windowMs
              ),
            ]
          : []),
      ])
    })
  }

  /** A password change starts every window of the account over, for every client. */
  async function resetAuthAccountAttempts(
    scope: AuthAttemptScope,
    account: string,
    options: IdentityLimiterOptions = {}
  ): Promise<void> {
    await clearWindows(scope, async () => {
      const { counter, secret } = await limiterContext(options)
      const keys = { secret }
      await counter.removePrefix(
        rateLimitKeyPrefix(accountScope(keys, scope, account))
      )
      await counter.removePrefix(
        rateLimitKeyPrefix(accountIpOwner(keys, scope, account))
      )
    })
  }

  /**
   * One attempt of an anonymous account flow (`register`, `password-reset`),
   * the same in both identity modes: counted before any lookup and before any
   * call into the identity engine (direct `auth.api.*` calls skip its own
   * limiter). It fails closed, never with a 500:
   * - a spent window answers 429 `no-store` with `Retry-After` and `message`;
   * - a limiter that cannot count (storage failure, or no
   *   PLATFORM_RATE_LIMIT_SECRET in production) answers 503 `no-store` with
   *   `Retry-After` and a fixed body: 429 only ever means a limit was reached.
   * The cause is logged as one structured event, without the e-mail, the IP,
   * the stored keys or any secret. `null`: the attempt may go on.
   */
  async function refuseAuthAttempt(
    scope: AccountFlowScope,
    input: { headers: Headers; account: string },
    message: string,
    options: IdentityLimiterOptions = {}
  ): Promise<Response | null> {
    const noStore = (status: number, error: string, retryAfter: number) =>
      Response.json(
        { error },
        {
          status,
          headers: {
            'Retry-After': String(retryAfter),
            'Cache-Control': 'no-store',
          },
        }
      )
    let attempt: AuthAttemptResult
    try {
      attempt = await consumeAuthAttempt(
        scope,
        { ip: dependencies.clientIp(input.headers), account: input.account },
        options
      )
    } catch (error) {
      console.error('[auth-rate-limit]', {
        event: 'auth_attempt_refused',
        scope,
        cause: 'limiter-unavailable',
        ...limiterFailureFields(error),
      })
      return noStore(
        503,
        AUTH_UNAVAILABLE_MESSAGE,
        AUTH_UNAVAILABLE_RETRY_SECONDS
      )
    }
    if (attempt.allowed) return null
    const retryAfter = Math.max(
      1,
      Math.ceil((attempt.resetTime - (options.now ?? Date.now())) / 1000)
    )
    console.warn('[auth-rate-limit]', {
      event: 'auth_attempt_refused',
      scope,
      cause: 'rate-limited',
      retryAfterSeconds: retryAfter,
    })
    return noStore(429, message, retryAfter)
  }

  /**
   * Silent budget for e-mails sent to an account holder: callers skip the
   * e-mail when it is spent and still give the same answer. A storage failure
   * also skips the e-mail (false) instead of changing the answer.
   */
  async function consumeAccountNotice(
    kind: AccountNoticeKind,
    account: string,
    options: IdentityLimiterOptions = {}
  ): Promise<boolean> {
    try {
      const { counter, secret, now } = await limiterContext(options)
      const result = await consumeWindow(
        counter,
        ['notice', kind, accountPart({ secret }, account)],
        ACCOUNT_NOTICE_WINDOWS[kind],
        now
      )
      return result.allowed
    } catch (error) {
      console.error('[rate-limit]', {
        event: 'account_notice_skipped',
        kind,
        ...limiterFailureFields(error),
      })
      return false
    }
  }

  /**
   * Silent budget of the verification e-mail resent to an account that has not
   * verified its address yet (it registers again): at most one per 5 minutes and
   * three per day per account, both windows aligned to the clock. The day
   * window is only spent once the 5-minute one allows. Callers skip the e-mail
   * when it is spent and keep the same answer; a storage failure also skips it.
   */
  async function consumeVerificationResend(
    account: string,
    options: IdentityLimiterOptions = {}
  ): Promise<boolean> {
    return (
      (await consumeAccountNotice('verification-resend', account, options)) &&
      (await consumeAccountNotice('verification-resend-day', account, options))
    )
  }

  /**
   * The one attempt guard of the legacy credential sign-in
   * (`verifyLegacyCredential`), shared by NextAuth composed in the API host and
   * the Better Auth coexistence login (`/api/auth/v2` through this module's factory):
   * both read the client IP the same way and count in the same `sign-in`
   * windows of `platform_rate_limits`.
   */
  function legacySignInGuard(
    options: IdentityLimiterOptions = {}
  ): LegacySignInGuard {
    return createLegacySignInGuard(
      {
        clientIp: dependencies.clientIp,
        consumeAuthAttempt,
        clearAuthAccountAttempts,
      },
      options
    )
  }

  return {
    consumeAuthAttempt,
    clearAuthAccountAttempts,
    resetAuthAccountAttempts,
    refuseAuthAttempt,
    consumeAccountNotice,
    consumeVerificationResend,
    legacySignInGuard,
  }
}
