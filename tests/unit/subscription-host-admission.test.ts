import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  transaction: vi.fn(),
  membership: vi.fn(),
  organization: vi.fn(),
  subscription: vi.fn(),
  overrides: vi.fn(),
  sql: vi.fn(),
  send: vi.fn(),
  read: vi.fn(),
  headers: new Headers(),
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
vi.mock('next/headers', () => ({ headers: async () => state.headers }))
vi.mock('../../apps/services/api/src/host/whatsapp-write', () => ({
  sendConversationMessage: state.send,
}))
vi.mock('../../apps/services/api/src/host/whatsapp-read', () => ({
  readMessages: state.read,
}))

import {
  GET as apiRead,
  POST as apiSend,
} from '../../apps/services/api/src/app/api/admin/whatsapp/conversations/[conversationId]/messages/route'
const member = {
  id: 'membership-alfa',
  tenantId: 'tenant-alfa',
  userId: 'staff-alfa',
  role: 'OPERATOR',
  status: 'ACTIVE',
  organization: { status: 'ACTIVE' },
}
const rights = () => ({
  schema: 1,
  limits: { equipments: 20, staffSeats: 3 },
  features: Object.fromEntries(ENTITLEMENT_FEATURES.map((key) => [key, true])),
})
const input = (method: string) =>
  new NextRequest(
    'https://api.internal/api/admin/whatsapp/conversations/one/messages',
    {
      method,
      headers: state.headers,
      ...(method === 'POST'
        ? { body: JSON.stringify({ text: 'Local fixture' }) }
        : {}),
    }
  )
const context = () => ({ params: Promise.resolve({ conversationId: 'one' }) })
beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
  state.headers = new Headers({ 'x-tenant-id': member.tenantId })
  state.session.mockResolvedValue({
    user: { id: member.userId, role: 'ADMIN' },
  })
  state.membership.mockResolvedValue(member)
  state.organization.mockResolvedValue({
    access: 'FULL',
    ownerUserId: 'owner-alfa',
    status: 'ACTIVE',
  })
  state.subscription.mockResolvedValue({
    planVersion: { entitlements: rights() },
  })
  state.overrides.mockResolvedValue([])
  state.transaction.mockImplementation(async (operation) =>
    operation({
      $queryRaw: state.sql,
      membership: { findUnique: state.membership },
      organization: { findUnique: state.organization },
      subscription: { findFirst: state.subscription },
      entitlementOverride: { findMany: state.overrides },
    })
  )
  state.send.mockImplementation(async () =>
    Response.json({ id: 'local-message' })
  )
  state.read.mockImplementation(async () => Response.json({ messages: [] }))
})

describe.each([['api', apiRead, apiSend]] as const)(
  '%s actual HTTP adapter with shared subscription admission',
  (_host, get, post) => {
    it('off keeps the legacy write/body and does not read subscription data', async () => {
      state.organization.mockResolvedValue({
        access: 'RESTRICTED',
        ownerUserId: 'owner-alfa',
        status: 'ACTIVE',
      })
      const req = input('POST')
      expect((await post(req, context())).status).toBe(200)
      expect(state.organization).not.toHaveBeenCalled()
      expect(state.subscription).not.toHaveBeenCalled()
      expect(state.send.mock.calls[0]?.[1]).toBe(req)
      expect(await req.json()).toEqual({ text: 'Local fixture' })
    })
    it.each([
      ['RESTRICTED', 402, 'SUBSCRIPTION_RESTRICTED'],
      ['SETUP', 402, 'SUBSCRIPTION_RESTRICTED'],
      ['ARCHIVED', 403, 'TENANT_ARCHIVED'],
    ] as const)(
      'on %s refuses before any send, retaining the exact envelope and cache policy',
      async (access, status, code) => {
        vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
        state.organization.mockResolvedValue({
          access,
          ownerUserId: 'owner-alfa',
          status: 'ACTIVE',
        })
        const response = await post(input('POST'), context())
        expect(response.status).toBe(status)
        expect(await response.json()).toMatchObject({ code })
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(response.headers.get('Vary')).toBe('Cookie, Host')
        expect(state.send).not.toHaveBeenCalled()
      }
    )
    it('on FULL blocks an unavailable module, while its history remains readable', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      const plan = rights()
      plan.features.whatsapp = false
      state.subscription.mockResolvedValue({
        planVersion: { entitlements: plan },
      })
      const response = await post(input('POST'), context())
      expect(response.status).toBe(402)
      expect(await response.json()).toEqual({
        error: 'Este módulo não está disponível no seu plano.',
        code: 'MODULE_NOT_IN_PLAN',
        feature: 'whatsapp',
      })
      expect(state.send).not.toHaveBeenCalled()
      expect((await get(input('GET'), context())).status).toBe(200)
      expect(state.read).toHaveBeenCalledOnce()
    })
    it('on never grants the global session role instead of the tenant role', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      state.membership.mockResolvedValue({ ...member, role: 'CLIENT' })
      expect((await post(input('POST'), context())).status).toBe(403)
      expect(state.send).not.toHaveBeenCalled()
    })
    it('RESTRICTED reads do not require a plan or create effects', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      state.organization.mockResolvedValue({
        access: 'RESTRICTED',
        ownerUserId: 'owner-alfa',
        status: 'ACTIVE',
      })
      state.subscription.mockResolvedValue(null)
      expect((await get(input('GET'), context())).status).toBe(200)
      expect(state.subscription).not.toHaveBeenCalled()
      expect(state.send).not.toHaveBeenCalled()
    })
    it('shadow computes refusal but allows the unchanged write', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      state.organization.mockResolvedValue({
        access: 'RESTRICTED',
        ownerUserId: 'owner-alfa',
        status: 'ACTIVE',
      })
      expect((await post(input('POST'), context())).status).toBe(200)
      expect(state.send).toHaveBeenCalledOnce()
    })
    it('missing current plan fails closed before the send', async () => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      state.subscription.mockResolvedValue(null)
      const response = await post(input('POST'), context())
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(state.send).not.toHaveBeenCalled()
    })
  }
)
