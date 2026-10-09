import { beforeEach, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createOwnerPaymentAccountConnection } from '../../packages/backend/src/modules/payment-accounts/index'
import { SecretVaultError } from '../../packages/backend/src/modules/secrets/index'

const principal = {
  tenantId: 'tenant-alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN' as const,
}
const at = new Date('2026-10-04T15:00:00Z')
const apiKey = '$aact_hmlg_' + 'synthetic'.repeat(8)
const facts = {
  document: '11222333000181',
  status: {
    id: 'status-not-account-id',
    general: 'APPROVED' as const,
    commercialInfo: 'APPROVED' as const,
    bankAccountInfo: 'APPROVED' as const,
    documentation: 'APPROVED' as const,
  },
}
const org = {
  status: 'ACTIVE',
  access: 'SETUP',
  ownerUserId: principal.userId,
  document: facts.document,
}
const tx = {
  $queryRaw: vi.fn(),
  membership: { findFirst: vi.fn() },
  paymentAccount: { findFirst: vi.fn(), create: vi.fn() },
  tenantIntegration: { findMany: vi.fn(), create: vi.fn() },
  integrationSecret: { count: vi.fn() },
  platformAuditLog: { create: vi.fn() },
}
const vault = { fingerprint: vi.fn(), store: vi.fn(), activate: vi.fn() }
let inTransaction = false
const read = vi.fn(async () => {
  expect(inTransaction).toBe(false)
  return facts
})
const transaction = vi.fn(
  async (
    _tenant: string,
    operation: (_tx: Prisma.TransactionClient) => Promise<unknown>
  ) => {
    inTransaction = true
    try {
      return await operation(tx as unknown as Prisma.TransactionClient)
    } finally {
      inTransaction = false
    }
  }
)
const input = () => ({ apiKey, authenticatedAt: at.getTime() })
const command = () =>
  createOwnerPaymentAccountConnection({
    transaction: transaction as Parameters<
      typeof createOwnerPaymentAccountConnection
    >[0]['transaction'],
    environment: 'sandbox',
    vault,
    read,
    now: () => at,
  })
beforeEach(() => {
  vi.resetAllMocks()
  tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
    parts.join('').includes('platform_user_contacts')
      ? [{ authEmailVerified: true }]
      : parts.join('').includes('pg_roles')
        ? [{ platform: true, safe: true }]
        : []
  )
  tx.membership.findFirst.mockResolvedValue({ organization: { ...org } })
  tx.paymentAccount.findFirst.mockResolvedValue(null)
  tx.tenantIntegration.findMany.mockResolvedValue([])
  tx.integrationSecret.count.mockResolvedValue(0)
  tx.tenantIntegration.create.mockResolvedValue({ id: 'integration-alfa' })
  tx.paymentAccount.create.mockResolvedValue({ id: 'account-alfa' })
  vault.fingerprint.mockReturnValue('a'.repeat(64))
  vault.store.mockResolvedValue({ id: 'secret-alfa', version: 1 })
  read.mockImplementation(async () => {
    expect(inTransaction).toBe(false)
    return facts
  })
  transaction.mockImplementation(async (_tenant, operation) => {
    inTransaction = true
    try {
      return await operation(tx as unknown as Prisma.TransactionClient)
    } finally {
      inTransaction = false
    }
  })
})
it('checks current owner twice, stores a protected credential and keeps payments restricted without a webhook', async () => {
  expect(await command()(principal, input())).toEqual({ accepted: true })
  expect(tx.membership.findFirst).toHaveBeenCalledTimes(2)
  expect(tx.membership.findFirst.mock.calls[0]![0].where).toEqual({
    id: principal.membershipId,
    tenantId: principal.tenantId,
    userId: principal.userId,
    role: 'ADMIN',
    status: 'ACTIVE',
  })
  expect(vault.store.mock.calls[0]![2].use((value: string) => value)).toBe(
    apiKey
  )
  expect(JSON.stringify(vault.store.mock.calls)).not.toContain(apiKey)
  expect(vault.activate).toHaveBeenCalledWith(tx, 'secret-alfa')
  const account = tx.paymentAccount.create.mock.calls[0]![0].data
  expect(account).toMatchObject({
    status: 'RESTRICTED',
    mode: 'ASAAS_CONNECTED_ACCOUNT',
    healthIssue: 'WEBHOOK_MISSING',
    environment: 'sandbox',
    generalStatus: 'APPROVED',
  })
  expect(account.providerAccountId).toBeUndefined()
  expect(account.approvedAt).toBeUndefined()
  expect(tx.tenantIntegration.create.mock.calls[0]![0].data.status).toBe(
    'PROVISIONING'
  )
  expect(JSON.stringify(tx.platformAuditLog.create.mock.calls)).not.toContain(
    apiKey
  )
})
it.each([
  ['non-owner', { ownerUserId: 'another-owner' }, 'OWNER_REQUIRED'],
  ['administrative block', { status: 'SUSPENDED' }, 'OWNER_REQUIRED'],
  ['archived tenant', { access: 'ARCHIVED' }, 'TENANT_ARCHIVED'],
  ['invalid CNPJ', { document: 'invalid' }, 'INVALID_CNPJ'],
])(
  'refuses %s before provider I/O or writes',
  async (_label, changed, code) => {
    tx.membership.findFirst.mockResolvedValue({
      organization: { ...org, ...changed },
    })
    await expect(command()(principal, input())).rejects.toThrow(code)
    expect(read).not.toHaveBeenCalled()
    expect(vault.store).not.toHaveBeenCalled()
  }
)
it('requires fresh verified identity and an active owner membership', async () => {
  await expect(
    command()(principal, {
      ...input(),
      authenticatedAt: at.getTime() - 600_001,
    })
  ).rejects.toThrow('FRESH_SESSION_REQUIRED')
  tx.$queryRaw.mockResolvedValue([])
  await expect(command()(principal, input())).rejects.toThrow(
    'EMAIL_NOT_VERIFIED'
  )
  tx.membership.findFirst.mockResolvedValue(null)
  await expect(command()(principal, input())).rejects.toThrow('OWNER_REQUIRED')
  expect(read).not.toHaveBeenCalled()
})
it.each(['OWNER_REQUIRED', 'COMPANY_DATA_CHANGED', 'FRESH_SESSION_REQUIRED'])(
  'rechecks %s after the provider wait, before any storage',
  async (code) => {
    const supplied = input()
    read.mockImplementationOnce(async () => {
      tx.membership.findFirst.mockResolvedValue({
        organization: {
          ...org,
          ...(code === 'OWNER_REQUIRED'
            ? { ownerUserId: 'changed' }
            : code === 'COMPANY_DATA_CHANGED'
              ? { document: '11444777000161' }
              : {}),
        },
      })
      if (code === 'FRESH_SESSION_REQUIRED') supplied.authenticatedAt -= 600_001
      return facts
    })
    await expect(command()(principal, supplied)).rejects.toThrow(code)
    expect(vault.store).not.toHaveBeenCalled()
  }
)
it('rejects mismatched CNPJ and invalid/environment-conflicting credentials without storing', async () => {
  read.mockResolvedValueOnce({ ...facts, document: '11444777000161' })
  await expect(command()(principal, input())).rejects.toThrow(
    'ACCOUNT_DOCUMENT_MISMATCH'
  )
  await expect(
    command()(principal, { ...input(), apiKey: 'private-invalid' })
  ).rejects.toThrow('INVALID_API_KEY')
  await expect(
    command()(principal, { ...input(), apiKey: apiKey.replace('hmlg', 'prod') })
  ).rejects.toThrow('CREDENTIAL_ENVIRONMENT_CONFLICT')
  expect(vault.store).not.toHaveBeenCalled()
})
const connected = () => ({
  mode: 'ASAAS_CONNECTED_ACCOUNT',
  environment: 'sandbox',
  status: 'RESTRICTED',
  integration: {
    provider: 'ASAAS',
    environment: 'sandbox',
    credentialSource: 'VAULT',
    status: 'PROVISIONING',
    secrets: [{ fingerprint: 'a'.repeat(64) }],
  },
})
it('replays the identical stored key without overwriting history or making another provider call', async () => {
  tx.paymentAccount.findFirst.mockResolvedValue(connected())
  expect(await command()(principal, input())).toEqual({ accepted: true })
  expect(read).not.toHaveBeenCalled()
  expect(vault.store).not.toHaveBeenCalled()
  expect(tx.platformAuditLog.create).not.toHaveBeenCalled()
})
it.each(['BLOCKED', 'DISCONNECTED'])(
  'never reactivates %s by replaying a credential',
  async (status) => {
    tx.paymentAccount.findFirst.mockResolvedValue({ ...connected(), status })
    await expect(command()(principal, input())).rejects.toThrow(
      'PAYMENT_ACCOUNT_ALREADY_EXISTS'
    )
    expect(read).not.toHaveBeenCalled()
  }
)
it('does not replace another key, a subaccount, or an existing legacy integration', async () => {
  tx.paymentAccount.findFirst.mockResolvedValueOnce({
    ...connected(),
    mode: 'ASAAS_SUBACCOUNT',
  })
  await expect(command()(principal, input())).rejects.toThrow(
    'PAYMENT_ACCOUNT_ALREADY_EXISTS'
  )
  tx.paymentAccount.findFirst.mockResolvedValueOnce({
    ...connected(),
    integration: {
      ...connected().integration,
      secrets: [{ fingerprint: 'b'.repeat(64) }],
    },
  })
  await expect(command()(principal, input())).rejects.toThrow(
    'PAYMENT_ACCOUNT_ALREADY_EXISTS'
  )
  tx.tenantIntegration.findMany.mockResolvedValue([
    { id: 'legacy-integration' },
  ])
  await expect(command()(principal, input())).rejects.toThrow(
    'PAYMENT_INTEGRATION_ALREADY_EXISTS'
  )
  expect(vault.store).not.toHaveBeenCalled()
})
const shell = {
  id: 'cancelled-request',
  status: 'DISABLED',
  credentialSource: 'VAULT',
  environment: 'sandbox',
  externalAccountId: null,
}
it('a cancelled creation request (disabled vault shell, no secret, no provider reference) does not block connecting', async () => {
  tx.tenantIntegration.findMany.mockResolvedValue([shell])
  expect(await command()(principal, input())).toEqual({ accepted: true })
  expect(tx.integrationSecret.count).toHaveBeenCalledWith({
    where: { tenantId: principal.tenantId, integrationId: shell.id },
  })
  expect(vault.store).toHaveBeenCalledTimes(1)
  expect(tx.tenantIntegration.create).toHaveBeenCalledTimes(1)
})
it.each([
  ['a secret ever stored', {}, 1],
  ['a provider reference', { externalAccountId: 'acc_remote' }, 0],
  ['a legacy environment reference', { credentialSource: 'ENV_REF' }, 0],
  ['an integration still provisioning', { status: 'PROVISIONING' }, 0],
] as const)(
  'a disabled integration with %s keeps blocking the connection',
  async (_label, changed, secrets) => {
    tx.tenantIntegration.findMany.mockResolvedValue([{ ...shell, ...changed }])
    tx.integrationSecret.count.mockResolvedValue(secrets)
    await expect(command()(principal, input())).rejects.toThrow(
      'PAYMENT_INTEGRATION_ALREADY_EXISTS'
    )
    expect(read).not.toHaveBeenCalled()
    expect(vault.store).not.toHaveBeenCalled()
  }
)
it('maps the vault duplicate-key invariant to a safe conflict and preserves transactional failure', async () => {
  vault.store.mockRejectedValueOnce(
    new SecretVaultError('SECRET_ALREADY_EXISTS')
  )
  await expect(command()(principal, input())).rejects.toThrow(
    'PAYMENT_ACCOUNT_ALREADY_EXISTS'
  )
  expect(tx.paymentAccount.create).not.toHaveBeenCalled()
  expect(tx.platformAuditLog.create).not.toHaveBeenCalled()
})
