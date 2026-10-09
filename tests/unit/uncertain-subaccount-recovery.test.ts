import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createUncertainSubaccountRecovery } from '../../packages/backend/src/modules/payment-accounts/index'
import { BillingProviderError } from '../../packages/backend/src/modules/billing/index'
import type { OutboxMessage } from '../../packages/backend/src/modules/outbox/index'

const clock = new Date('2026-10-05T12:00:00Z'),
  document = '11222333000181'
const found = { id: 'acc_owned', document, walletId: 'wallet_owned' }
const message: OutboxMessage<string | null> = {
  id: 'job',
  tenantId: 'tenant-alfa',
  topic: 'payment-accounts.provisioning-recovery',
  aggregateId: 'account-alfa',
  payload: { accountId: 'account-alfa' },
  dedupeKey: 'dedupe',
  attempts: 1,
  lockedBy: 'worker',
}
let row: any,
  stamp: number,
  activeKey: { id: string } | null,
  conflict: boolean,
  integrationConflict: boolean,
  inTransaction: boolean
const find = vi.fn(),
  audit = vi.fn(),
  upsert = vi.fn(),
  purge = vi.fn(),
  providerCreate = vi.fn()
const tx = {
  $executeRaw: vi.fn(async () => 0),
  $queryRaw: vi.fn(async (parts: TemplateStringsArray) =>
    parts.join('').includes('pg_roles') ? [{ platform: true, safe: true }] : []
  ),
  integrationSecret: { findFirst: vi.fn(async () => activeKey) },
  paymentAccount: {
    findFirst: vi.fn(async ({ where }: any) =>
      where.id?.not
        ? conflict
          ? { id: 'foreign' }
          : null
        : where.id === row.id && where.tenantId === row.tenantId
          ? structuredClone(row)
          : null
    ),
    findUniqueOrThrow: vi.fn(async () => structuredClone(row)),
    findMany: vi.fn(async () => [structuredClone(row)]),
    update: vi.fn(async ({ data }: any) => {
      Object.assign(row, data, {
        ...(data.provisioningAttempts
          ? { provisioningAttempts: row.provisioningAttempts + 1 }
          : {}),
        updatedAt: new Date(++stamp),
      })
      return structuredClone(row)
    }),
  },
  tenantIntegration: {
    findFirst: vi.fn(async () =>
      integrationConflict ? { id: 'foreign' } : null
    ),
    update: vi.fn(async ({ data }: any) => {
      Object.assign(row.integration, data, { updatedAt: new Date(++stamp) })
      return structuredClone(row.integration)
    }),
  },
  platformAuditLog: { create: audit },
  platformOutboxEvent: { upsert },
  paymentAccountProvisioningRequest: { updateMany: purge },
}
const transaction = async <T>(
  operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => {
  inTransaction = true
  try {
    return await operation(tx as unknown as Prisma.TransactionClient)
  } finally {
    inTransaction = false
  }
}
const worker = () =>
  createUncertainSubaccountRecovery({
    transaction,
    environment: 'sandbox',
    provider: { find, create: providerCreate } as { find: typeof find },
    now: () => clock,
  })
const run = (value = message) =>
  worker().handlers['payment-accounts.provisioning-recovery'](value)
beforeEach(() => {
  vi.clearAllMocks()
  stamp = clock.getTime()
  activeKey = null
  conflict = false
  integrationConflict = false
  inTransaction = false
  row = {
    id: 'account-alfa',
    tenantId: 'tenant-alfa',
    integrationId: 'integration-alfa',
    mode: 'ASAAS_SUBACCOUNT',
    subaccountModel: 'BAAS',
    status: 'UNKNOWN',
    environment: 'sandbox',
    disconnectedAt: null,
    providerAccountId: null,
    walletId: null,
    healthIssue: null,
    lastErrorCode: null,
    provisioningAttempts: 1,
    nextAttemptAt: clock,
    lockedUntil: null,
    requestedByUserId: 'owner-alfa',
    updatedAt: clock,
    organization: {
      id: 'tenant-alfa',
      status: 'ACTIVE',
      access: 'FULL',
      ownerUserId: 'owner-alfa',
      documentNormalized: document,
      document,
      updatedAt: clock,
    },
    integration: {
      id: 'integration-alfa',
      tenantId: 'tenant-alfa',
      provider: 'ASAAS',
      environment: 'sandbox',
      credentialSource: 'VAULT',
      status: 'PROVISIONING',
      externalAccountId: null,
      updatedAt: clock,
    },
  }
  find.mockImplementation(async () => {
    expect(inTransaction).toBe(false)
    return { ...found }
  })
  audit.mockImplementation(async ({ data }) => ({ id: 'receipt', ...data }))
  upsert.mockImplementation(async ({ create }) => ({ id: 'queued', ...create }))
  purge.mockResolvedValue({ count: 1 })
})
const purgedWith = (reason: string) =>
  expect(purge).toHaveBeenCalledWith({
    where: { paymentAccountId: row.id, purgedAt: null },
    data: {
      purgedAt: clock,
      purgeReason: reason,
      incomeValue: null,
      mobilePhone: null,
    },
  })

describe('uncertain subaccount creation recovery', () => {
  it('one point-confirmed account requires manual key recovery, never a second creation or approval', async () => {
    await run()
    expect(find).toHaveBeenCalledWith(document)
    expect(find).toHaveBeenCalledTimes(1)
    expect(providerCreate).not.toHaveBeenCalled()
    expect(row).toMatchObject({
      status: 'KEY_RECOVERY_REQUIRED',
      providerAccountId: found.id,
      walletId: found.walletId,
      healthIssue: 'KEY_DISABLED',
      lastErrorCode: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
      lockedUntil: null,
    })
    expect(row.integration).toMatchObject({
      status: 'PROVISIONING',
      externalAccountId: found.id,
    })
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: row.tenantId,
        action: 'payment-account.provisioning.key-recovery-required',
        reasonCategory: 'SUBACCOUNT_KEY_RECOVERY_REQUIRED',
      }),
    })
    await run()
    expect(find).toHaveBeenCalledTimes(1)
    expect(upsert).not.toHaveBeenCalled()
  })
  it.each([
    null,
    new BillingProviderError('UNAVAILABLE', { reason: 'TIMEOUT' }),
    new Error('private provider details'),
  ])(
    'absence or unavailable read keeps UNKNOWN and queues only a future inspection: %s',
    async (result) => {
      find.mockImplementation(async () => {
        if (result instanceof Error) throw result
        return result
      })
      await run()
      expect(row.status).toBe('UNKNOWN')
      expect(row.lockedUntil).toBeNull()
      expect(row.nextAttemptAt).toEqual(new Date(clock.getTime() + 300_000))
      expect(row.lastErrorCode).toBe(
        result === null
          ? 'SUBACCOUNT_NOT_OBSERVED'
          : 'SUBACCOUNT_LOOKUP_UNAVAILABLE'
      )
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            topic: message.topic,
            tenantId: row.tenantId,
            aggregateId: row.id,
            payload: { accountId: row.id },
            availableAt: row.nextAttemptAt,
          }),
        })
      )
      expect(
        JSON.stringify([row.lastErrorCode, upsert.mock.calls, audit.mock.calls])
      ).not.toContain('private')
      expect(providerCreate).not.toHaveBeenCalled()
    }
  )
  it.each(['REJECTED', 'INVALID_RESPONSE'] as const)(
    'blocks ambiguous or invalid %s evidence without trusting it',
    async (code) => {
      find.mockRejectedValue(
        new BillingProviderError(code, { reason: 'AMBIGUOUS_MATCH' })
      )
      await run()
      expect(row.status).toBe('BLOCKED')
      expect(row.providerAccountId).toBeNull()
      expect(row.lastErrorCode).toBe('SUBACCOUNT_LOOKUP_INVALID')
      expect(upsert).not.toHaveBeenCalled()
    }
  )
  it.each([
    { status: 'PROVISIONING' },
    { status: 'BLOCKED' },
    { status: 'APPROVED' },
    { mode: 'ASAAS_CONNECTED_ACCOUNT' },
    { environment: 'production' },
    { provisioningAttempts: 0 },
    { disconnectedAt: clock },
    { requestedByUserId: null },
  ])(
    'does not inspect a row without the matching uncertain intent: %j',
    async (extra) => {
      Object.assign(row, extra)
      await run()
      expect(find).not.toHaveBeenCalled()
      expect(tx.paymentAccount.update).not.toHaveBeenCalled()
    }
  )
  it.each([
    ['organization', { status: 'SUSPENDED' }],
    ['organization', { access: 'ARCHIVED' }],
    ['organization', { ownerUserId: 'other-owner' }],
    ['integration', { tenantId: 'foreign' }],
    ['integration', { provider: 'OTHER' }],
    ['integration', { credentialSource: 'ENV' }],
    ['integration', { environment: 'production' }],
    ['integration', { status: 'DISABLED' }],
  ] as const)('preserves a changed %s binding: %j', async (target, extra) => {
    Object.assign(row[target], extra)
    await run()
    expect(find).not.toHaveBeenCalled()
  })
  it('does not overwrite a key recovered by another process', async () => {
    activeKey = { id: 'recovered-key' }
    await run()
    expect(find).not.toHaveBeenCalled()
  })
  it.each([
    () => {
      row.status = 'BLOCKED'
    },
    () => {
      row.organization.ownerUserId = 'other-owner'
    },
    () => {
      activeKey = { id: 'recovered-key' }
    },
    () => {
      row.integration.updatedAt = new Date(++stamp)
    },
    () => {
      row.organization.documentNormalized = '12ABC34501DE35'
    },
    () => {
      row.provisioningAttempts++
    },
  ])(
    'ignores provider completion after a concurrent binding change',
    async (change) => {
      find.mockImplementation(async () => {
        change()
        return found
      })
      await run()
      expect(audit).not.toHaveBeenCalled()
      expect(row.providerAccountId).toBeNull()
    }
  )
  it.each([
    { document: '12ABC34501DE35' },
    { id: '../foreign' },
    { walletId: '../wallet' },
  ])(
    'does not trust a provider port returning foreign references: %j',
    async (extra) => {
      find.mockResolvedValue({ ...found, ...extra })
      await run()
      expect(row.status).toBe('BLOCKED')
      expect(row.lastErrorCode).toBe('SUBACCOUNT_REFERENCE_MISMATCH')
      expect(row.providerAccountId).toBeNull()
    }
  )
  it.each(['providerAccountId', 'walletId'] as const)(
    'does not replace an existing %s binding',
    async (field) => {
      row[field] = 'foreign-reference'
      await run()
      expect(row.status).toBe('BLOCKED')
      expect(row[field]).toBe('foreign-reference')
    }
  )
  it.each(['account', 'integration'])(
    'a %s reference already owned elsewhere blocks assignment',
    async (which) => {
      conflict = which === 'account'
      integrationConflict = which === 'integration'
      await run()
      expect(row.status).toBe('BLOCKED')
      expect(row.lastErrorCode).toBe('SUBACCOUNT_REFERENCE_CONFLICT')
      expect(row.providerAccountId).toBeNull()
      expect(tx.tenantIntegration.update).not.toHaveBeenCalled()
    }
  )
  it.each(['lease', 'agenda'])(
    'a current %s defers without external I/O',
    async (which) => {
      const future = new Date(clock.getTime() + 60_000)
      row[which === 'lease' ? 'lockedUntil' : 'nextAttemptAt'] = future
      await expect(run()).rejects.toMatchObject({ availableAt: future })
      expect(find).not.toHaveBeenCalled()
    }
  )
  it('a forged tenant or aggregate cannot touch another account', async () => {
    await run({ ...message, tenantId: 'foreign' })
    expect(find).not.toHaveBeenCalled()
    await expect(run({ ...message, aggregateId: 'other' })).rejects.toThrow(
      'INVALID_ACCOUNT_MESSAGE'
    )
    expect(tx.paymentAccount.update).not.toHaveBeenCalled()
  })
  it('a tenant reassignment between initial lookup and row locks is refused', async () => {
    tx.paymentAccount.findUniqueOrThrow.mockResolvedValueOnce({
      ...row,
      tenantId: 'foreign',
      integrationId: 'foreign-integration',
      organization: { ...row.organization, id: 'foreign' },
      integration: {
        ...row.integration,
        id: 'foreign-integration',
        tenantId: 'foreign',
      },
    })
    await run()
    expect(find).not.toHaveBeenCalled()
    expect(tx.paymentAccount.update).not.toHaveBeenCalled()
  })
  it('invalid local CNPJ stops before lookup', async () => {
    row.organization.documentNormalized = row.organization.document = 'invalid'
    await run()
    expect(find).not.toHaveBeenCalled()
    expect(row.status).toBe('BLOCKED')
    expect(row.lastErrorCode).toBe('ACCOUNT_DOCUMENT_MISMATCH')
  })
  it('the claim purges the declared values: from an uncertain creation no POST is ever possible again', async () => {
    find.mockImplementation(async () => {
      purgedWith('UNCERTAIN')
      return null
    })
    await run()
    expect(find).toHaveBeenCalledTimes(1)
    expect(purge).toHaveBeenCalledTimes(1)
  })
  it('a review state purges the request in the same transaction', async () => {
    find.mockRejectedValue(
      new BillingProviderError('INVALID_RESPONSE', {
        reason: 'UNEXPECTED_SHAPE',
      })
    )
    await run()
    expect(row.status).toBe('BLOCKED')
    purgedWith('BLOCKED')
  })
  it.each([
    [401, 'AUTHENTICATION'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION'],
    [422, 'CLIENT_ERROR'],
  ] as const)(
    'a %s from the root credential on the lookup keeps the creation pending for an hour, never in review',
    async (status, reason) => {
      find.mockRejectedValue(
        new BillingProviderError('REJECTED', { reason, status })
      )
      await run()
      expect(row).toMatchObject({
        status: 'UNKNOWN',
        lastErrorCode: 'ROOT_CREDENTIAL_REJECTED',
        lockedUntil: null,
        nextAttemptAt: new Date(clock.getTime() + 3_600_000),
        providerAccountId: null,
      })
      expect(audit).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'payment-account.provisioning.root-rejected',
          reasonCategory: reason,
          tenantId: row.tenantId,
        }),
      })
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            topic: message.topic,
            availableAt: new Date(clock.getTime() + 3_600_000),
            dedupeKey:
              'subaccount-recovery:' +
              row.id +
              ':' +
              new Date(clock.getTime() + 3_600_000).toISOString(),
          }),
        })
      )
      expect(providerCreate).not.toHaveBeenCalled()
    }
  )
  it('the existing queue scans only bounded due uncertain attempts and preserves the original agenda', async () => {
    expect(await worker().enqueue()).toBe(1)
    expect(tx.paymentAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mode: 'ASAAS_SUBACCOUNT',
          status: 'UNKNOWN',
          provisioningAttempts: { gt: 0 },
          environment: 'sandbox',
        }),
        take: 20,
      })
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          availableAt: clock,
          tenantId: row.tenantId,
          topic: message.topic,
          payload: { accountId: row.id },
        }),
      })
    )
    activeKey = { id: 'recovered' }
    expect(await worker().enqueue()).toBe(0)
  })
})
