import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  receipt: null as Record<string, unknown> | null,
  insert: vi.fn(),
  read: vi.fn(),
  updateMany: vi.fn(),
  enqueue: vi.fn(),
  organization: vi.fn(),
  scope: vi.fn(),
}))
const tenantDouble = vi.hoisted(() => ({
  withTenantTransaction: async (
    context: unknown,
    fn: (_tx: unknown) => Promise<unknown>
  ) => {
    state.scope(context)
    return fn({
      webhookInbox: {
        createMany: state.insert,
        findUniqueOrThrow: state.read,
        updateMany: state.updateMany,
      },
      outboxEvent: { upsert: state.enqueue },
      // The claim reads the tenant's administrative status before any business effect.
      organization: { findUnique: state.organization },
    })
  },
}))

// Contraparte da API compartilhada (onda 135, B5): a mesma caixa de entrada montada pelo serviço
// (`apps/services/api/src/host/payment-webhooks.ts`, sobre `host/tenant-transaction`), com o mesmo dublê.
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  () => tenantDouble
)

import { acceptTenantWebhook as serviceAcceptTenantWebhook } from '../../apps/services/api/src/host/payment-webhooks'
const event = {
  body: { id: 'provider-event-1', value: 1 },
  payloadHash: 'hash-1',
  context: { tenantId: 'tenant-A' },
  integration: {
    id: 'integration-A',
    tenantId: 'tenant-A',
    provider: 'PIX',
    externalAccountId: null,
  },
}
beforeEach(() => {
  vi.resetAllMocks()
  state.receipt = null
  state.insert.mockImplementation(async ({ data }) => {
    state.receipt ||= {
      id: 'inbox-1',
      processedAt: null,
      lockedUntil: null,
      ...data,
    }
    return { count: 1 }
  })
  state.read.mockImplementation(async () => state.receipt)
  state.enqueue.mockResolvedValue({ id: 'outbox-1' })
  state.organization.mockResolvedValue({ status: 'ACTIVE' })
  state.updateMany.mockImplementation(async ({ data }) => {
    Object.assign(state.receipt!, data)
    return { count: 1 }
  })
})
describe.each([['service', serviceAcceptTenantWebhook]] as const)(
  '%s durable tenant webhook inbox',
  (_host, acceptTenantWebhook) => {
    it('persists receipt and retry job before applying effects', async () => {
      const consume = vi.fn(async () => {
        expect(state.enqueue).toHaveBeenCalledOnce()
        return Response.json({ ok: true })
      })
      expect((await acceptTenantWebhook(event, consume)).status).toBe(200)
      expect(state.read.mock.calls[0][0].where).toEqual({
        integrationId_eventKey: {
          integrationId: 'integration-A',
          eventKey: 'id:provider-event-1',
        },
      })
      expect(state.receipt?.processedAt).toBeInstanceOf(Date)
      expect(state.enqueue.mock.calls[0][0].create.tenantId).toBe('tenant-A')
    })
    it('does not reapply an already processed event', async () => {
      const consume = vi.fn(async () => Response.json({ ok: true }))
      await acceptTenantWebhook(event, consume)
      await acceptTenantWebhook(event, consume)
      expect(consume).toHaveBeenCalledOnce()
    })
    it('rejects provider event-id reuse with changed authenticated bytes', async () => {
      const consume = vi.fn(async () => Response.json({ ok: true }))
      await acceptTenantWebhook(event, consume)
      expect(
        (
          await acceptTenantWebhook(
            { ...event, payloadHash: 'changed' },
            consume
          )
        ).status
      ).toBe(409)
      expect(consume).toHaveBeenCalledOnce()
    })
    it('leaves failed processing retryable in the persisted outbox', async () => {
      const consume = vi.fn(async () => Response.json({}, { status: 500 }))
      expect((await acceptTenantWebhook(event, consume)).status).toBe(500)
      expect(state.receipt).toMatchObject({
        processedAt: null,
        lockedUntil: null,
        lastError: 'CONSUMER_HTTP_500',
      })
      expect(state.enqueue).toHaveBeenCalledOnce()
    })
    it('does not run a second consumer while another worker owns the lease', async () => {
      state.updateMany.mockResolvedValue({ count: 0 })
      const consume = vi.fn()
      expect((await acceptTenantWebhook(event, consume)).status).toBe(202)
      expect(consume).not.toHaveBeenCalled()
    })
    it.each([['SUSPENDED'], ['missing']])(
      'keeps the receipt and retry job but applies no effect for an administratively blocked tenant (%s)',
      async (blocked) => {
        state.organization.mockResolvedValue(
          blocked === 'missing' ? null : { status: blocked }
        )
        const consume = vi.fn()
        const response = await acceptTenantWebhook(event, consume)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          accepted: true,
          deferred: true,
        })
        expect(state.organization).toHaveBeenCalledWith({
          where: { id: 'tenant-A' },
          select: { status: true },
        })
        expect(consume).not.toHaveBeenCalled()
        expect(state.updateMany).not.toHaveBeenCalled()
        expect(state.receipt).toMatchObject({
          processedAt: null,
          lockedUntil: null,
        })
        expect(state.enqueue).toHaveBeenCalledOnce()
      }
    )
    it('does not apply effects when receipt/outbox persistence is unavailable', async () => {
      state.enqueue.mockRejectedValue(new Error('db unavailable'))
      const consume = vi.fn()
      expect((await acceptTenantWebhook(event, consume)).status).toBe(503)
      expect(consume).not.toHaveBeenCalled()
    })
    it('separates identical external event keys by integration', async () => {
      const consume = vi.fn(async () => Response.json({ ok: true }))
      await acceptTenantWebhook(event, consume)
      state.receipt = null
      await acceptTenantWebhook(
        {
          ...event,
          context: { tenantId: 'tenant-B' },
          integration: {
            ...event.integration,
            id: 'integration-B',
            tenantId: 'tenant-B',
          },
        },
        consume
      )
      expect(
        state.read.mock.calls[1][0].where.integrationId_eventKey.integrationId
      ).toBe('integration-B')
      expect(state.insert.mock.calls[1][0].data.tenantId).toBe('tenant-B')
    })
  }
)
