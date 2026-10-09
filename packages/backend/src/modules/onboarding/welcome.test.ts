import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { createOnboardingWelcome, ONBOARDING_WELCOME_TOPIC } from './welcome'
import type { PlatformTransaction } from '../platform-scope/index'
import type { PlatformMailEnvelope } from '../communications/index'

const instant = new Date('2026-10-04T12:00:00Z')
function fixture() {
  let time = new Date(instant),
    open = false,
    failAcceptance = false
  const row = {
    id: 'event',
    tenantId: 'tenant',
    topic: ONBOARDING_WELCOME_TOPIC,
    aggregateId: 'tenant',
    dedupeKey: 'onboarding-welcome:tenant',
    status: 'PROCESSING',
    lockedBy: 'worker',
    attempts: 1,
    lockedUntil: new Date(time.getTime() + 300_000),
    payload: { organizationId: 'tenant' } as unknown,
  }
  const org = {
    name: 'Locadora <img src=x>',
    ownerUserId: 'owner',
    origin: 'ONBOARDING',
    status: 'ACTIVE',
  }
  const contact = { email: ' OWNER@example.test ', authEmailVerified: true }
  const state = { member: true, staff: false }
  const audits: { action: string; reasonCategory: string }[] = []
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) =>
      strings.join('').includes('platform_user_contacts')
        ? [contact]
        : [{ id: 'tenant' }],
    organization: { findUnique: async () => org },
    membership: {
      findFirst: async () => (state.member ? { id: 'member' } : null),
    },
    platformStaff: {
      findFirst: async () => (state.staff ? { id: 'staff' } : null),
    },
    platformOutboxEvent: {
      findUniqueOrThrow: async () => row,
      update: async ({ data }: { data: { payload: unknown } }) => {
        if (
          failAcceptance &&
          (data.payload as { acceptedAt?: string }).acceptedAt
        )
          throw new Error('synthetic receipt persistence failure')
        row.payload = structuredClone(data.payload)
        return row
      },
    },
    platformAuditLog: {
      create: async ({ data }: { data: (typeof audits)[number] }) => {
        audits.push(data)
        return data
      },
    },
  } as unknown as Prisma.TransactionClient
  const transaction: PlatformTransaction = async (operation) => {
    const previous = structuredClone(row.payload),
      count = audits.length
    open = true
    try {
      return await operation(tx)
    } catch (error) {
      row.payload = previous
      audits.splice(count)
      throw error
    } finally {
      open = false
    }
  }
  const send = vi.fn(async (_mail: PlatformMailEnvelope, _key: string) => {
    expect(open).toBe(false)
    expect(row.payload).toMatchObject({
      intent: { ownerUserId: 'owner', envelope: _mail },
    })
  })
  const options = {
    transaction,
    from: 'Platform <platform@example.test>',
    panelUrl: 'https://app.example.com/admin',
    send,
    now: () => time,
  }
  const handler = () =>
    createOnboardingWelcome(options).handlers[ONBOARDING_WELCOME_TOPIC]
  const message = () => ({ ...row, payload: { organizationId: 'forged' } })
  return {
    row,
    org,
    contact,
    state,
    audits,
    send,
    options,
    handler,
    message,
    advance: (ms: number) => {
      time = new Date(time.getTime() + ms)
      row.lockedUntil = new Date(time.getTime() + 300_000)
      row.attempts++
    },
    failAcceptance: () => {
      failAcceptance = true
    },
    restoreAcceptance: () => {
      failAcceptance = false
    },
  }
}

describe('durable onboarding welcome', () => {
  it('uses the persisted event, freezes owner-only content before I/O, and records acceptance once', async () => {
    const f = fixture()
    await f.handler()(f.message())
    expect(f.send).toHaveBeenCalledTimes(1)
    const [mail, key] = f.send.mock.calls[0]!
    expect(key).toBe('onboarding-welcome:event')
    expect(mail.to).toBe('owner@example.test')
    expect(mail.html).toContain('Locadora &lt;img src=x&gt;')
    expect(mail.html).toContain('https://app.example.com/admin')
    expect(mail.html).toContain('>Acessar painel</a>')
    expect(mail.text).not.toMatch(/site publicado|recebimentos ativados/i)
    expect(f.audits).toMatchObject([
      {
        action: 'onboarding.welcome.accepted',
        reasonCategory: 'PROVIDER_ACCEPTED',
      },
    ])
    f.org.ownerUserId = 'new-owner'
    f.contact.authEmailVerified = false
    await f.handler()(f.message())
    expect(f.send).toHaveBeenCalledTimes(1)
    expect(f.audits).toHaveLength(1)
  })
  it('retries an ambiguous provider failure with identical content/key, including JSONB key ordering', async () => {
    const f = fixture()
    f.send.mockRejectedValueOnce(
      new Error('secret and sensitive provider body')
    )
    await expect(f.handler()(f.message())).rejects.toThrow(
      'PLATFORM_MAIL_DELIVERY_FAILED'
    )
    expect(f.row.payload).not.toHaveProperty('acceptedAt')
    const payload = f.row.payload as {
      intent: { envelope: PlatformMailEnvelope }
    }
    payload.intent.envelope = Object.fromEntries(
      Object.entries(payload.intent.envelope).reverse()
    ) as PlatformMailEnvelope
    f.advance(60_000)
    await f.handler()(f.message())
    expect(f.send.mock.calls[1]).toEqual(f.send.mock.calls[0])
    expect(f.row.payload).toHaveProperty('acceptedAt')
  })
  it('reuses the provider key when provider acceptance could not be saved locally', async () => {
    const f = fixture()
    f.failAcceptance()
    await expect(f.handler()(f.message())).rejects.toThrow(
      'synthetic receipt persistence failure'
    )
    expect(f.row.payload).not.toHaveProperty('acceptedAt')
    expect(f.audits).toEqual([])
    f.restoreAcceptance()
    f.advance(60_000)
    await f.handler()(f.message())
    expect(f.send.mock.calls[1]).toEqual(f.send.mock.calls[0])
    expect(f.audits).toHaveLength(1)
  })
  it.each([
    [
      'owner',
      (f: ReturnType<typeof fixture>) => {
        f.org.ownerUserId = 'another'
      },
    ],
    [
      'email',
      (f: ReturnType<typeof fixture>) => {
        f.contact.email = 'another@example.test'
      },
    ],
    [
      'company name',
      (f: ReturnType<typeof fixture>) => {
        f.org.name = 'Changed'
      },
    ],
    [
      'sender',
      (f: ReturnType<typeof fixture>) => {
        f.options.from = 'changed@example.test'
      },
    ],
    [
      'URL',
      (f: ReturnType<typeof fixture>) => {
        f.options.panelUrl = 'https://app.example.com/admin?changed=1'
      },
    ],
  ])(
    'quarantines a changed %s instead of retargeting the frozen send',
    async (_label, change) => {
      const f = fixture()
      f.send.mockRejectedValueOnce(new Error('ambiguous'))
      await expect(f.handler()(f.message())).rejects.toThrow(
        'PLATFORM_MAIL_DELIVERY_FAILED'
      )
      change(f)
      f.advance(60_000)
      await expect(f.handler()(f.message())).rejects.toThrow(
        'ONBOARDING_WELCOME_RECONCILIATION_REQUIRED'
      )
      expect(f.row.payload).toMatchObject({
        quarantine: { reason: 'CONTENT_CHANGED' },
      })
      expect(f.send).toHaveBeenCalledTimes(1)
      await expect(f.handler()(f.message())).rejects.toThrow(
        'ONBOARDING_WELCOME_RECONCILIATION_REQUIRED'
      )
      expect(f.audits).toHaveLength(1)
    }
  )
  it.each([
    [
      'unverified',
      (f: ReturnType<typeof fixture>) => {
        f.contact.authEmailVerified = false
      },
    ],
    [
      'invalid email',
      (f: ReturnType<typeof fixture>) => {
        f.contact.email = 'invalid'
      },
    ],
    [
      'missing member',
      (f: ReturnType<typeof fixture>) => {
        f.state.member = false
      },
    ],
    [
      'staff',
      (f: ReturnType<typeof fixture>) => {
        f.state.staff = true
      },
    ],
    [
      'inactive organization',
      (f: ReturnType<typeof fixture>) => {
        f.org.status = 'SUSPENDED'
      },
    ],
    [
      'legacy organization',
      (f: ReturnType<typeof fixture>) => {
        f.org.origin = 'LEGACY'
      },
    ],
  ])(
    'persists reconciliation for %s without contacting the provider',
    async (_label, change) => {
      const f = fixture()
      change(f)
      await expect(f.handler()(f.message())).rejects.toThrow(
        'ONBOARDING_WELCOME_RECONCILIATION_REQUIRED'
      )
      expect(f.row.payload).toMatchObject({
        quarantine: { reason: 'RECIPIENT_UNAVAILABLE' },
      })
      expect(f.send).not.toHaveBeenCalled()
      expect(f.audits).toHaveLength(1)
    }
  )
  it.each([23 * 60 * 60_000, -60_000])(
    'blocks an ambiguous retry after elapsed %s milliseconds',
    async (elapsed) => {
      const f = fixture()
      f.send.mockRejectedValueOnce(new Error('ambiguous'))
      await expect(f.handler()(f.message())).rejects.toThrow(
        'PLATFORM_MAIL_DELIVERY_FAILED'
      )
      f.advance(elapsed)
      await expect(f.handler()(f.message())).rejects.toThrow(
        'ONBOARDING_WELCOME_RECONCILIATION_REQUIRED'
      )
      expect(f.row.payload).toMatchObject({
        quarantine: {
          reason:
            elapsed < 0 ? 'INVALID_ATTEMPT_TIME' : 'IDEMPOTENCY_WINDOW_EXPIRED',
        },
      })
      expect(f.send).toHaveBeenCalledTimes(1)
    }
  )
  it.each([
    { organizationId: 'another' },
    { organizationId: 'tenant', recipient: 'attacker@example.test' },
    { organizationId: 'tenant', acceptedAt: instant.toISOString() },
    {
      organizationId: 'tenant',
      intent: { firstAttemptAt: instant.toISOString() },
    },
  ])('rejects a malformed persisted payload %j', async (payload) => {
    const f = fixture()
    f.row.payload = payload
    await expect(f.handler()(f.message())).rejects.toThrow(
      'INVALID_ONBOARDING_WELCOME'
    )
    expect(f.send).not.toHaveBeenCalled()
  })
  it.each(['topic', 'tenantId', 'aggregateId', 'dedupeKey'] as const)(
    'rejects a forged descriptor %s before any send',
    async (field) => {
      const f = fixture()
      await expect(
        f.handler()({ ...f.message(), [field]: 'other' })
      ).rejects.toThrow('INVALID_ONBOARDING_WELCOME')
      expect(f.send).not.toHaveBeenCalled()
      expect(f.row.payload).not.toHaveProperty('intent')
    }
  )
  it.each(['expired', 'near expiry', 'worker', 'attempt', 'state'])(
    'refuses a stale %s lease',
    async (kind) => {
      const f = fixture(),
        message = f.message()
      if (kind === 'expired') f.row.lockedUntil = new Date(instant)
      if (kind === 'near expiry')
        f.row.lockedUntil = new Date(instant.getTime() + 19_999)
      if (kind === 'worker') f.row.lockedBy = 'new-worker'
      if (kind === 'attempt') f.row.attempts++
      if (kind === 'state') f.row.status = 'PENDING'
      await expect(f.handler()(message)).rejects.toThrow(
        'ONBOARDING_WELCOME_LEASE_LOST'
      )
      expect(f.send).not.toHaveBeenCalled()
    }
  )
  it('does not let an old worker record acceptance after another worker reclaimed the lease', async () => {
    const f = fixture()
    f.send.mockImplementationOnce(async () => {
      f.row.lockedBy = 'new-worker'
      f.row.attempts++
    })
    await expect(f.handler()(f.message())).rejects.toThrow(
      'ONBOARDING_WELCOME_LEASE_LOST'
    )
    expect(f.row.payload).not.toHaveProperty('acceptedAt')
    expect(f.audits).toEqual([])
  })
  it.each([
    'javascript:alert(1)',
    'https://user:secret@example.test/admin',
    'http://evil.example/admin',
  ])(
    'rejects unsafe runtime URL %s before registering the consumer',
    (panelUrl) => {
      const f = fixture()
      expect(() => createOnboardingWelcome({ ...f.options, panelUrl })).toThrow(
        'INVALID_PLATFORM_MAIL_URL'
      )
      expect(f.send).not.toHaveBeenCalled()
    }
  )
})
