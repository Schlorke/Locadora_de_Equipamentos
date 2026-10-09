import { beforeEach, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import type { TenantPrincipal } from '../../packages/backend/src/modules/identity/index'
import { createOwnerAccountRecovery } from '../../packages/backend/src/modules/payment-accounts/index'
import { createOwnerAccountRecoveryHandler } from '../../packages/backend/src/http/owner-payment-account-recovery'

const now = new Date('2026-10-05T14:00:00Z')
const actor = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN',
} as TenantPrincipal
const session = {
  user: { id: actor.userId },
  authenticatedAt: now.getTime(),
}
let account: any,
  owner: string,
  key: any,
  receipt: any,
  pending: any,
  confirmed: any,
  incident: { id: string; createdAt: Date }
const tx = {
  $executeRaw: vi.fn(async () => 0),
  $queryRaw: vi.fn(async () => [{ platform: true, safe: true }]),
  membership: {
    findFirst: vi.fn(async () =>
      owner
        ? {
            organization: {
              ownerUserId: owner,
              status: 'ACTIVE',
              access: 'FULL',
            },
          }
        : null
    ),
  },
  paymentAccount: { findFirst: vi.fn(async () => structuredClone(account)) },
  integrationSecret: { findFirst: vi.fn(async () => key) },
  platformOutboxEvent: {
    findFirst: vi.fn(async () => pending),
    upsert: vi.fn(async ({ create }: any) => {
      pending = { id: 'event', ...create }
      return pending
    }),
  },
  platformAuditLog: {
    findFirst: vi.fn(async ({ where }: any) => {
      if (where.action === 'payment-account.configuration.confirmed')
        return confirmed
      if (where.action === 'payment-account.reconciliation.started')
        return incident
      return receipt?.metadata?.keyId === key?.id &&
        receipt?.metadata?.incidentId === incident.id
        ? receipt
        : null
    }),
    create: vi.fn(async ({ data }: any) => {
      const value = { id: 'audit', createdAt: now, ...data }
      if (data.action === 'payment-account.reconciliation.started')
        incident = value
      return value
    }),
  },
}
const readTransaction = vi.fn(
  async (
    _tenant: string,
    operation: (_tx: Prisma.TransactionClient) => Promise<any>
  ) => operation(tx as unknown as Prisma.TransactionClient)
)
const transaction = vi.fn(
  async (
    _tenant: string,
    operation: (_tx: Prisma.TransactionClient) => Promise<any>
  ) => operation(tx as unknown as Prisma.TransactionClient)
)
const recovery = () =>
  createOwnerAccountRecovery({
    transaction,
    readTransaction,
    environment: 'sandbox',
    now: () => now,
  })
beforeEach(() => {
  vi.clearAllMocks()
  owner = actor.userId
  key = { id: 'key-current', expiresAt: null }
  receipt = null
  pending = null
  confirmed = null
  incident = { id: 'incident', createdAt: now }
  account = {
    id: 'account-alfa',
    tenantId: actor.tenantId,
    mode: 'ASAAS_CONNECTED_ACCOUNT',
    environment: 'sandbox',
    integrationId: 'integration-alfa',
    disconnectedAt: null,
    status: 'RESTRICTED',
    healthIssue: 'WEBHOOK_INTERRUPTED',
    lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
    lockedUntil: null,
    nextAttemptAt: new Date(now.getTime() + 120000),
    integration: {
      provider: 'ASAAS',
      credentialSource: 'VAULT',
      environment: 'sandbox',
      status: 'ACTIVE',
    },
  }
})
it('projects only current incident/key progress and never declares delivery ready', async () => {
  receipt = {
    action: 'payment-account.reconciliation.progress',
    createdAt: now,
    metadata: {
      incidentId: 'incident',
      keyId: key.id,
      checked: 7,
      complete: true,
    },
  }
  const response = await recovery().read(actor)
  expect(response).toEqual({
    recovery: {
      state: 'SNAPSHOT_COMPLETE',
      checked: 7,
      lastCheckedAt: now.toISOString(),
      requestPending: false,
      canRequest: true,
    },
  })
  for (const internal of [
    'incident',
    'key-current',
    'account-alfa',
    'integration-alfa',
  ])
    expect(JSON.stringify(response)).not.toContain(internal)
  expect(tx.platformAuditLog.create).not.toHaveBeenCalled()
  expect(transaction).not.toHaveBeenCalled()
})
it.each(['read', 'request'] as const)(
  '%s rechecks current ownership rather than trusting global ADMIN',
  async (method) => {
    owner = 'other-owner'
    await expect(
      method === 'read'
        ? recovery().read(actor)
        : recovery().request(actor, session.authenticatedAt)
    ).rejects.toMatchObject({ code: 'OWNER_REQUIRED', status: 403 })
    expect(tx.integrationSecret.findFirst).not.toHaveBeenCalled()
    expect(tx.platformOutboxEvent.upsert).not.toHaveBeenCalled()
  }
)
it('does not use an old-key receipt or a start before a confirmed configuration', async () => {
  receipt = {
    action: 'payment-account.reconciliation.progress',
    createdAt: now,
    metadata: {
      incidentId: 'incident',
      keyId: 'old-key',
      checked: 500,
      complete: true,
    },
  }
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'WAITING',
    checked: 0,
  })
  confirmed = { id: 'later', createdAt: new Date(now.getTime() + 1) }
  receipt.metadata.keyId = key.id
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'WAITING',
    checked: 0,
  })
})
it('honors provider backoff, deduplicates repeated requests and does not unlock or approve the account', async () => {
  const initial = structuredClone(account)
  expect(await recovery().request(actor, session.authenticatedAt)).toEqual({
    accepted: true,
  })
  expect(await recovery().request(actor, session.authenticatedAt)).toEqual({
    accepted: true,
  })
  expect(tx.platformOutboxEvent.upsert).toHaveBeenCalledTimes(1)
  expect(pending).toMatchObject({
    topic: 'payment-accounts.health',
    aggregateId: account.id,
    availableAt: initial.nextAttemptAt,
    payload: { accountId: account.id },
  })
  expect(tx.platformAuditLog.create).toHaveBeenCalledTimes(1)
  expect(account).toEqual(initial)
})
it('a lease remains in effect even without a pending queue row', async () => {
  account.lockedUntil = new Date(now.getTime() + 60000)
  expect((await recovery().read(actor)).recovery).toMatchObject({
    requestPending: true,
    canRequest: false,
  })
  expect(await recovery().request(actor, session.authenticatedAt)).toEqual({
    accepted: true,
  })
  expect(tx.platformOutboxEvent.upsert).not.toHaveBeenCalled()
})
it('a finished queue intent cannot swallow a later explicit request in the same backoff period', async () => {
  await recovery().request(actor, session.authenticatedAt)
  const firstKey = pending.dedupeKey
  pending = null // The previous job finished. No active queue row is returned by the real status filter.
  await recovery().request(actor, session.authenticatedAt)
  expect(tx.platformOutboxEvent.upsert).toHaveBeenCalledTimes(2)
  expect(pending.dedupeKey).not.toBe(firstKey)
  expect(pending.availableAt).toEqual(account.nextAttemptAt)
})
const completedReceipt = () => ({
  action: 'payment-account.reconciliation.progress',
  createdAt: now,
  metadata: {
    incidentId: incident.id,
    keyId: key.id,
    complete: true,
    checked: 7,
  },
})
it('a new request after completion creates one fresh incident and removes old completion from the projection', async () => {
  receipt = completedReceipt()
  const old = structuredClone(incident),
    before = structuredClone(account)
  await recovery().request(actor, session.authenticatedAt)
  await recovery().request(actor, session.authenticatedAt)
  expect(incident.id).not.toBe(old.id)
  expect(incident.createdAt.getTime()).toBeGreaterThan(old.createdAt.getTime())
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'WAITING',
    checked: 0,
    requestPending: true,
    canRequest: false,
  })
  expect(tx.platformOutboxEvent.upsert).toHaveBeenCalledOnce()
  expect(
    tx.platformAuditLog.create.mock.calls.filter(
      ([arg]) => arg.data.action === 'payment-account.reconciliation.started'
    )
  ).toHaveLength(1)
  expect(receipt.metadata).toMatchObject({
    incidentId: old.id,
    checked: 7,
    complete: true,
  })
  expect(account).toEqual(before)
})
it('a waiting health inspection adopts the fresh incident without another queue row or an earlier deadline', async () => {
  receipt = completedReceipt()
  pending = { id: 'waiting-health', status: 'PENDING' }
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'SNAPSHOT_COMPLETE',
    requestPending: true,
    canRequest: true,
  })
  await recovery().request(actor, session.authenticatedAt)
  await recovery().request(actor, session.authenticatedAt)
  expect(tx.platformOutboxEvent.upsert).not.toHaveBeenCalled()
  expect(tx.platformAuditLog.create).toHaveBeenCalledTimes(2)
  expect(tx.platformAuditLog.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: 'payment-account.reconciliation.requested',
        metadata: { eventId: 'waiting-health', incidentId: incident.id },
      }),
    })
  )
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'WAITING',
    canRequest: false,
  })
})
it.each(['PROCESSING', 'leased'] as const)(
  'completed proof cannot replace the incident while the job is %s',
  async (stage) => {
    receipt = completedReceipt()
    if (stage === 'PROCESSING')
      pending = { id: 'claimed', status: 'PROCESSING' }
    else account.lockedUntil = new Date(now.getTime() + 1000)
    const before = structuredClone(incident)
    expect((await recovery().read(actor)).recovery?.canRequest).toBe(false)
    expect(await recovery().request(actor, session.authenticatedAt)).toEqual({
      accepted: true,
    })
    expect(incident).toEqual(before)
    expect(tx.platformAuditLog.create).not.toHaveBeenCalled()
  }
)
it('continuation of an incomplete snapshot retains its incident and cursor identity', async () => {
  receipt = {
    ...completedReceipt(),
    metadata: { ...completedReceipt().metadata, complete: false },
  }
  const before = structuredClone(incident)
  await recovery().request(actor, session.authenticatedAt)
  expect(incident).toEqual(before)
  expect(
    tx.platformAuditLog.create.mock.calls.every(
      ([arg]) => arg.data.action !== 'payment-account.reconciliation.started'
    )
  ).toBe(true)
})
it.each([null, { id: 'key-current', expiresAt: new Date(now.getTime() - 1) }])(
  'missing or expired credential blocks a new request',
  async (value) => {
    key = value
    expect((await recovery().read(actor)).recovery).toMatchObject({
      state: 'ACCESS_REQUIRED',
      canRequest: false,
    })
    await expect(
      recovery().request(actor, session.authenticatedAt)
    ).rejects.toMatchObject({ code: 'RECOVERY_REVIEW_REQUIRED' })
  }
)
it.each([
  'RECONCILIATION_MANUAL_REVIEW_REQUIRED',
  'RECONCILIATION_CHECKPOINT_INVALID',
])(
  'requires support for %s without exposing internal diagnostics',
  async (reasonCategory) => {
    receipt = {
      action: 'payment-account.reconciliation.blocked',
      reasonCategory,
      createdAt: now,
      metadata: { incidentId: 'incident', keyId: key.id },
    }
    expect((await recovery().read(actor)).recovery).toMatchObject({
      state: 'REVIEW_REQUIRED',
      canRequest: false,
    })
    await expect(
      recovery().request(actor, session.authenticatedAt)
    ).rejects.toMatchObject({ status: 409 })
  }
)
it('provider unavailability permits a later explicit request, but does not imply completion', async () => {
  receipt = {
    action: 'payment-account.reconciliation.blocked',
    reasonCategory: 'RECONCILIATION_PROVIDER_UNAVAILABLE',
    createdAt: now,
    metadata: { incidentId: 'incident', keyId: key.id },
  }
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'WAITING',
    checked: 0,
    canRequest: true,
  })
})
it('malformed progress remains unavailable for retry and completion', async () => {
  receipt = {
    action: 'payment-account.reconciliation.progress',
    createdAt: now,
    metadata: {
      incidentId: 'incident',
      keyId: key.id,
      complete: true,
      checked: -1,
    },
  }
  expect((await recovery().read(actor)).recovery).toMatchObject({
    state: 'REVIEW_REQUIRED',
    checked: 0,
    canRequest: false,
  })
})
const env = {
  PLATFORM_ENV: 'staging',
  PLATFORM_ROOT_DOMAIN: 'platform.test',
  PLATFORM_EDGE_SECRET: 'synthetic-recovery-edge-secret-over32',
}
const request = (
  method = 'POST',
  body: unknown = { confirmation: true },
  origin = 'https://app.platform.test'
) =>
  new Request('https://api.test/api/admin/payment-account/recovery', {
    method,
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET,
      'x-platform-host-kind': 'app',
      'x-platform-origin': 'https://app.platform.test',
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
it('HTTP requires fresh engine authentication and strict confirmation; uses private responses', async () => {
  const service = {
    read: vi.fn(),
    request: vi.fn(async () => ({ accepted: true as const })),
  }
  const getSession = vi.fn(async () => session)
  const handle = createOwnerAccountRecoveryHandler({
    recovery: service,
    environment: () => env,
    getSession,
    now: () => now,
  })
  const accepted = await handle(request(), actor)
  expect(accepted.status).toBe(202)
  expect(accepted.headers.get('cache-control')).toBe('private, no-store')
  expect(await accepted.json()).toEqual({ accepted: true })
  service.request.mockClear()
  expect(
    (await handle(request('POST', { confirmation: true, resume: true }), actor))
      .status
  ).toBe(400)
  getSession.mockResolvedValueOnce({
    ...session,
    authenticatedAt: session.authenticatedAt - 600_001,
  })
  expect((await handle(request(), actor)).status).toBe(401)
  expect(
    (
      await handle(
        request('POST', { confirmation: true }, 'https://bravo.platform.test'),
        actor
      )
    ).status
  ).toBe(403)
  expect(service.request).not.toHaveBeenCalled()
})
