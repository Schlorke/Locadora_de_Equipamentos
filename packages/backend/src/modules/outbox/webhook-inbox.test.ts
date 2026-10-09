import { describe, expect, it, vi } from 'vitest'
import { createWebhookInbox } from './webhook-inbox'

function fixture() {
  const receipt = {
    id: 'receipt-A',
    tenantId: 'tenant-A',
    processedAt: null as Date | null,
    payload: { id: 'event-A' },
    payloadHash: 'hash-A',
    integration: {
      id: 'integration-A',
      tenantId: 'tenant-A',
      provider: 'PIX',
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
    },
  }
  const findFirst = vi.fn().mockResolvedValue(receipt)
  const updateMany = vi.fn().mockResolvedValue({ count: 1 })
  const transaction = vi.fn(async (_context, operation) =>
    operation({
      webhookInbox: { findFirst, updateMany },
      organization: {
        findUnique: async () => receipt.integration.organization,
      },
    })
  )
  const consume = vi.fn().mockResolvedValue(Response.json({ success: true }))
  const load = vi.fn(async () => ({ consumeWebhook: consume }))
  const inbox = createWebhookInbox({
    withTenantTransaction: transaction,
    consumers: { PIX: load },
  })
  return { ...inbox, receipt, findFirst, updateMany, consume, load }
}
const context = { tenantId: 'tenant-A' }

describe('durable webhook retry worker', () => {
  it('loads the stored event only in its tenant, runs the injected consumer and releases its own lease', async () => {
    const f = fixture()
    await f.runWebhookInboxEffect(context, 'outbox-A', { inboxId: 'receipt-A' })
    expect(f.findFirst).toHaveBeenCalledWith({
      where: { id: 'receipt-A', tenantId: 'tenant-A' },
      include: {
        integration: {
          include: { organization: { select: { status: true } } },
        },
      },
    })
    expect(f.consume).toHaveBeenCalledWith({
      context,
      integration: f.receipt.integration,
      body: f.receipt.payload,
      payloadHash: 'hash-A',
    })
    const lease = f.updateMany.mock.calls[0]![0].data.processingToken
    expect(lease).toMatch(/^[a-f0-9-]{36}$/)
    expect(f.updateMany.mock.calls[1]![0]).toMatchObject({
      where: { id: 'receipt-A', tenantId: 'tenant-A', processingToken: lease },
      data: {
        processedAt: expect.any(Date),
        lastError: null,
        processingToken: null,
        lockedUntil: null,
      },
    })
  })
  it('does nothing for an already processed receipt', async () => {
    const f = fixture()
    f.receipt.processedAt = new Date()
    await f.runWebhookInboxEffect(context, 'outbox-A', { inboxId: 'receipt-A' })
    expect(f.consume).not.toHaveBeenCalled()
    expect(f.updateMany).not.toHaveBeenCalled()
  })
  it.each(['different tenant', 'disabled integration'])(
    'preserves permanent refusal for %s',
    async (reason) => {
      const f = fixture()
      if (reason === 'different tenant')
        f.receipt.integration.tenantId = 'tenant-B'
      if (reason === 'disabled integration')
        f.receipt.integration.status = 'DISABLED'
      await expect(
        f.runWebhookInboxEffect(context, 'outbox-A', { inboxId: 'receipt-A' })
      ).rejects.toThrow('WEBHOOK_INTEGRATION_DISABLED')
      expect(f.load).not.toHaveBeenCalled()
      expect(f.updateMany).not.toHaveBeenCalled()
    }
  )
  it.each(['SUSPENDED', 'DISABLED'])(
    'keeps %s tenant receipts retryable until administrative unblock',
    async (status) => {
      const f = fixture()
      f.receipt.integration.organization.status = status
      await expect(
        f.runWebhookInboxEffect(context, 'outbox-A', { inboxId: 'receipt-A' })
      ).rejects.toThrow('WEBHOOK_TENANT_BLOCKED')
      expect(f.load).not.toHaveBeenCalled()
      expect(f.updateMany).not.toHaveBeenCalled()
      f.receipt.integration.organization.status = 'ACTIVE'
      await f.runWebhookInboxEffect(context, 'outbox-A', {
        inboxId: 'receipt-A',
      })
      expect(f.consume).toHaveBeenCalledOnce()
    }
  )
  it.each(['PROVISIONING', 'INBOUND_ONLY'])(
    'processes authenticated %s receipts for an active tenant',
    async (status) => {
      const f = fixture()
      f.receipt.integration.status = status
      await f.runWebhookInboxEffect(context, 'outbox-A', {
        inboxId: 'receipt-A',
      })
      expect(f.consume).toHaveBeenCalledOnce()
    }
  )
  it('retries rather than consuming a receipt claimed by the other host', async () => {
    const f = fixture()
    f.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(
      f.runWebhookInboxEffect(context, 'outbox-A', { inboxId: 'receipt-A' })
    ).rejects.toThrow('WEBHOOK_RETRY_PENDING')
    expect(f.consume).not.toHaveBeenCalled()
  })
  it('keeps a provider failure retryable and releases the lease', async () => {
    const f = fixture()
    f.consume.mockResolvedValue(
      Response.json({ error: 'down' }, { status: 503 })
    )
    await expect(
      f.runWebhookInboxEffect(context, 'outbox-A', { inboxId: 'receipt-A' })
    ).rejects.toThrow('WEBHOOK_RETRY_PENDING')
    expect(f.updateMany.mock.calls[1]![0].data).toMatchObject({
      processedAt: null,
      lastError: 'CONSUMER_HTTP_503',
      processingToken: null,
      lockedUntil: null,
    })
  })
})
