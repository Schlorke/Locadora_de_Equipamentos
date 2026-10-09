import type { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOwnerSubscriptionActionHandler } from '../../packages/backend/src/http/owner-cancellation'
import {
  isFreshAuthentication,
  identityAuthenticationTime,
  type TenantPrincipal,
} from '@gb-locacoes/backend/identity'

const now = new Date('2026-10-04T16:00:00Z')
const principal: TenantPrincipal = {
  tenantId: 'tenant-alfa',
  userId: 'owner-alfa',
  membershipId: 'membership-alfa',
  role: 'ADMIN',
}
const transaction = vi.fn()
const getSession = vi.fn()
const request = (body?: string, headers: Record<string, string> = {}) =>
  new Request('https://app.example.test/api/admin/subscription/cancel', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'fixture-cancel-1', ...headers },
    ...(body === undefined ? {} : { body }),
  })
const run = (
  req: Request,
  action: 'activate' | 'cancel' | 'undo-cancel' | 'reactivate' = 'cancel'
) =>
  createOwnerSubscriptionActionHandler({
    transaction,
    getSession,
    now: () => now,
  })(req, principal, action)
beforeEach(() => {
  vi.resetAllMocks()
  getSession.mockResolvedValue({
    user: { id: principal.userId },
    authenticatedAt: now.getTime() - 60_000,
  })
})
describe('sensitive owner authentication', () => {
  it.each([0, 599_999, 600_000])(
    'accepts verified authentication %i ms ago',
    (age) => {
      expect(isFreshAuthentication(now.getTime() - age, now)).toBe(true)
    }
  )
  it.each([
    undefined,
    null,
    '2026-10-04',
    0,
    NaN,
    Infinity,
    now.getTime() + 1,
    now.getTime() - 600_001,
  ])('rejects invalid or expired authentication %s', (value) => {
    expect(isFreshAuthentication(value, now)).toBe(false)
  })
  it('uses only a validated engine creation date', () => {
    expect(identityAuthenticationTime(now)).toBe(now.getTime())
    for (const value of [
      now.toISOString(),
      {},
      undefined,
      new Date(NaN),
      new Date(0),
    ])
      expect(identityAuthenticationTime(value)).toBeUndefined()
  })
})
describe.each(['activate', 'cancel', 'undo-cancel', 'reactivate'] as const)(
  'owner %s HTTP envelope',
  (action) => {
    it.each([
      null,
      { user: { id: 'other' }, authenticatedAt: now.getTime() },
      {
        user: { id: principal.userId },
        updatedAt: now,
        authenticatedAt: now.getTime() - 600_001,
      },
      { user: { id: principal.userId } },
    ])(
      'refuses stale/different/missing session before any database work: %j',
      async (session) => {
        getSession.mockResolvedValue(session)
        const response = await run(request(), action)
        expect(response.status).toBe(401)
        expect(await response.json()).toMatchObject({
          code: 'FRESH_SESSION_REQUIRED',
        })
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(response.headers.get('Vary')).toBe('Cookie, Host')
        expect(transaction).not.toHaveBeenCalled()
      }
    )
    it.each([
      'short',
      'a'.repeat(129),
      'with space',
      'with/slash',
      'ação-inválida',
    ])('rejects ambiguous idempotency key %s', async (key) => {
      expect(
        (await run(request(undefined, { 'Idempotency-Key': key }), action))
          .status
      ).toBe(400)
      expect(transaction).not.toHaveBeenCalled()
    })
    it('requires an idempotency key', async () => {
      const req = request()
      req.headers.delete('Idempotency-Key')
      expect((await run(req, action)).status).toBe(400)
      expect(transaction).not.toHaveBeenCalled()
    })
    it.each([
      ['{"authenticatedAt":1}', 'application/json', 400],
      ['{"tenantId":"foreign"}', 'application/json', 400],
      ['null', 'application/json', 400],
      ['{', 'application/json', 400],
      ['{}', 'text/plain', 415],
      [' '.repeat(1025), 'application/json', 413],
    ])(
      'rejects untrusted/invalid/oversized body before transaction: %s',
      async (body, media, status) => {
        expect(
          (
            await run(
              request(body as string, { 'Content-Type': media as string }),
              action
            )
          ).status
        ).toBe(status)
        expect(transaction).not.toHaveBeenCalled()
      }
    )
    it('reports current ownership rejection without disclosing storage details', async () => {
      const tx = {
        $queryRaw: vi.fn(),
        membership: { findFirst: vi.fn().mockResolvedValue(null) },
      }
      transaction.mockImplementation(async (_tenant, operation) =>
        operation(tx as unknown as Prisma.TransactionClient)
      )
      const response = await run(
        request(
          action === 'reactivate' ? '{"planVersionId":"fixture-plan"}' : '{}',
          { 'Content-Type': 'application/json' }
        ),
        action
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'OWNER_REQUIRED' })
      expect(transaction.mock.calls[0]![0]).toBe(principal.tenantId)
    })
    it('storage failures stay private, temporary and neutral', async () => {
      transaction.mockRejectedValue(new Error('private connection string'))
      const response = await run(
        action === 'reactivate'
          ? request('{"planVersionId":"fixture-plan"}', {
              'Content-Type': 'application/json',
            })
          : request(),
        action
      )
      expect(response.status).toBe(503)
      expect(JSON.stringify(await response.json())).not.toContain('connection')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    })
  }
)

describe('reactivation plan selection envelope', () => {
  it.each([
    undefined,
    '{}',
    '[]',
    '{"planVersionId":1}',
    '{"planVersionId":""}',
    '{"planVersionId":"valid-plan","amount":"1.00"}',
    '{"planVersionId":"valid-plan","direction":"UPGRADE"}',
  ])(
    'refuses missing or client-controlled selection %s before database work',
    async (body) => {
      const response = await run(
        request(body, { 'Content-Type': 'application/json' }),
        'reactivate'
      )
      expect(response.status).toBe(400)
      expect(transaction).not.toHaveBeenCalled()
    }
  )
})
