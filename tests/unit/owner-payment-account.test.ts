import { beforeEach, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import {
  PAYMENT_ACCOUNT_HEALTH_ISSUES,
  PAYMENT_ACCOUNT_STATUSES,
} from '@gb-locacoes/contracts/payment-account'
import { createOwnerPaymentAccountHandler } from '../../packages/backend/src/http/owner-payment-account'

const principal = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN' as const,
}
const env = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'rental.test',
  PLATFORM_EDGE_SECRET: 'synthetic-receiving-edge-secret-longer32',
}
const tx = {
  $executeRaw: vi.fn(),
  membership: { findFirst: vi.fn() },
  paymentAccount: { findFirst: vi.fn() },
}
const transaction = vi.fn(
  async (
    _context: unknown,
    operation: (_tx: Prisma.TransactionClient) => Promise<unknown>
  ) => operation(tx as unknown as Prisma.TransactionClient)
)
const record = () => ({
  mode: 'ASAAS_CONNECTED_ACCOUNT',
  subaccountModel: null,
  status: 'APPROVED',
  environment: 'sandbox',
  healthIssue: null,
  generalStatus: 'APPROVED',
  commercialInfoExpiresAt: null,
  commercialInfoExpired: false,
  approvedAt: new Date('2026-10-04T12:00:00Z'),
  lastSyncedAt: new Date('2026-10-04T13:00:00Z'),
  integration: { status: 'ACTIVE' },
  providerAccountId: 'private-provider-id',
  walletId: 'private-wallet',
  incomeRange: 'private-income',
  apiKey: 'private-api-key',
})
const handler = () =>
  createOwnerPaymentAccountHandler({
    withTenantTransaction: transaction as Parameters<
      typeof createOwnerPaymentAccountHandler
    >[0]['withTenantTransaction'],
    environment: () => env,
  })
const request = () =>
  new Request('https://api.rental.test/api/admin/payment-account')
async function read() {
  const response = await handler()(request(), principal)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('vary')).toBe('Cookie, Host')
  return { response, body: await response.json() }
}
beforeEach(() => {
  vi.resetAllMocks()
  transaction.mockImplementation(async (_context, operation) =>
    operation(tx as unknown as Prisma.TransactionClient)
  )
  tx.membership.findFirst.mockResolvedValue({
    organization: {
      status: 'ACTIVE',
      ownerUserId: principal.userId,
      access: 'FULL',
    },
  })
  tx.paymentAccount.findFirst.mockResolvedValue(record())
})
it('returns only the contract projection from the current owner repeatable-read snapshot', async () => {
  const { response, body } = await read()
  expect(response.status).toBe(200)
  expect(body.account).toEqual({
    kind: 'CONNECTED',
    status: 'APPROVED',
    environment: 'sandbox',
    healthIssue: null,
    providerStatusText: 'Dados aprovados pela instituição de pagamentos.',
    commercialInfoExpiresAt: null,
    commercialInfoExpired: false,
    approvedAt: '2026-10-04T12:00:00.000Z',
    lastSyncedAt: '2026-10-04T13:00:00.000Z',
  })
  expect(JSON.stringify(body)).not.toContain('private-')
  expect(transaction).toHaveBeenCalledWith(principal, expect.any(Function), {
    isolationLevel: 'RepeatableRead',
  })
  expect(tx.$executeRaw).toHaveBeenCalledWith(['SET TRANSACTION READ ONLY'])
  const query = tx.paymentAccount.findFirst.mock.calls[0]![0]
  expect(query.where).toEqual({
    tenantId: principal.tenantId,
    disconnectedAt: null,
  })
  expect(Object.keys(query.select)).not.toContain('providerAccountId')
  expect(tx.membership.findFirst.mock.calls[0]![0].where).toEqual({
    id: principal.membershipId,
    tenantId: principal.tenantId,
    userId: principal.userId,
    role: 'ADMIN',
    status: 'ACTIVE',
  })
})
it('distinguishes no account from unavailable and never echoes stored provider content', async () => {
  tx.paymentAccount.findFirst.mockResolvedValueOnce(null)
  expect((await read()).body).toEqual({ account: null })
  tx.paymentAccount.findFirst.mockResolvedValueOnce({
    ...record(),
    generalStatus: 'private-provider-secret',
  })
  expect((await read()).body.account.providerStatusText).toBeNull()
  tx.paymentAccount.findFirst.mockRejectedValueOnce(
    new Error('private-db-password')
  )
  const result = await read()
  expect(result.response.status).toBe(503)
  expect(JSON.stringify(result.body)).not.toContain('private-')
})
it.each(PAYMENT_ACCOUNT_STATUSES)(
  'preserves current %s without provider calls or mutation',
  async (status) => {
    tx.paymentAccount.findFirst.mockResolvedValue({ ...record(), status })
    expect((await read()).body.account.status).toBe(status)
  }
)
it.each(PAYMENT_ACCOUNT_HEALTH_ISSUES)(
  'health %s prevents stale approval',
  async (healthIssue) => {
    tx.paymentAccount.findFirst.mockResolvedValue({ ...record(), healthIssue })
    expect((await read()).body.account).toMatchObject({
      status: 'RESTRICTED',
      healthIssue,
    })
  }
)
it.each(['INBOUND_ONLY', 'DISABLED', 'PROVISIONING'])(
  'integration %s prevents stale approval',
  async (status) => {
    tx.paymentAccount.findFirst.mockResolvedValue({
      ...record(),
      integration: { status },
    })
    expect((await read()).body.account.status).toBe('RESTRICTED')
  }
)
it.each([
  null,
  { organization: { status: 'ACTIVE', ownerUserId: 'other-owner' } },
  { organization: { status: 'BLOCKED', ownerUserId: principal.userId } },
])(
  'revoked, absent or transferred owner cannot read %j',
  async (membership) => {
    tx.membership.findFirst.mockResolvedValue(membership)
    expect((await read()).response.status).toBe(403)
    expect(tx.paymentAccount.findFirst).not.toHaveBeenCalled()
  }
)
it.each(['CLIENT', 'OPERATOR', 'FINANCIAL'] as const)(
  'role %s cannot use a claimed owner hint',
  async (role) => {
    const response = await handler()(request(), {
      ...principal,
      role,
      isOwner: true,
    })
    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  }
)
it.each([
  { Origin: 'https://bravo.rental.test' },
  { 'Sec-Fetch-Site': 'same-origin' },
  { 'x-platform-edge-auth': 'forged' },
])(
  'browser or forged edge cannot masquerade as a direct device %j',
  async (headers) => {
    expect(
      (await handler()(new Request(request().url, { headers }), principal))
        .status
    ).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  }
)
it('accepts a genuine app edge and refuses query selectors or unsafe methods before reads', async () => {
  const headers = {
    'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET,
    'x-platform-host-kind': 'app',
    'x-platform-origin': 'https://app.rental.test',
  }
  expect(
    (await handler()(new Request(request().url, { headers }), principal)).status
  ).toBe(200)
  transaction.mockClear()
  expect(
    (await handler()(new Request(request().url + '?tenantId=bravo'), principal))
      .status
  ).toBe(400)
  expect(
    (await handler()(new Request(request().url, { method: 'POST' }), principal))
      .status
  ).toBe(405)
  expect(transaction).not.toHaveBeenCalled()
})
