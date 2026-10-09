import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  ENTITLEMENT_FEATURES,
  AccessErrorSchema,
} from '@gb-locacoes/contracts/entitlements'
import type {
  TenantPrincipal,
  MutationRequest,
} from '@gb-locacoes/backend/identity'
import { createSubscriptionRequestAccess } from '../../packages/backend/src/modules/entitlements/request-access'

const principal: TenantPrincipal = {
  tenantId: 'tenant-alfa',
  userId: 'owner-alfa',
  membershipId: 'membership-alfa',
  role: 'ADMIN',
}
const rights = () => ({
  schema: 1,
  limits: { equipments: 20, staffSeats: 5 },
  features: Object.fromEntries(ENTITLEMENT_FEATURES.map((key) => [key, true])),
})
const tx = {
  $queryRaw: vi.fn(),
  organization: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() },
  entitlementOverride: { findMany: vi.fn() },
  rentals: { findFirst: vi.fn() },
}
const database = { $transaction: vi.fn() }
const getDatabase = vi.fn(() => database as unknown as PrismaClient)
const shadow = vi.fn()
const org = (access = 'FULL', ownerUserId = principal.userId) =>
  tx.organization.findUnique.mockResolvedValue({
    access,
    ownerUserId,
    status: 'ACTIVE',
  })
const request = (path: string, method = 'GET', body?: unknown) =>
  new Request(`https://backend.internal${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
const guard = (mode = 'on') =>
  createSubscriptionRequestAccess({
    getDatabase,
    enforcement: () => mode,
    shadow,
  })
const outcome = async (
  req: MutationRequest,
  actor = principal,
  mode = 'on'
) => {
  const result = await guard(mode)(req, actor)
  if (!result.response)
    return { status: 200, body: null, principal: result.principal }
  expect(result.response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(result.response.headers.get('Vary')).toBe('Cookie, Host')
  const body = await result.response.json()
  if (body.code) expect(AccessErrorSchema.safeParse(body).success).toBe(true)
  return { status: result.response.status, body, principal: result.principal }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
  database.$transaction.mockImplementation(async (operation) => operation(tx))
  tx.$queryRaw.mockResolvedValue([])
  org()
  tx.subscription.findFirst.mockResolvedValue({
    planVersion: { entitlements: rights() },
    suspendedAt: new Date('2026-10-01T00:00:00Z'),
  })
  tx.entitlementOverride.findMany.mockResolvedValue([])
  tx.rentals.findFirst.mockResolvedValue({ id: 'rental-alfa' })
})

describe('subscription request admission', () => {
  it.each(['SETUP', 'FULL', 'RESTRICTED', 'ARCHIVED'])(
    'receiving reads in %s do not unlock an owner command or archived business access',
    async (access) => {
      org(access)
      expect(
        (await outcome(request('/api/admin/payment-account'))).status
      ).toBe(access === 'ARCHIVED' ? 403 : 200)
      expect(
        (await outcome(request('/api/admin/payment-account/connect', 'POST')))
          .status
      ).toBe(
        ['FULL', 'SETUP'].includes(access)
          ? 200
          : access === 'ARCHIVED'
            ? 403
            : 402
      )
      // Wave 134 (S9): requesting the receiving account is setup (ADR SaaS B.5); a restricted subscription
      // still gets 402 on the request and keeps reading the offer, which shows SUBSCRIPTION_RESTRICTED.
      expect(
        (await outcome(request('/api/admin/payment-account/create', 'POST')))
          .status
      ).toBe(
        ['FULL', 'SETUP'].includes(access)
          ? 200
          : access === 'ARCHIVED'
            ? 403
            : 402
      )
      expect(
        (await outcome(request('/api/admin/payment-account/create'))).status
      ).toBe(access === 'ARCHIVED' ? 403 : 200)
      for (const sibling of [
        '/api/admin/payment-account/create/other',
        '/api/admin/payment-account/creates',
      ])
        expect((await outcome(request(sibling, 'POST'))).status).toBe(
          access === 'FULL' ? 200 : access === 'ARCHIVED' ? 403 : 402
        )
    }
  )
  it.each(['SETUP', 'FULL', 'RESTRICTED'])(
    'only exact owner cancellation POST commands remain available in %s',
    async (access) => {
      org(access)
      for (const action of [
        'activate',
        'cancel',
        'undo-cancel',
        'reactivate',
      ]) {
        const path = '/api/admin/subscription/' + action
        expect((await outcome(request(path, 'POST'))).status).toBe(200)
        if (access !== 'FULL') {
          expect((await outcome(request(path, 'PUT'))).status).not.toBe(200)
          expect(
            (await outcome(request(path + '/private', 'POST'))).status
          ).not.toBe(200)
        }
        org(access, 'another-owner')
        expect(
          await outcome(request(path, 'POST'), { ...principal, isOwner: true })
        ).toMatchObject({ status: 403, body: { code: 'OWNER_REQUIRED' } })
        org(access)
      }
    }
  )
  it('archived tenants preserve reads but cannot undo completed cancellation', async () => {
    org('ARCHIVED')
    expect(
      (await outcome(request('/api/admin/subscription/cancel', 'POST'))).status
    ).toBe(403)
    expect(
      (await outcome(request('/api/admin/subscription/undo-cancel', 'POST')))
        .status
    ).toBe(403)
  })
  it('ARCHIVED permits only the exact owner reactivation POST, never a staff hint or sibling endpoint', async () => {
    org('ARCHIVED')
    const path = '/api/admin/subscription/reactivate'
    expect((await outcome(request(path, 'POST'))).status).toBe(200)
    for (const req of [
      request(path, 'PUT'),
      request(path, 'GET'),
      request(path + '/extra', 'POST'),
      request('/api/admin/subscription/activate', 'POST'),
    ])
      expect((await outcome(req)).status).toBe(403)
    org('ARCHIVED', 'different-owner')
    expect(
      await outcome(request(path, 'POST'), { ...principal, isOwner: true })
    ).toMatchObject({ status: 403, body: { code: 'OWNER_REQUIRED' } })
  })
  it.each(['SETUP', 'FULL', 'RESTRICTED', 'ARCHIVED'])(
    'owner subscription reads remain available in %s without opening writes or descendants',
    async (access) => {
      org(access)
      for (const path of [
        '/api/admin/subscription',
        '/api/admin/subscription/invoices',
      ]) {
        expect((await outcome(request(path))).status).toBe(200)
        expect((await outcome(request(path, 'HEAD'))).status).toBe(200)
        if (access !== 'FULL')
          expect((await outcome(request(path, 'POST'))).status).not.toBe(200)
      }
      if (access === 'SETUP' || access === 'ARCHIVED') {
        expect(
          (await outcome(request('/api/admin/subscription/private'))).status
        ).not.toBe(200)
        expect(
          (await outcome(request('/api/admin/subscription/invoices/foreign')))
            .status
        ).not.toBe(200)
      }
    }
  )
  it.each(['SETUP', 'FULL', 'RESTRICTED', 'ARCHIVED'])(
    'non-owner ADMIN cannot read owner subscription endpoints in %s',
    async (access) => {
      org(access, 'another-owner')
      for (const path of [
        '/api/admin/subscription',
        '/api/admin/subscription/invoices',
      ])
        expect(
          await outcome(request(path), { ...principal, isOwner: true })
        ).toMatchObject({ status: 403, body: { code: 'OWNER_REQUIRED' } })
    }
  )
  it.each(['off', undefined])(
    'mode %s preserves the original principal with no query/body read',
    async (mode) => {
      const req = {
        method: 'POST',
        url: 'https://backend.internal/api/payments/pix',
        headers: new Headers(),
        clone: vi.fn(),
      }
      const result = await createSubscriptionRequestAccess({
        getDatabase,
        enforcement: () => mode,
      })(req, principal)
      expect(result).toEqual({ principal })
      expect(result.principal).toBe(principal)
      expect(getDatabase).not.toHaveBeenCalled()
      expect(req.clone).not.toHaveBeenCalled()
    }
  )
  it.each(['ON', '', 'invalid'])(
    'invalid flag %s fails closed without a database query',
    async (mode) => {
      expect(
        await outcome(request('/api/admin/equipments'), principal, mode)
      ).toMatchObject({ status: 503 })
      expect(getDatabase).not.toHaveBeenCalled()
    }
  )
  it.each([
    ['ADMIN', 'other-owner', 'staff', false],
    ['CLIENT', 'other-owner', 'client', false],
    ['ADMIN', principal.userId, 'owner', true],
  ] as const)(
    'metadata for %s comes from the current organization owner',
    async (role, owner, actor, isOwner) => {
      org('FULL', owner)
      const result = await outcome(request('/api/user/profile'), {
        ...principal,
        role,
      })
      expect(result).toMatchObject({
        status: 200,
        principal: { access: 'FULL', actor, isOwner },
      })
      expect(tx.organization.findUnique).toHaveBeenCalledWith({
        where: { id: principal.tenantId },
        select: { access: true, ownerUserId: true, status: true },
      })
      expect(tx.$queryRaw.mock.calls[0]?.[1]).toBe(principal.tenantId)
    }
  )
  it.each(['FULL', 'SETUP', 'RESTRICTED', 'ARCHIVED'])(
    'the owner may export in %s',
    async (access) => {
      org(access)
      expect(
        await outcome(request('/api/admin/financial/export?format=csv'))
      ).toMatchObject({ status: 200, principal: { isOwner: true, access } })
      expect(tx.subscription.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each(['FULL', 'SETUP', 'RESTRICTED'])(
    'an ADMIN who is not the owner cannot export in %s',
    async (access) => {
      org(access, 'other-owner')
      expect(
        await outcome(request('/api/admin/financial/export'))
      ).toMatchObject({ status: 403, body: { code: 'OWNER_REQUIRED' } })
    }
  )
  it.each([
    '/api/user/profile',
    '/api/client/rentals',
    '/api/admin/equipments',
    '/api/admin/financial/export',
  ])('ARCHIVED hides %s from a non-owner', async (path) => {
    org('ARCHIVED', 'other-owner')
    expect(await outcome(request(path))).toMatchObject({
      status: 403,
      body: { code: 'TENANT_ARCHIVED' },
    })
  })
  it('ARCHIVED owner is not permitted ordinary reads/writes', async () => {
    org('ARCHIVED')
    for (const method of ['GET', 'POST'])
      expect(
        await outcome(request('/api/admin/equipments', method))
      ).toMatchObject({ status: 403, body: { code: 'TENANT_ARCHIVED' } })
  })
  it.each([
    ['/api/admin/equipments', 'POST'],
    ['/api/admin/categories/one', 'DELETE'],
    ['/api/admin/settings', 'PUT'],
    ['/api/user/profile', 'PUT'],
  ])(
    'SETUP allows existing configuration operation %s %s',
    async (path, method) => {
      org('SETUP')
      expect(await outcome(request(path!, method!))).toMatchObject({
        status: 200,
      })
    }
  )
  it.each([
    '/api/admin/quotes',
    '/api/payments/pix',
    '/api/admin/equipments-unrelated',
  ])('SETUP does not admit %s', async (path) => {
    org('SETUP')
    expect(
      await outcome(request(path, 'POST', { rentalId: 'rental-alfa' }))
    ).toMatchObject({ status: 402, body: { code: 'SUBSCRIPTION_RESTRICTED' } })
  })
  it.each([
    [
      '/api/admin/rentals/one/checkin',
      'POST',
      { notes: 'Returned', damageFee: 0 },
    ],
    [
      '/api/admin/rentals/one',
      'PATCH',
      { status: 'COMPLETED', notes: 'Closed' },
    ],
    [
      '/api/admin/logistics/one',
      'PATCH',
      { status: 'COMPLETED', notes: 'Delivered' },
    ],
    [
      '/api/admin/financial/entries/one/status',
      'PATCH',
      { billingStatus: 'PAID' },
    ],
    [
      '/api/admin/financial/entries/one/status',
      'PATCH',
      { billingStatus: 'SETTLED' },
    ],
    ['/api/payments/boleto/one/regenerate', 'PUT', {}],
    ['/api/payments/boleto/verify', 'POST', { paymentId: 'one' }],
    ['/api/user/profile', 'PUT', { name: 'Current owner' }],
  ] as const)(
    'RESTRICTED permits only the existing operation %s %s',
    async (path, method, body) => {
      org('RESTRICTED')
      const req = request(path, method, body)
      expect(await outcome(req)).toMatchObject({ status: 200 })
      expect(await req.json()).toEqual(body) // classification never consumes the handler body
      expect(tx.subscription.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each([
    ['/api/admin/rentals/one/checkin', 'POST', { damageFee: 0, price: 20 }],
    ['/api/admin/rentals/one', 'PATCH', { status: 'COMPLETED', total: 20 }],
    ['/api/admin/rentals/one', 'PATCH', { status: 'ACTIVE' }],
    [
      '/api/admin/logistics/one',
      'PATCH',
      { status: 'COMPLETED', vehicleId: 'new' },
    ],
    [
      '/api/admin/financial/entries/one/status',
      'PATCH',
      { billingStatus: 'PAID', amount: 20 },
    ],
    [
      '/api/admin/financial/entries/one/status',
      'PATCH',
      { billingStatus: 'UNPAID' },
    ],
    ['/api/payments/boleto/one/regenerate', 'POST', {}],
    ['/api/admin/quotes/one/generate-boleto', 'POST', {}],
    ['/api/admin/rentals/one', 'DELETE', {}],
  ] as const)(
    'RESTRICTED refuses widened/mistyped operation %s %s',
    async (path, method, body) => {
      org('RESTRICTED')
      expect(await outcome(request(path, method, body))).toMatchObject({
        status: 402,
        body: { code: 'SUBSCRIPTION_RESTRICTED' },
      })
    }
  )
  it('a malformed JSON return request does not become an exception', async () => {
    org('RESTRICTED')
    expect(
      await outcome(
        new Request('https://backend.internal/api/admin/rentals/one/checkin', {
          method: 'POST',
          body: '{',
        })
      )
    ).toMatchObject({ status: 402 })
  })
  it.each([
    '/api/admin/equipments',
    '/api/client/rentals',
    '/api/admin/whatsapp/conversations',
  ])(
    'RESTRICTED preserves reads of %s without requiring a current plan',
    async (path) => {
      org('RESTRICTED')
      tx.subscription.findFirst.mockResolvedValue(null)
      expect(await outcome(request(path))).toMatchObject({ status: 200 })
      expect(tx.subscription.findFirst).not.toHaveBeenCalled()
    }
  )
  it.each([
    ['/api/admin/logistics', 'logistics'],
    ['/api/admin/vehicles', 'logistics'],
    ['/api/admin/drivers', 'logistics'],
    ['/api/admin/maintenance', 'maintenance'],
    ['/api/admin/whatsapp/conversations/one/messages', 'whatsapp'],
    ['/api/integrations/whatsapp/send', 'whatsapp'],
    ['/api/admin/zoho-mail/messages/send', 'emailInbox'],
    ['/api/admin/google-merchant/sync', 'merchantFeed'],
    ['/api/contracts/sign', 'contractSignature'],
    ['/api/payments/pix', 'onlinePayments'],
    ['/api/admin/quotes/one/generate-boleto', 'onlinePayments'],
    ['/api/admin/quotes/one/send-boleto', 'onlinePayments'],
  ] as const)(
    'FULL refuses mutation %s when %s is disabled, preserving reads',
    async (path, feature) => {
      const plan = rights()
      plan.features[feature] = false
      tx.subscription.findFirst.mockResolvedValue({
        planVersion: { entitlements: plan },
      })
      expect(await outcome(request(path, 'POST'))).toMatchObject({
        status: 402,
        body: { code: 'MODULE_NOT_IN_PLAN', feature },
      })
      expect(await outcome(request(path))).toMatchObject({ status: 200 })
      expect(tx.subscription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: principal.tenantId, status: { not: 'CANCELED' } },
        })
      )
    }
  )
  it.each(['authorize', 'callback'])(
    'OAuth GET %s is a write, not a read bypass',
    async (operation) => {
      org('RESTRICTED')
      expect(
        await outcome(request(`/api/admin/zoho-mail/oauth/${operation}`))
      ).toMatchObject({ status: 402 })
      org('FULL')
      const plan = rights()
      plan.features.emailInbox = false
      tx.subscription.findFirst.mockResolvedValue({
        planVersion: { entitlements: plan },
      })
      expect(
        await outcome(request(`/api/admin/zoho-mail/oauth/${operation}`))
      ).toMatchObject({ status: 402, body: { feature: 'emailInbox' } })
    }
  )
  it.each(['PIX', 'BOLETO'])(
    'RESTRICTED admits %s only for a rental already checked out before suspension',
    async (method) => {
      org('RESTRICTED')
      const path =
        method === 'PIX' ? '/api/payments/pix' : '/api/payments/boleto/generate'
      expect(
        await outcome(
          request(path, 'POST', { rentalId: 'rental-alfa', amount: 10 })
        )
      ).toMatchObject({ status: 200 })
      expect(tx.rentals.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'rental-alfa',
          tenantId: principal.tenantId,
          status: { in: ['ACTIVE', 'OVERDUE', 'PENDING_RETURN'] },
          checkOutAt: { lt: new Date('2026-10-01T00:00:00Z') },
          checkInAt: null,
        },
        select: { id: true },
      })
      tx.rentals.findFirst.mockResolvedValue(null)
      expect(
        await outcome(request(path, 'POST', { rentalId: 'future-or-foreign' }))
      ).toMatchObject({ status: 402 })
    }
  )
  it.each([
    { quoteId: 'quote-alfa' },
    { rentalId: 'rental-alfa', quoteId: 'quote-alfa' },
    {},
  ])(
    'RESTRICTED refuses a new quote charge or ambiguous reference',
    async (input) => {
      org('RESTRICTED')
      expect(
        await outcome(request('/api/payments/pix', 'POST', input))
      ).toMatchObject({ status: 402 })
      expect(tx.rentals.findFirst).not.toHaveBeenCalled()
    }
  )
  it('missing suspension time cannot prove an existing active obligation', async () => {
    org('RESTRICTED')
    tx.subscription.findFirst.mockResolvedValue({ suspendedAt: null })
    expect(
      await outcome(
        request('/api/payments/pix', 'POST', { rentalId: 'rental-alfa' })
      )
    ).toMatchObject({ status: 402 })
  })
  it.each([null, { planVersion: { entitlements: {} } }])(
    'missing/malformed current entitlements fail closed for writes',
    async (subscription) => {
      tx.subscription.findFirst.mockResolvedValue(subscription)
      expect(
        await outcome(request('/api/admin/equipments', 'POST'))
      ).toMatchObject({ status: 503 })
    }
  )
  it('only current valid overrides apply within this tenant', async () => {
    const plan = rights()
    plan.features.logistics = false
    tx.subscription.findFirst.mockResolvedValue({
      planVersion: { entitlements: plan },
    })
    const now = new Date()
    const row = {
      key: 'features.logistics',
      value: true,
      createdAt: new Date(now.getTime() - 10_000),
      revokedAt: null,
      expiresAt: null,
    }
    tx.entitlementOverride.findMany.mockResolvedValue([row])
    expect(await outcome(request('/api/admin/vehicles', 'POST'))).toMatchObject(
      { status: 200 }
    )
    expect(tx.entitlementOverride.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: principal.tenantId,
          createdAt: { lte: expect.any(Date) },
        }),
      })
    )
    for (const invalid of [
      { ...row, value: 'true' },
      { ...row, expiresAt: new Date(now.getTime() - 1) },
      { ...row, revokedAt: new Date(now.getTime() - 1) },
    ]) {
      tx.entitlementOverride.findMany.mockResolvedValue([invalid])
      expect(
        await outcome(request('/api/admin/vehicles', 'POST'))
      ).toMatchObject({ status: 402 })
    }
  })
  it.each([
    null,
    { access: 'FULL', status: 'SUSPENDED', ownerUserId: principal.userId },
    { access: 'unknown', status: 'ACTIVE' },
  ])(
    'a stale/invalid organization never authorizes writes',
    async (organization) => {
      tx.organization.findUnique.mockResolvedValue(organization)
      expect(
        (await outcome(request('/api/admin/equipments', 'POST'))).status
      ).toBeGreaterThanOrEqual(400)
    }
  )
  it('on rejects headers-only calls because their method/URL is unknown', async () => {
    expect(
      await outcome({ method: null, url: null, headers: new Headers() })
    ).toMatchObject({ status: 503 })
  })
  it('shadow failures never change the principal, including a failed diagnostic sink', async () => {
    database.$transaction.mockRejectedValue(
      new Error('private database failure')
    )
    expect(
      await outcome(
        request('/api/admin/equipments', 'POST'),
        principal,
        'shadow'
      )
    ).toEqual({ status: 200, body: null, principal })
    expect(shadow).toHaveBeenCalledWith({
      tenantId: principal.tenantId,
      code: 'SUBSCRIPTION_POLICY_UNAVAILABLE',
    })
    shadow.mockImplementation(() => {
      throw new Error('sink failure')
    })
    expect(
      (
        await guard('shadow')(
          request('/api/admin/equipments', 'POST'),
          principal
        )
      ).principal
    ).toBe(principal)
  })
  it('shadow reports refusal codes without exposing user IDs, payloads or errors', async () => {
    org('RESTRICTED')
    expect(
      await outcome(request('/api/admin/quotes', 'POST'), principal, 'shadow')
    ).toEqual({ status: 200, body: null, principal })
    expect(shadow).toHaveBeenCalledWith({
      tenantId: principal.tenantId,
      code: 'SUBSCRIPTION_RESTRICTED',
    })
  })
})

// Decisão do dono D-D (2026-10-07; onda 134): as páginas legais continuam no ar na pausa (decisão 4), então a locadora
// em RESTRICTED pode corrigir ou retirar o próprio texto legal. A exceção é estreita: só PUT e DELETE de
// /api/admin/settings/legal-documents/{terms|privacy|return-policy}; o resto das configurações continua bloqueado.
describe('D-D: textos legais da vitrine em RESTRICTED', () => {
  it.each([
    ['/api/admin/settings/legal-documents/terms', 'PUT'],
    ['/api/admin/settings/legal-documents/privacy', 'PUT'],
    ['/api/admin/settings/legal-documents/return-policy', 'PUT'],
    ['/api/admin/settings/legal-documents/terms', 'DELETE'],
    ['/api/admin/settings/legal-documents/return-policy', 'DELETE'],
  ] as const)('RESTRICTED admite %s %s', async (path, method) => {
    org('RESTRICTED')
    const body = { document: { version: 1 } }
    const req = request(path, method, method === 'PUT' ? body : undefined)
    expect(await outcome(req)).toMatchObject({ status: 200 })
    if (method === 'PUT') expect(await req.json()).toEqual(body)
    expect(tx.subscription.findFirst).not.toHaveBeenCalled()
  })

  it.each([
    ['/api/admin/settings', 'PUT'],
    ['/api/admin/settings/legal-documents/terms', 'POST'],
    ['/api/admin/settings/legal-documents/terms', 'PATCH'],
    ['/api/admin/settings/legal-documents/cookies', 'PUT'],
    ['/api/admin/settings/legal-documents/returnPolicy', 'PUT'],
    ['/api/admin/settings/legal-documents/terms/', 'PUT'],
    ['/api/admin/settings/legal-documents/terms/extra', 'DELETE'],
    ['/api/admin/settings/legal-documents', 'DELETE'],
  ] as const)('RESTRICTED continua recusando %s %s', async (path, method) => {
    org('RESTRICTED')
    expect(await outcome(request(path, method, {}))).toMatchObject({
      status: 402,
      body: { code: 'SUBSCRIPTION_RESTRICTED' },
    })
  })

  it('ARCHIVED continua recusando; SETUP e FULL seguem admitindo', async () => {
    org('ARCHIVED')
    expect(
      await outcome(
        request('/api/admin/settings/legal-documents/terms', 'PUT', {})
      )
    ).toMatchObject({ status: 403, body: { code: 'TENANT_ARCHIVED' } })
    for (const access of ['SETUP', 'FULL']) {
      org(access)
      expect(
        await outcome(
          request('/api/admin/settings/legal-documents/privacy', 'DELETE')
        ),
        access
      ).toMatchObject({ status: 200 })
    }
  })
})
