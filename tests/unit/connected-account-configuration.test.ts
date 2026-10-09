import { beforeEach, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createConnectedAccountConfiguration } from '../../packages/backend/src/modules/payment-accounts/index'
import {
  ACCOUNT_WEBHOOK_EVENTS,
  BillingProviderError,
} from '../../packages/backend/src/modules/billing/index'
import { SecretValue } from '../../packages/backend/src/modules/secrets/secret-value'

let clock: Date,
  row: any,
  inTransaction: boolean,
  stamp: number,
  hooks: any[],
  keyId: string,
  storedIncident: { id: string; createdAt: Date } | null
const identity = vi.fn(),
  create = vi.fn(),
  configure = vi.fn(),
  list = vi.fn(),
  audit = vi.fn()
const tx = {
  $executeRaw: vi.fn(async () => 0),
  $queryRaw: vi.fn(async (parts: TemplateStringsArray) =>
    parts.join('').includes('pg_roles') ? [{ platform: true, safe: true }] : []
  ),
  integrationSecret: {
    findFirst: vi.fn(
      async (): Promise<{ id: string; expiresAt: Date | null } | null> => ({
        id: keyId,
        expiresAt: null,
      })
    ),
  },
  paymentAccount: {
    findFirst: vi.fn(async ({ where }: any) =>
      where.tenantId === row.tenantId ? structuredClone(row) : null
    ),
    findUniqueOrThrow: vi.fn(async () => structuredClone(row)),
    update: vi.fn(async ({ data }: any) => {
      if (data.provisioningAttempts)
        data = { ...data, provisioningAttempts: row.provisioningAttempts + 1 }
      Object.assign(row, data, { updatedAt: new Date(++stamp) })
      return structuredClone(row)
    }),
    findMany: vi.fn(async () => [structuredClone(row)]),
  },
  tenantIntegration: {
    update: vi.fn(async ({ data }: any) => {
      Object.assign(row.integration, data, { updatedAt: new Date(++stamp) })
      return structuredClone(row.integration)
    }),
  },
  organization: {
    // Another company that already verified the CNPJ (none unless a case says so).
    findFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
    update: vi.fn(async ({ data }: any) => {
      Object.assign(row.organization, data)
      return row.organization
    }),
  },
  platformAuditLog: {
    create: async (input: any) => {
      const result = await audit(input)
      if (input.data.action === 'payment-account.reconciliation.started')
        storedIncident = result
      return result
    },
    findFirst: vi.fn(async ({ where }: any) =>
      where.action === 'payment-account.reconciliation.started'
        ? storedIncident
        : null
    ),
  },
  platformOutboxEvent: { upsert: vi.fn(async ({ create }: any) => create) },
}
const transaction = async <T>(
  fn: (_tx: Prisma.TransactionClient) => Promise<T>
) => {
  inTransaction = true
  try {
    return await fn(tx as unknown as Prisma.TransactionClient)
  } finally {
    inTransaction = false
  }
}
const token = new SecretValue('synthetic-stable-webhook-token'.repeat(2))
const run = (extra = {}) =>
  createConnectedAccountConfiguration({
    transaction,
    environment: 'sandbox',
    origin: 'https://api.example.test',
    email: 'ops@example.test',
    token: () => token,
    provider: async () => {
      expect(inTransaction).toBe(false)
      return { identity, webhooks: { list, create, configure }, ...extra }
    },
    now: () => clock,
  })
const message = (extra = {}) => ({
  id: 'job',
  topic: 'payment-accounts.health',
  tenantId: 'tenant-alfa',
  aggregateId: 'account-alfa',
  payload: { accountId: 'account-alfa' },
  dedupeKey: 'job',
  attempts: 1,
  lockedBy: 'worker',
  ...extra,
})
const execute = (msg = message()) =>
  run().handlers['payment-accounts.health'](msg)
const ready = () => ({
  id: 'hook-alfa',
  url: 'https://api.example.test/api/webhooks/asaas/integration-alfa',
  name: 'Locadora-integration-alfa',
  apiVersion: 3,
  enabled: true,
  interrupted: false,
  sendType: 'SEQUENTIALLY',
  events: [...ACCOUNT_WEBHOOK_EVENTS],
})
beforeEach(() => {
  vi.clearAllMocks()
  stamp = 1
  inTransaction = false
  clock = new Date('2026-10-04T15:00:00Z')
  keyId = 'secret-alfa'
  storedIncident = null
  hooks = []
  row = {
    id: 'account-alfa',
    tenantId: 'tenant-alfa',
    integrationId: 'integration-alfa',
    mode: 'ASAAS_CONNECTED_ACCOUNT',
    environment: 'sandbox',
    status: 'RESTRICTED',
    healthIssue: 'WEBHOOK_MISSING',
    disconnectedAt: null,
    approvedAt: null,
    provisioningAttempts: 0,
    lockedUntil: null,
    lastErrorCode: null,
    nextAttemptAt: clock,
    updatedAt: new Date(stamp),
    commercialInfoExpired: false,
    organization: {
      id: 'tenant-alfa',
      status: 'ACTIVE',
      access: 'SETUP',
      document: '11222333000181',
      documentNormalized: null,
      documentVerifiedAt: null,
    },
    integration: {
      id: 'integration-alfa',
      tenantId: 'tenant-alfa',
      provider: 'ASAAS',
      environment: 'sandbox',
      status: 'PROVISIONING',
      credentialSource: 'VAULT',
      webhookTokenHash: null,
      updatedAt: new Date(stamp),
    },
  }
  identity.mockImplementation(async () => {
    expect(inTransaction).toBe(false)
    return {
      document: row.organization.document,
      status: {
        id: 'status-not-account',
        commercialInfo: 'APPROVED',
        bankAccountInfo: 'APPROVED',
        documentation: 'APPROVED',
        general: 'APPROVED',
      },
    }
  })
  list.mockImplementation(async () => {
    expect(inTransaction).toBe(false)
    return structuredClone(hooks)
  })
  create.mockImplementation(async () => {
    expect(inTransaction).toBe(false)
    expect(row.integration.webhookTokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(row.lastErrorCode).toBe('WEBHOOK_CREATE_PENDING')
    hooks = [ready()]
    return ready()
  })
  configure.mockImplementation(async () => {
    expect(inTransaction).toBe(false)
    hooks = [ready()]
    return ready()
  })
})
it('persists authentication before POST, verifies current facts/settings and commits readiness atomically', async () => {
  await execute()
  expect(create).toHaveBeenCalledTimes(1)
  expect(list).toHaveBeenCalledTimes(2)
  expect(row).toMatchObject({
    status: 'APPROVED',
    healthIssue: null,
    lastErrorCode: null,
    lockedUntil: null,
    approvedAt: clock,
  })
  expect(row.integration.status).toBe('ACTIVE')
  expect(row.organization.documentVerifiedAt).toEqual(clock)
  // The legacy registration had no normalized CNPJ; the verification records it (CHECK organizations_document_verified).
  expect(row.organization.documentNormalized).toBe('11222333000181')
  expect(tx.organization.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        documentVerifiedAt: { not: null },
        documentNormalized: '11222333000181',
      },
    })
  )
  expect(row).not.toHaveProperty('providerAccountId')
  expect(row).not.toHaveProperty('walletId')
  expect(JSON.stringify(row) + JSON.stringify(audit.mock.calls)).not.toContain(
    token.use((value) => value)
  )
})
it('never repeats POST after a lost response, including a subsequent unavailable read', async () => {
  create.mockRejectedValueOnce(
    new BillingProviderError('AMBIGUOUS', {
      reason: 'TIMEOUT',
      maybeApplied: true,
    })
  )
  await expect(execute()).rejects.toThrow('WEBHOOK_CREATE_UNKNOWN')
  expect(row.lastErrorCode).toBe('WEBHOOK_CREATE_UNKNOWN')
  expect(row.status).toBe('RESTRICTED')
  clock = new Date(clock.getTime() + 300000)
  list.mockRejectedValueOnce(new Error('sensitive-provider-payload'))
  await expect(execute()).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  expect(row.lastErrorCode).toBe('WEBHOOK_CREATE_UNKNOWN')
  clock = new Date(clock.getTime() + 300000)
  await expect(execute()).rejects.toThrow('WEBHOOK_CREATE_UNKNOWN')
  expect(create).toHaveBeenCalledTimes(1)
  expect(configure).not.toHaveBeenCalled()
})
it('a creation the confirming listing could not read stays uncertain: a webhook still not listed is never posted again', async () => {
  list
    .mockImplementationOnce(async () => [])
    .mockRejectedValueOnce(new Error('synthetic-unavailable-listing'))
  await expect(execute()).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  expect(row.lastErrorCode).toBe('WEBHOOK_CREATE_UNKNOWN')
  clock = new Date(clock.getTime() + 300000)
  hooks = []
  await expect(execute()).rejects.toThrow('WEBHOOK_CREATE_UNKNOWN')
  expect(create).toHaveBeenCalledTimes(1)
  expect(row.status).toBe('RESTRICTED')
})
it('recovers an uncertain creation through listing and a stable PUT, without another POST', async () => {
  row.lastErrorCode = 'WEBHOOK_CREATE_PENDING'
  hooks = [ready()]
  await execute()
  expect(create).not.toHaveBeenCalled()
  expect(configure).toHaveBeenCalledWith(
    'hook-alfa',
    expect.objectContaining({ token })
  )
  expect(row.status).toBe('APPROVED')
})
it('reasserts authentication during daily inspection because GET does not disclose the token', async () => {
  await execute()
  clock = new Date(clock.getTime() + 86400000)
  await execute()
  expect(create).toHaveBeenCalledTimes(1)
  expect(configure).toHaveBeenCalledTimes(1)
})
it.each(['BLOCKED', 'DISCONNECTED'])(
  'does not mutate a %s account',
  async (status) => {
    row.status = status
    await execute()
    expect(identity).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  }
)
it('does not use the root key, other environment, archived tenant, or legacy environment reference', async () => {
  for (const patch of [
    () => (row.environment = 'production'),
    () => (row.organization.access = 'ARCHIVED'),
    () => (row.integration.credentialSource = 'ENV_REF'),
    () => (row.organization.status = 'SUSPENDED'),
  ]) {
    const original = structuredClone(row)
    patch()
    await execute()
    expect(identity).not.toHaveBeenCalled()
    row = original
  }
})
it('revalidates credential and document after I/O without overwriting a concurrent change', async () => {
  identity.mockImplementationOnce(async () => {
    keyId = 'secret-replacement'
    row.status = 'BLOCKED'
    row.updatedAt = new Date(++stamp)
    return {
      document: row.organization.document,
      status: {
        general: 'APPROVED',
        commercialInfo: 'APPROVED',
        bankAccountInfo: 'APPROVED',
        documentation: 'APPROVED',
      },
    }
  })
  await expect(execute()).rejects.toThrow('ACCOUNT_BINDING_CHANGED')
  expect(row.status).toBe('BLOCKED')
  expect(create).not.toHaveBeenCalled()
  expect(configure).not.toHaveBeenCalled()
})
it('refuses a changed company and malformed provider identity before writes', async () => {
  identity.mockResolvedValueOnce({ document: '123', status: {} })
  await expect(execute()).rejects.toThrow('ACCOUNT_DOCUMENT_MISMATCH')
  expect(create).not.toHaveBeenCalled()
  expect(row.status).toBe('RESTRICTED')
})
it('a CNPJ changed after the webhook was confirmed is refused under the lock, keeps the new value and is not a creation uncertainty', async () => {
  const provider = row.organization.document
  identity.mockImplementation(async () => ({
    document: provider,
    status: {
      general: 'APPROVED',
      commercialInfo: 'APPROVED',
      bankAccountInfo: 'APPROVED',
      documentation: 'APPROVED',
    },
  }))
  list
    .mockImplementationOnce(async () => [])
    .mockImplementationOnce(async () => {
      // The company's CNPJ is corrected while the created webhook is being confirmed.
      Object.assign(row.organization, {
        document: '11444777000161',
        documentNormalized: '11444777000161',
      })
      return structuredClone(hooks)
    })
  await expect(execute()).rejects.toThrow('COMPANY_DATA_CHANGED')
  expect(create).toHaveBeenCalledTimes(1)
  // The listing proved the creation: the failure is the company's, not an uncertain POST.
  expect(row).toMatchObject({
    status: 'RESTRICTED',
    approvedAt: null,
    lastErrorCode: 'COMPANY_DATA_CHANGED',
  })
  expect(row.integration.status).toBe('PROVISIONING')
  expect(row.organization).toMatchObject({
    documentNormalized: '11444777000161',
    documentVerifiedAt: null,
  })
  // The provider still reports the previous CNPJ: the next inspection refuses it, without another POST.
  clock = new Date(clock.getTime() + 300000)
  await expect(execute()).rejects.toThrow('ACCOUNT_DOCUMENT_MISMATCH')
  expect(row.lastErrorCode).toBe('ACCOUNT_DOCUMENT_MISMATCH')
  expect(create).toHaveBeenCalledTimes(1)
  expect(row.organization).toMatchObject({
    documentNormalized: '11444777000161',
    documentVerifiedAt: null,
  })
  expect(
    audit.mock.calls.some(
      ([input]) =>
        input.data.action === 'payment-account.configuration.confirmed'
    )
  ).toBe(false)
})
it.each([
  () => [ready(), { ...ready(), id: 'hook-other' }],
  () => [{ ...ready(), name: 'Foreign' }],
])(
  'does not take ownership of ambiguous or foreign webhooks',
  async (values) => {
    hooks = values()
    await expect(execute()).rejects.toThrow('WEBHOOK_OWNERSHIP_CONFLICT')
    expect(create).not.toHaveBeenCalled()
    expect(configure).not.toHaveBeenCalled()
  }
)
it('requires reconciliation before resuming an interrupted queue, even if somebody later restarts it externally', async () => {
  hooks = [{ ...ready(), interrupted: true }]
  await expect(execute()).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
  expect(row.healthIssue).toBe('WEBHOOK_INTERRUPTED')
  expect(configure).not.toHaveBeenCalled()
  clock = new Date(clock.getTime() + 300000)
  hooks = [ready()]
  identity.mockRejectedValueOnce(new Error('synthetic-unavailable-read'))
  await expect(execute()).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  expect(row.lastErrorCode).toBe('WEBHOOK_RECONCILIATION_REQUIRED')
  expect(row.healthIssue).toBe('WEBHOOK_INTERRUPTED')
  clock = new Date(clock.getTime() + 300000)
  tx.integrationSecret.findFirst.mockResolvedValueOnce(null)
  await execute()
  expect(row.lastErrorCode).toBe('WEBHOOK_RECONCILIATION_REQUIRED')
  expect(row.healthIssue).toBe('WEBHOOK_INTERRUPTED')
  clock = new Date(clock.getTime() + 86400000)
  await expect(execute()).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
  expect(row.status).toBe('RESTRICTED')
  expect(configure).not.toHaveBeenCalled()
})
it.each([false, true])(
  'persists restriction before financial recovery; snapshot complete=%s never resumes delivery',
  async (complete) => {
    hooks = [{ ...ready(), interrupted: true }]
    audit.mockResolvedValueOnce({ id: 'incident-alfa', createdAt: clock })
    const reconcilePayments = vi.fn(async (target) => {
      expect(inTransaction).toBe(false)
      expect(row).toMatchObject({
        status: 'RESTRICTED',
        healthIssue: 'WEBHOOK_INTERRUPTED',
        lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
      })
      expect(target).toEqual({
        tenantId: row.tenantId,
        integrationId: row.integrationId,
        environment: 'sandbox',
        accountId: row.id,
        keyId,
        incidentId: 'incident-alfa',
      })
      return { complete, checked: 5 }
    })
    await expect(
      run({ reconcilePayments }).handlers['payment-accounts.health'](message())
    ).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
    expect(reconcilePayments).toHaveBeenCalledTimes(1)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'payment-account.reconciliation.progress',
          metadata: {
            incidentId: 'incident-alfa',
            keyId,
            complete,
            checked: 5,
          },
        }),
      })
    )
    expect(create).not.toHaveBeenCalled()
    expect(configure).not.toHaveBeenCalled()
    expect(row.lastErrorCode).toBe('WEBHOOK_RECONCILIATION_REQUIRED')
  }
)
it('a failed financial read preserves the incident and does not configure the hook', async () => {
  hooks = [{ ...ready(), interrupted: true }]
  audit.mockResolvedValueOnce({ id: 'incident-alfa', createdAt: clock })
  const reconcilePayments = vi.fn(async () => {
    throw new Error('private-provider-detail')
  })
  await expect(
    run({ reconcilePayments }).handlers['payment-accounts.health'](message())
  ).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  expect(row.lastErrorCode).toBe('WEBHOOK_RECONCILIATION_REQUIRED')
  expect(audit).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: 'payment-account.reconciliation.blocked',
        reasonCategory: 'RECONCILIATION_PROVIDER_UNAVAILABLE',
      }),
    })
  )
  expect(JSON.stringify(audit.mock.calls)).not.toContain(
    'private-provider-detail'
  )
  expect(configure).not.toHaveBeenCalled()
})
it('reuses the same durable incident across configuration retries', async () => {
  hooks = [{ ...ready(), interrupted: true }]
  storedIncident = { id: 'existing-incident', createdAt: clock }
  const reconcilePayments = vi.fn(async (target) => {
    expect(target.incidentId).toBe('existing-incident')
    return { complete: false, checked: 5 }
  })
  await expect(
    run({ reconcilePayments }).handlers['payment-accounts.health'](message())
  ).rejects.toThrow('WEBHOOK_RECONCILIATION_REQUIRED')
  expect(
    audit.mock.calls.some(
      ([input]) =>
        input.data.action === 'payment-account.reconciliation.started'
    )
  ).toBe(false)
  expect(configure).not.toHaveBeenCalled()
})
it('stores a fixed review reason for a malformed financial checkpoint and never resumes the hook', async () => {
  hooks = [{ ...ready(), interrupted: true }]
  audit.mockResolvedValueOnce({ id: 'incident-alfa', createdAt: clock })
  const reconcilePayments = vi.fn(async () => ({ complete: true, checked: -1 }))
  await expect(
    run({ reconcilePayments }).handlers['payment-accounts.health'](message())
  ).rejects.toThrow('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  expect(audit).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: 'payment-account.reconciliation.blocked',
        reasonCategory: 'RECONCILIATION_CHECKPOINT_INVALID',
        metadata: { incidentId: 'incident-alfa', keyId },
      }),
    })
  )
  expect(
    audit.mock.calls.some(
      ([input]) =>
        input.data.action === 'payment-account.reconciliation.progress'
    )
  ).toBe(false)
  expect(configure).not.toHaveBeenCalled()
})
it('cannot publish a completed receipt from an incident replaced during provider I/O', async () => {
  hooks = [{ ...ready(), interrupted: true }]
  audit.mockResolvedValueOnce({ id: 'old-incident', createdAt: clock })
  const reconcilePayments = vi.fn(async () => {
    storedIncident = {
      id: 'new-owner-incident',
      createdAt: new Date(clock.getTime() + 1),
    }
    return { complete: true, checked: 5 }
  })
  await expect(
    run({ reconcilePayments }).handlers['payment-accounts.health'](message())
  ).rejects.toThrow('RECONCILIATION_INCIDENT_CHANGED')
  expect(
    audit.mock.calls.some(([input]) =>
      [
        'payment-account.reconciliation.progress',
        'payment-account.reconciliation.blocked',
      ].includes(input.data.action)
    )
  ).toBe(false)
  expect(configure).not.toHaveBeenCalled()
  expect(row.status).toBe('RESTRICTED')
})
it('does not approve inconsistent pending documents or annual expiry', async () => {
  identity.mockResolvedValueOnce({
    document: row.organization.document,
    status: {
      general: 'APPROVED',
      commercialInfo: 'APPROVED',
      bankAccountInfo: 'APPROVED',
      documentation: 'PENDING',
    },
  })
  await execute()
  expect(row.status).toBe('UNDER_REVIEW')
  expect(row.organization.documentVerifiedAt).toBeNull()
  clock = new Date(clock.getTime() + 86400000)
  row.commercialInfoExpired = true
  await execute()
  expect(row.status).toBe('RESTRICTED')
  expect(row.healthIssue).toBe('COMMERCIAL_INFO_EXPIRED')
})
it.each([
  ['PENDING', 'AWAITING_OWNER'],
  ['AWAITING_APPROVAL', 'UNDER_REVIEW'],
  ['REJECTED', 'REJECTED'],
] as const)(
  'a connected account still %s at the provider keeps the previous rule: the confirmation activates its integration (%s)',
  async (state, status) => {
    identity.mockResolvedValueOnce({
      document: row.organization.document,
      status: {
        id: 'status-not-account',
        commercialInfo: state,
        bankAccountInfo: state,
        documentation: state,
        general: state,
      },
    })
    await execute()
    expect(row).toMatchObject({ status, approvedAt: null, lastErrorCode: null })
    expect(row.integration.status).toBe('ACTIVE')
    expect(row.organization.documentVerifiedAt).toBeNull()
  }
)
it('a CNPJ another company verified first is not verified again: the approval is confirmed and goes to review once', async () => {
  // Once per inspection: the first approval and the next daily one.
  tx.organization.findFirst
    .mockResolvedValueOnce({ id: 'tenant-bravo' })
    .mockResolvedValueOnce({ id: 'tenant-bravo' })
  await execute()
  expect(row).toMatchObject({ status: 'APPROVED', approvedAt: clock })
  expect(row.integration.status).toBe('ACTIVE')
  expect(row.organization).toMatchObject({
    documentVerifiedAt: null,
    documentNormalized: null,
  })
  expect(tx.organization.update).not.toHaveBeenCalled()
  const review = () =>
    audit.mock.calls.filter(
      ([input]) => input.data.action === 'payment-account.document.in-use'
    )
  expect(review()).toEqual([
    [
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-alfa',
          targetId: 'account-alfa',
          reasonCategory: 'DOCUMENT_IN_USE',
        }),
      }),
    ],
  ])
  clock = new Date(clock.getTime() + 86400000)
  await execute()
  expect(row.status).toBe('APPROVED')
  expect(review()).toHaveLength(1)
})
it('deduplicates jobs by the persisted inspection deadline, without a secret in the payload', async () => {
  await run().enqueue()
  expect(tx.platformOutboxEvent.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        tenantId: row.tenantId,
        aggregateId: row.id,
        payload: { accountId: row.id },
        dedupeKey: 'account-health:' + row.id + ':' + clock.toISOString(),
      }),
    })
  )
})
it('rejects invalid job bindings and claims a live account lease before any I/O', async () => {
  await expect(execute(message({ tenantId: 'tenant-bravo' }))).rejects.toThrow(
    'ACCOUNT_NOT_FOUND'
  )
  await expect(
    execute(message({ aggregateId: 'account-other' }))
  ).rejects.toThrow('INVALID_ACCOUNT_MESSAGE')
  row.lockedUntil = new Date(clock.getTime() + 60000)
  await expect(execute()).rejects.toThrow('ACCOUNT_BUSY')
  expect(identity).not.toHaveBeenCalled()
})
const subaccount = (status = 'AWAITING_OWNER') => {
  row.mode = 'ASAAS_SUBACCOUNT'
  row.status = status
  row.healthIssue = null
  row.lastErrorCode = 'WEBHOOK_UPDATE_PENDING'
  row.integration.webhookTokenHash = 'b'.repeat(64)
  // The creation embedded the account webhook with a random token; only PUT can replace it.
  hooks = [ready()]
}
const pending = {
  id: 'status-not-account',
  commercialInfo: 'PENDING',
  bankAccountInfo: 'PENDING',
  documentation: 'PENDING',
  general: 'PENDING',
}
it('a sealed subaccount receives the PUT of its embedded webhook and keeps the integration PROVISIONING until approval', async () => {
  subaccount()
  identity.mockResolvedValueOnce({
    document: row.organization.document,
    status: pending,
  })
  await execute()
  expect(create).not.toHaveBeenCalled()
  expect(configure).toHaveBeenCalledWith(
    'hook-alfa',
    expect.objectContaining({ token })
  )
  expect(row).toMatchObject({
    status: 'AWAITING_OWNER',
    lastErrorCode: null,
    approvedAt: null,
  })
  expect(row.integration.status).toBe('PROVISIONING')
  // The random creation token stays accepted for 24 h after the recoverable token replaces it.
  expect(row.integration.webhookTokenPreviousHash).toBe('b'.repeat(64))
  expect(row.integration.webhookTokenPreviousUntil).toEqual(
    new Date(clock.getTime() + 86400000)
  )
  expect(row.organization.documentVerifiedAt).toBeNull()
})
it('four approved states approve the subaccount, verify the CNPJ and only then activate its integration', async () => {
  subaccount()
  await execute()
  expect(row).toMatchObject({ status: 'APPROVED', approvedAt: clock })
  expect(row.integration.status).toBe('ACTIVE')
  expect(row.organization.documentVerifiedAt).toEqual(clock)
  // A later regression restricts the account but never demotes the integration.
  clock = new Date(clock.getTime() + 86400000)
  row.commercialInfoExpired = true
  const updates = tx.tenantIntegration.update.mock.calls.length
  await execute()
  expect(row).toMatchObject({
    status: 'RESTRICTED',
    healthIssue: 'COMMERCIAL_INFO_EXPIRED',
  })
  expect(row.integration.status).toBe('ACTIVE')
  expect(
    tx.tenantIntegration.update.mock.calls
      .slice(updates)
      .some(([input]: any) => input.data.status)
  ).toBe(false)
})
it.each([
  'PROVISIONING',
  'UNKNOWN',
  'KEY_RECOVERY_REQUIRED',
  'BLOCKED',
  'DISCONNECTED',
])('never touches a subaccount in %s', async (status) => {
  subaccount(status)
  const before = structuredClone(row)
  await execute()
  expect(identity).not.toHaveBeenCalled()
  expect(configure).not.toHaveBeenCalled()
  expect(audit).not.toHaveBeenCalled()
  expect(row).toEqual(before)
})
it('the delivery the creation queued 15 s after sealing is due when it runs', async () => {
  subaccount()
  const sealedAt = clock
  row.nextAttemptAt = new Date(sealedAt.getTime() + 15000)
  await execute()
  expect(identity).not.toHaveBeenCalled()
  clock = new Date(sealedAt.getTime() + 15000)
  await execute()
  expect(configure).toHaveBeenCalledTimes(1)
  expect(row.status).toBe('APPROVED')
})
it('the sweep selects each mode with its own excluded states', async () => {
  await run().enqueue()
  const where = (tx.paymentAccount.findMany.mock.calls.at(-1) as any)[0].where
  expect(where.OR).toEqual([
    {
      mode: 'ASAAS_CONNECTED_ACCOUNT',
      status: { notIn: ['BLOCKED', 'DISCONNECTED'] },
    },
    {
      mode: 'ASAAS_SUBACCOUNT',
      status: {
        notIn: [
          'PROVISIONING',
          'UNKNOWN',
          'KEY_RECOVERY_REQUIRED',
          'BLOCKED',
          'DISCONNECTED',
        ],
      },
    },
  ])
  expect(where).toMatchObject({
    environment: 'sandbox',
    disconnectedAt: null,
    nextAttemptAt: { lte: clock },
  })
})
