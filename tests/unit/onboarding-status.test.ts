import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createOnboardingStatusHandler } from '@gb-locacoes/backend/http'
import { semanticThemes } from '@gb-locacoes/design-tokens'
const principal = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN' as const,
}
const env = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'rental.test',
  PLATFORM_EDGE_SECRET: 'synthetic-edge-status-secret-longer32',
}
const inbound = () =>
  new Request('https://backend.test/api/onboarding/status', {
    headers: {
      'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET,
      'x-platform-host-kind': 'app',
      'x-platform-origin': 'https://app.rental.test',
    },
  })
const tx = {
  $executeRaw: vi.fn(),
  membership: { findFirst: vi.fn() },
  organization: { findUniqueOrThrow: vi.fn() },
  subscription: { findFirst: vi.fn() },
  setting: { findUnique: vi.fn() },
  paymentAccount: { findFirst: vi.fn() },
  equipment: { count: vi.fn() },
}
const transaction = vi.fn(
  async (
    _context: { tenantId: string },
    operation: (_tx: Prisma.TransactionClient) => Promise<unknown>,
    _options?: unknown
  ) => operation(tx as unknown as Prisma.TransactionClient)
)
const handler = () =>
  createOnboardingStatusHandler({
    withTenantTransaction: transaction as Parameters<
      typeof createOnboardingStatusHandler
    >[0]['withTenantTransaction'],
    environment: () => env,
  })
beforeEach(() => {
  vi.clearAllMocks()
  tx.membership.findFirst.mockResolvedValue({
    organization: {
      status: 'ACTIVE',
      ownerUserId: principal.userId,
      access: 'FULL',
    },
  })
  tx.organization.findUniqueOrThrow.mockResolvedValue({ sitePublishedAt: null })
  tx.subscription.findFirst.mockResolvedValue({ status: 'TRIALING' })
  tx.setting.findUnique.mockResolvedValue({
    companyIconUrl: '',
    themeColorPrimary: semanticThemes.light.brand.default,
    whatsappNumber: '',
  })
  tx.paymentAccount.findFirst.mockResolvedValue(null)
  tx.equipment.count.mockResolvedValue(0)
})
describe('owner onboarding checklist from a read-only tenant snapshot', () => {
  it.each(['GET', 'HEAD'])(
    'direct device %s remains private and revalidates current owner',
    async (method) => {
      const response = await handler()(
        new Request(inbound().url, { method }),
        principal
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('vary')).toBe('Cookie, Host')
      expect(tx.membership.findFirst).toHaveBeenCalledOnce()
      expect(tx.$executeRaw).toHaveBeenCalledOnce()
    }
  )
  it.each([
    { Origin: 'https://bravo.rental.test' },
    { 'Sec-Fetch-Site': 'same-origin' },
    { 'x-platform-edge-auth': 'forged' },
    { 'x-platform-host-kind': 'app' },
    { 'x-platform-origin': 'https://app.rental.test' },
    { 'x-platform-tenant-slug': 'alfa' },
    { 'x-platform-client-ip': '192.0.2.1' },
  ])(
    'browser metadata or supplied edge cannot masquerade as a direct device %j',
    async (headers) => {
      const response = await handler()(
        new Request(inbound().url, { headers }),
        principal
      )
      expect(response.status).toBe(403)
      expect(transaction).not.toHaveBeenCalled()
    }
  )
  it('POST is never a device read and rejects before storage', async () => {
    const response = await handler()(
      new Request(inbound().url, { method: 'POST' }),
      principal
    )
    expect(response.status).toBe(405)
    expect(transaction).not.toHaveBeenCalled()
  })
  it('does not count blank color or missing settings as customization', async () => {
    tx.setting.findUnique
      .mockResolvedValueOnce({
        companyIconUrl: '',
        themeColorPrimary: '',
        whatsappNumber: '',
      })
      .mockResolvedValueOnce(null)
    for (let index = 0; index < 2; index++) {
      const body = await (await handler()(inbound(), principal)).json()
      expect(body.items).toContainEqual({ id: 'CUSTOMIZE_SITE', done: false })
    }
  })
  it('returns only ordered contract facts and SUBSCRIBE while trialing', async () => {
    const response = await handler()(inbound(), principal)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      subscriptionStatus: 'TRIALING',
      items: [
        { id: 'ACCOUNT_CREATED', done: true },
        { id: 'FIRST_EQUIPMENT', done: false },
        { id: 'CUSTOMIZE_SITE', done: false },
        { id: 'PUBLISH_SITE', done: false },
        { id: 'ACTIVATE_ONLINE_PAYMENTS', done: false },
        { id: 'SUBSCRIBE', done: false },
      ],
    })
    expect(transaction).toHaveBeenCalledWith(principal, expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    })
    expect(tx.$executeRaw).toHaveBeenCalledOnce()
    expect(tx.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: principal.membershipId,
          tenantId: principal.tenantId,
          userId: principal.userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it.each([
    null,
    { organization: { status: 'ACTIVE', ownerUserId: 'other-owner' } },
    { organization: { status: 'BLOCKED', ownerUserId: principal.userId } },
  ])(
    'refuses revoked/missing/transferred ownership before business reads: %j',
    async (membership) => {
      tx.membership.findFirst.mockResolvedValue(membership)
      const response = await handler()(inbound(), principal)
      expect(response.status).toBe(403)
      expect(tx.equipment.count).not.toHaveBeenCalled()
      expect(tx.setting.findUnique).not.toHaveBeenCalled()
    }
  )
  it.each(['INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'])(
    'does not invent an optional subscribe step in %s',
    async (status) => {
      tx.subscription.findFirst.mockResolvedValue({ status })
      const response = await handler()(inbound(), principal)
      expect((await response.json()).items).not.toContainEqual(
        expect.objectContaining({ id: 'SUBSCRIBE' })
      )
    }
  )
  it('uses the latest canceled subscription when no current one exists', async () => {
    tx.subscription.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'CANCELED' })
    expect(
      (await (await handler()(inbound(), principal)).json()).subscriptionStatus
    ).toBe('CANCELED')
    expect(tx.subscription.findFirst.mock.calls[1]?.[0]).toMatchObject({
      where: { tenantId: 'alfa', status: 'CANCELED' },
      orderBy: [{ canceledAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    })
  })
  it('does not expose source settings, provider identifiers or IP', async () => {
    tx.setting.findUnique.mockResolvedValue({
      companyIconUrl: 'synthetic-logo',
      themeColorPrimary: 'synthetic-color',
      whatsappNumber: 'synthetic-phone',
      smtpConfig: 'synthetic-secret',
    })
    tx.equipment.count.mockResolvedValue(1)
    tx.organization.findUniqueOrThrow.mockResolvedValue({
      sitePublishedAt: new Date(),
    })
    tx.paymentAccount.findFirst.mockResolvedValue({
      status: 'APPROVED',
      commercialInfoExpired: false,
      healthIssue: null,
      integration: { status: 'ACTIVE' },
      providerAccountId: 'synthetic-account-secret',
    })
    const body = await (await handler()(inbound(), principal)).json()
    expect(
      body.items.slice(1, 5).every((item: { done: boolean }) => item.done)
    ).toBe(true)
    expect(JSON.stringify(body)).not.toContain('synthetic-')
  })
  it.each([
    {
      status: 'UNDER_REVIEW',
      commercialInfoExpired: false,
      healthIssue: null,
      integration: { status: 'ACTIVE' },
    },
    {
      status: 'APPROVED',
      commercialInfoExpired: false,
      healthIssue: 'KEY_DISABLED',
      integration: { status: 'ACTIVE' },
    },
    {
      status: 'APPROVED',
      commercialInfoExpired: false,
      healthIssue: null,
      integration: { status: 'DISABLED' },
    },
    {
      status: 'APPROVED',
      commercialInfoExpired: true,
      healthIssue: null,
      integration: { status: 'ACTIVE' },
    },
  ])('does not present unavailable payments as active %j', async (account) => {
    tx.paymentAccount.findFirst.mockResolvedValue(account)
    const body = await (await handler()(inbound(), principal)).json()
    expect(body.items).toContainEqual({
      id: 'ACTIVATE_ONLINE_PAYMENTS',
      done: false,
    })
    expect(
      body.items.some(
        (item: { id: string }) => item.id === 'CONFIRM_COMMERCIAL_INFO'
      )
    ).toBe(account.commercialInfoExpired)
  })
  it('does not mix another explicit query selection or host', async () => {
    const request = inbound()
    request.headers.set('origin', 'https://bravo.rental.test')
    expect((await handler()(request, principal)).status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
    const other = new Request(inbound().url + '?tenantId=bravo', {
      headers: inbound().headers,
    })
    expect((await handler()(other, principal)).status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })
  it('returns neutral unavailable and missing subscription failures', async () => {
    tx.subscription.findFirst.mockResolvedValue(null)
    expect((await handler()(inbound(), principal)).status).toBe(404)
    tx.membership.findFirst.mockRejectedValueOnce(
      new Error('synthetic-db-password')
    )
    const response = await handler()(inbound(), principal)
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('synthetic-db-password')
  })
})
