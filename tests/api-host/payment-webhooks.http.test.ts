import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient, type Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const ids = Array.from({ length: 4 }, () => randomUUID()),
  payments = Array.from({ length: 3 }, () => randomUUID())
const external = Array.from({ length: 4 }, () => randomUUID()),
  attempts = Array.from({ length: 4 }, () => randomUUID())
const secret = 'local-webhook-parity-secret'
const integration = (provider: 'pix' | 'boleto') =>
  ids[provider === 'pix' ? 0 : 1]!
const payment = (provider: 'pix' | 'boleto') =>
  payments[provider === 'pix' ? 0 : 1]!
const reference = (provider: 'pix' | 'boleto') =>
  external[provider === 'pix' ? 0 : 1]!
let cookie: string,
  originalRole: Role | undefined,
  sequence = 0
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
}
async function clean() {
  const inbox = await prisma.webhookInbox.findMany({
    where: { integrationId: { in: ids } },
    select: { id: true },
  })
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: [...payments, ...inbox.map((r) => r.id)] } },
  })
  await prisma.webhookInbox.deleteMany({
    where: { integrationId: { in: ids } },
  })
  await prisma.auditLog.deleteMany({ where: { entityId: { in: attempts } } })
  await prisma.externalResourceTenant.deleteMany({
    where: { integrationId: { in: ids } },
  })
  await prisma.paymentAttempt.deleteMany({
    where: { paymentId: { in: payments } },
  })
  await prisma.payment.deleteMany({ where: { id: { in: payments } } })
}
beforeAll(async () => {
  originalRole = (
    await prisma.membership.findUniqueOrThrow({
      where: { id: context.identity.memberships[0]! },
    })
  ).role
  cookie = await signInParityUser(context, edge, 0)
  for (let n = 0; n < ids.length; n++)
    await prisma.tenantIntegration.create({
      data: {
        id: ids[n]!,
        tenantId: n < 2 ? context.alfa.id : context.bravo.id,
        provider: n % 2 ? 'ASAAS' : 'PIX',
        externalAccountId: 'parity-' + ids[n],
        credentialsRef:
          n < 2
            ? 'env:LOCADORA_INTEGRATION_WEBHOOK_PARITY'
            : 'env:LOCADORA_INTEGRATION_WEBHOOK_FOREIGN',
      },
    })
})
beforeEach(async () => {
  await clean()
  await prisma.membership.update({
    where: { id: context.identity.memberships[0]! },
    data: { role: 'ADMIN' },
  })
  await withTestPlatformTransaction(prisma, async (tx) =>
    tx.organization.update({
      where: { id: context.alfa.id },
      data: { status: 'ACTIVE' },
    })
  )
  await prisma.tenantIntegration.updateMany({
    where: { id: { in: ids } },
    data: { status: 'ACTIVE' },
  })
  await prisma.tenantIntegration.updateMany({
    where: { id: { in: ids.slice(0, 2) } },
    data: {
      credentialsRef: 'env:LOCADORA_INTEGRATION_WEBHOOK_PARITY',
      credentialSource: 'ENV_REF',
      webhookTokenHash: null,
      webhookTokenPreviousHash: null,
      webhookTokenPreviousUntil: null,
    },
  })
  for (let n = 0; n < payments.length; n++) {
    const tenantId = n === 2 ? context.bravo.id : context.alfa.id,
      integrationId = ids[n === 2 ? 3 : n]!
    await prisma.payment.create({
      data: {
        id: payments[n]!,
        tenantId,
        method: n === 0 ? 'PIX' : 'BOLETO',
        type: 'DEPOSIT',
        amount: 100,
        transactionId: external[n]!,
        dueDate: new Date('2030-01-01'),
      },
    })
    await prisma.paymentAttempt.create({
      data: {
        id: attempts[n]!,
        tenantId,
        paymentId: payments[n]!,
        integrationId,
        provider: n === 0 ? 'PIX' : 'ASAAS',
        idempotencyKey: attempts[n]!,
        externalId: external[n]!,
        status: 'ISSUED',
        amount: 100,
        dueDate: new Date('2030-01-01'),
      },
    })
    await prisma.externalResourceTenant.create({
      data: {
        tenantId,
        integrationId,
        provider: n === 0 ? 'PIX' : 'ASAAS',
        resourceType: 'PAYMENT',
        resourceId: payments[n]!,
        externalId: external[n]!,
      },
    })
  }
})
afterAll(async () => {
  try {
    await clean()
    if (originalRole)
      await prisma.membership.update({
        where: { id: context.identity.memberships[0]! },
        data: { role: originalRole },
      })
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'ACTIVE' },
      })
    )
    await prisma.tenantIntegration.deleteMany({ where: { id: { in: ids } } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
function body(
  provider: 'pix' | 'boleto',
  status = 'OVERDUE',
  id = randomUUID()
) {
  return provider === 'pix'
    ? {
        id,
        paymentId: payment(provider),
        transactionId: reference(provider),
        status,
        amount: 100,
        tenantId: context.bravo.id,
      }
    : {
        id,
        event:
          status === 'PAID'
            ? 'PAYMENT_RECEIVED'
            : status === 'CANCELLED'
              ? 'PAYMENT_DELETED'
              : 'PAYMENT_' + status,
        payment: {
          id: reference(provider),
          status:
            status === 'PAID'
              ? 'RECEIVED'
              : status === 'CANCELLED'
                ? 'DELETED'
                : status,
          value: 100,
          paymentDate: '2030-01-01',
        },
        tenantId: context.bravo.id,
      }
}
async function hook(
  host: string,
  provider: 'pix' | 'boleto',
  data: unknown = body(provider),
  opts: {
    raw?: string
    auth?: string
    token?: string
    integrationId?: string
    noId?: boolean
    verb?: string
  } = {}
) {
  const raw = opts.raw ?? JSON.stringify(data)
  const response = await fetch(
    host +
      '/api/payments/' +
      provider +
      '/webhook' +
      (opts.noId ? '' : '/' + (opts.integrationId ?? integration(provider))),
    {
      method: opts.verb ?? 'POST',
      headers: {
        'content-type': 'application/json',
        ...(opts.token
          ? { [opts.token]: opts.auth ?? secret }
          : {
              'x-webhook-signature':
                opts.auth ??
                createHmac('sha256', secret).update(raw).digest('hex'),
            }),
      },
      ...(opts.verb === 'OPTIONS' || opts.verb === 'GET' ? {} : { body: raw }),
    }
  )
  const text = await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers,
  }
}
async function verify(
  host: string,
  id = payments[1]!,
  options: {
    raw?: string
    cookie?: string
    tenant?: string | null
    origin?: string
  } = {}
) {
  const r = await fetch(host + '/api/payments/boleto/verify', {
    method: 'POST',
    headers: {
      ...edge,
      'x-platform-client-ip': context.directory.ips[sequence++ % 64]!,
      Cookie: options.cookie ?? cookie,
      ...(options.tenant === null
        ? {}
        : { 'x-tenant-id': options.tenant ?? context.alfa.id }),
      Origin: options.origin ?? 'https://app.platform.test',
      'Sec-Fetch-Site': options.origin ? 'same-site' : 'same-origin',
      'content-type': 'application/json',
    },
    body:
      options.raw ??
      JSON.stringify({ paymentId: id, tenantId: context.bravo.id }),
  })
  return { status: r.status, body: await r.json() }
}
async function snapshot() {
  return {
    payment: await prisma.payment.findMany({
      where: { id: { in: payments } },
      orderBy: { id: 'asc' },
    }),
    attempts: await prisma.paymentAttempt.findMany({
      where: { paymentId: { in: payments } },
      orderBy: { id: 'asc' },
    }),
    inbox: await prisma.webhookInbox.findMany({
      where: { integrationId: { in: ids } },
      orderBy: { id: 'asc' },
    }),
  }
}
describe.each(hosts)('payment webhook and verification parity %s', (host) => {
  const asaas = (
    data: unknown,
    header = 'asaas-access-token',
    value = secret
  ) =>
    fetch(host + '/api/webhooks/asaas/' + integration('boleto'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', [header]: value },
      body: JSON.stringify(data),
    })
  it('new Asaas URL commits a tenant receipt/outbox before acknowledging, leaving payment unchanged', async () => {
    const data = body('boleto', 'PAID')
    const responses = await Promise.all([asaas(data), asaas(data)])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(
      (
        await prisma.payment.findUniqueOrThrow({
          where: { id: payment('boleto') },
        })
      ).status
    ).toBe('PENDING')
    const receipt = await prisma.webhookInbox.findUniqueOrThrow({
      where: {
        integrationId_eventKey: {
          integrationId: integration('boleto'),
          eventKey: 'id:' + data.id,
        },
      },
    })
    expect(receipt).toMatchObject({
      tenantId: context.alfa.id,
      processedAt: null,
      processingToken: null,
    })
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: receipt.id, topic: 'webhook.process' },
      })
    ).toBe(1)
    expect(
      await prisma.webhookInbox.count({
        where: { integrationId: integration('boleto') },
      })
    ).toBe(1)
    expect(
      await asaas({ ...data, payment: { id: 'changed', value: 101 } }).then(
        (response) => response.status
      )
    ).toBe(200)
    expect(
      await prisma.webhookInbox.findUniqueOrThrow({ where: { id: receipt.id } })
    ).toMatchObject({
      payloadHash: receipt.payloadHash,
      lastError: 'EVENT_IDENTITY_CONFLICT',
      processedAt: expect.any(Date),
    })
    await prisma.auditLog.deleteMany({ where: { entityId: receipt.id } })
  })
  it.each(['access_token', 'x-hook-token', 'x-webhook-signature'])(
    'new Asaas URL rejects %s without persistence',
    async (header) => {
      const data = body('boleto'),
        raw = JSON.stringify(data)
      const value =
        header === 'x-webhook-signature'
          ? createHmac('sha256', secret).update(raw).digest('hex')
          : secret
      expect((await asaas(data, header, value)).status).toBe(401)
      expect(
        await prisma.webhookInbox.count({
          where: { integrationId: integration('boleto') },
        })
      ).toBe(0)
    }
  )
  it('new Asaas URL retains ignored events and defers receipt effects during administrative blocking', async () => {
    const ignored = {
      id: randomUUID(),
      event: 'PAYMENT_NEW_UNKNOWN',
      payment: { id: 'unused', value: 10 },
    }
    expect((await asaas(ignored)).status).toBe(200)
    const receipt = await prisma.webhookInbox.findUniqueOrThrow({
      where: {
        integrationId_eventKey: {
          integrationId: integration('boleto'),
          eventKey: 'id:' + ignored.id,
        },
      },
    })
    expect(receipt).toMatchObject({
      lastError: 'IGNORED_EVENT',
      processedAt: expect.any(Date),
    })
    expect(
      await prisma.outboxEvent.count({ where: { aggregateId: receipt.id } })
    ).toBe(0)
    await withTestPlatformTransaction(prisma, (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'SUSPENDED' },
      })
    )
    expect((await asaas(body('boleto', 'PAID'))).status).toBe(200)
    expect(
      (
        await prisma.payment.findUniqueOrThrow({
          where: { id: payment('boleto') },
        })
      ).status
    ).toBe('PENDING')
  })
  it('new root and account platform routes fail closed without an isolated platform database', async () => {
    const before = await prisma.platformWebhookInbox.count()
    expect(
      (
        await fetch(host + '/api/webhooks/asaas/platform', {
          method: 'POST',
          headers: { 'asaas-access-token': secret },
          body: '{}',
        })
      ).status
    ).toBe(503)
    expect(
      (
        await asaas({
          id: randomUUID(),
          event: 'ACCESS_TOKEN_DISABLED',
          accessToken: { id: 'key' },
        })
      ).status
    ).toBe(503)
    expect(await prisma.platformWebhookInbox.count()).toBe(before)
    expect(
      await prisma.webhookInbox.count({
        where: { integrationId: integration('boleto') },
      })
    ).toBe(0)
  })
  for (const provider of ['pix', 'boleto'] as const)
    describe(provider, () => {
      it('keeps obsolete unscoped URLs at 410', async () => {
        expect((await hook(host, provider, {}, { noId: true })).status).toBe(
          410
        )
        expect((await snapshot()).inbox).toHaveLength(0)
      })
      it('rejects invalid authentication before persistence', async () => {
        const before = await snapshot()
        expect(
          (await hook(host, provider, body(provider), { auth: 'bad' })).status
        ).toBe(401)
        expect(await snapshot()).toEqual(before)
      })
      it('fails closed for missing, invalid, disabled or unconfigured integration', async () => {
        expect(
          (await hook(host, provider, {}, { integrationId: randomUUID() }))
            .status
        ).toBe(503)
        expect(
          (await hook(host, provider, {}, { integrationId: '!invalid' })).status
        ).toBe(503)
        await prisma.tenantIntegration.update({
          where: { id: integration(provider) },
          data: { status: 'DISABLED' },
        })
        expect((await hook(host, provider)).status).toBe(503)
        await prisma.tenantIntegration.update({
          where: { id: integration(provider) },
          data: {
            status: 'ACTIVE',
            credentialsRef: 'env:LOCADORA_INTEGRATION_MISSING',
          },
        })
        expect((await hook(host, provider)).status).toBe(503)
        expect((await snapshot()).inbox).toHaveLength(0)
      })
      it('refuses a different secret, durably defers administrative blocks, resumes after unblock', async () => {
        expect(
          (
            await hook(host, provider, body(provider), {
              integrationId: ids[provider === 'pix' ? 2 : 3],
            })
          ).status
        ).toBe(401)
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.update({
            where: { id: context.alfa.id },
            data: { status: 'SUSPENDED' },
          })
        )
        const event = body(provider, 'PAID')
        const received = await hook(host, provider, event)
        expect(received.status).toBe(200)
        expect(received.body).toEqual({ accepted: true, deferred: true })
        const deferred = await snapshot()
        expect(deferred.inbox).toHaveLength(1)
        expect(deferred.inbox[0]!.processedAt).toBeNull()
        expect(deferred.payment.every((p) => p.status === 'PENDING')).toBe(true)
        await withTestPlatformTransaction(prisma, (tx) =>
          tx.organization.update({
            where: { id: context.alfa.id },
            data: { status: 'ACTIVE' },
          })
        )
        expect((await hook(host, provider, event)).status).toBe(200)
        const resumed = await snapshot()
        expect(resumed.inbox).toHaveLength(1)
        expect(resumed.inbox[0]!.processedAt).toBeInstanceOf(Date)
        expect(
          resumed.payment.find((p) => p.id === payment(provider))!.status
        ).toBe('PAID')
        expect(resumed.payment.find((p) => p.id === payments[2])!.status).toBe(
          'PENDING'
        )
      })
      it.each(['PROVISIONING', 'INBOUND_ONLY'] as const)(
        'reconciles a paid receipt for %s integration while its tenant remains active',
        async (status) => {
          await prisma.tenantIntegration.update({
            where: { id: integration(provider) },
            data: { status },
          })
          expect(
            (await hook(host, provider, body(provider, 'PAID'))).status
          ).toBe(200)
          const state = await snapshot()
          expect(state.inbox).toHaveLength(1)
          expect(state.inbox[0]!.processedAt).toBeInstanceOf(Date)
          expect(
            state.payment.find((p) => p.id === payment(provider))!.status
          ).toBe('PAID')
          expect(state.payment.find((p) => p.id === payments[2])!.status).toBe(
            'PENDING'
          )
        }
      )
      it('persists exact bytes, retry event and effect in the integration tenant', async () => {
        const event = body(provider),
          first = await hook(host, provider, event),
          second = await hook(host, provider, event)
        expect(first.status).toBe(200)
        expect(second.body).toEqual({ success: true, duplicate: true })
        const state = await snapshot()
        expect(state.inbox).toHaveLength(1)
        expect(state.inbox[0]).toMatchObject({
          tenantId: context.alfa.id,
          integrationId: integration(provider),
          eventKey: 'id:' + event.id,
          payloadHash: createHash('sha256')
            .update(JSON.stringify(event))
            .digest('hex'),
          processedAt: expect.any(Date),
          lockedUntil: null,
          processingToken: null,
        })
        expect(
          state.payment.find((p) => p.id === payment(provider))!.status
        ).toBe('OVERDUE')
        expect(state.payment.find((p) => p.id === payments[2])!.status).toBe(
          'PENDING'
        )
        expect(
          await prisma.outboxEvent.count({
            where: {
              aggregateId: state.inbox[0]!.id,
              topic: 'webhook.process',
            },
          })
        ).toBe(1)
      })
      it('refuses reuse of a provider event id with changed signed bytes', async () => {
        const event = body(provider)
        expect((await hook(host, provider, event)).status).toBe(200)
        expect(
          (await hook(host, provider, { ...event, extra: 'different' })).status
        ).toBe(409)
        expect((await snapshot()).inbox).toHaveLength(1)
      })
      it('hides a resource registered to a different tenant', async () => {
        const event = body(provider)
        const foreign =
          provider === 'pix'
            ? { ...event, paymentId: payments[2], transactionId: external[2] }
            : {
                ...event,
                payment: { id: external[2], status: 'OVERDUE', value: 100 },
              }
        expect((await hook(host, provider, foreign)).status).toBe(404)
        const state = await snapshot()
        expect(state.payment.every((p) => p.status === 'PENDING')).toBe(true)
        expect(state.inbox[0]!.processedAt).toBeNull()
      })
      it('marks malformed signed payload as terminal but leaves amount mismatch retryable', async () => {
        expect((await hook(host, provider, { id: randomUUID() })).status).toBe(
          400
        )
        const event = body(provider, 'PAID')
        const mismatch =
          provider === 'pix'
            ? { ...event, amount: 99.99 }
            : {
                ...event,
                payment: {
                  id: reference(provider),
                  status: 'RECEIVED',
                  value: 99.99,
                },
              }
        expect((await hook(host, provider, mismatch)).status).toBe(409)
        const state = await snapshot()
        expect(state.inbox.filter((i) => i.processedAt !== null)).toHaveLength(
          1
        )
        expect(
          state.inbox.find((i) => i.eventKey === 'id:' + event.id)!.lastError
        ).toBe('CONSUMER_HTTP_409')
        expect(state.payment.every((p) => p.status === 'PENDING')).toBe(true)
      })
      it('confirms payment and preserves cancellation or refund semantics', async () => {
        expect(
          (await hook(host, provider, body(provider, 'PAID'))).status
        ).toBe(200)
        expect(
          (
            await prisma.payment.findUniqueOrThrow({
              where: { id: payment(provider) },
            })
          ).status
        ).toBe('PAID')
        expect(
          (await hook(host, provider, body(provider, 'REFUNDED'))).status
        ).toBe(200)
        expect(
          (
            await prisma.payment.findUniqueOrThrow({
              where: { id: payment(provider) },
            })
          ).status
        ).toBe('REFUNDED')
        expect(
          (await hook(host, provider, body(provider, 'CANCELLED'))).status
        ).toBe(200)
        expect(
          (
            await prisma.payment.findUniqueOrThrow({
              where: { id: payment(provider) },
            })
          ).status
        ).toBe('REFUNDED')
      })
      it('keeps JSON and byte-limit errors before creating a receipt', async () => {
        expect((await hook(host, provider, {}, { raw: '{' })).status).toBe(400)
        expect(
          (
            await hook(
              host,
              provider,
              {},
              { raw: 'x'.repeat(2 * 1024 * 1024 + 1) }
            )
          ).status
        ).toBe(413)
        expect((await snapshot()).inbox).toHaveLength(0)
      })
      it('preserves method discovery', async () => {
        const r = await hook(host, provider, {}, { verb: 'OPTIONS' })
        expect(r.status).toBe(204)
        expect(r.headers.get('allow')).toContain('POST')
      })
    })
  it.each(['asaas-access-token', 'access_token', 'x-hook-token'])(
    'preserves Asaas token header %s',
    async (token) => {
      expect(
        (await hook(host, 'boleto', body('boleto'), { token })).status
      ).toBe(200)
    }
  )
  it('preserves verification authorization, selection, CSRF and invalid body', async () => {
    expect((await verify(host, undefined, { cookie: '' })).status).toBe(401)
    expect((await verify(host, undefined, { tenant: null })).status).toBe(409)
    expect(
      (await verify(host, undefined, { origin: 'https://bravo.platform.test' }))
        .status
    ).toBe(403)
    expect((await verify(host, undefined, { raw: '{' })).status).toBe(400)
    await prisma.membership.update({
      where: { id: context.identity.memberships[0]! },
      data: { role: 'CLIENT' },
    })
    expect((await verify(host)).status).toBe(403)
  })
  it('hides missing and foreign verification payments', async () => {
    expect((await verify(host, randomUUID())).status).toBe(404)
    expect((await verify(host, payments[2]!)).status).toBe(404)
    expect((await verify(host, payments[0]!)).status).toBe(404)
  })
  it('preserves pending verification and refuses external reads when disabled', async () => {
    const before = await snapshot()
    expect((await verify(host)).status).toBe(503)
    expect(await snapshot()).toEqual(before)
    await prisma.payment.update({
      where: { id: payments[1]! },
      data: { transactionId: null },
    })
    const r = await verify(host)
    expect(r.status).toBe(202)
    expect(r.body).toMatchObject({
      processing: 'PENDING',
      payment: { id: payments[1], amount: '100' },
    })
  })
  it('rolls back receipt when durable outbox insertion fails', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .replace('-c role=', '')
    if (!/^api_parity_[a-f0-9]+$/.test(role)) throw Error('Unexpected role')
    await alterSharedAcl(pool, 'REVOKE INSERT ON outbox_events FROM ' + role)
    try {
      expect((await hook(host, 'pix')).status).toBe(503)
      const state = await snapshot()
      expect(state.inbox).toHaveLength(0)
      expect(state.payment.every((p) => p.status === 'PENDING')).toBe(true)
    } finally {
      await alterSharedAcl(pool, 'GRANT INSERT ON outbox_events TO ' + role)
    }
  })
  it('retains a failed consumer receipt and retries the same event after recovery', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .replace('-c role=', '')
    if (!/^api_parity_[a-f0-9]+$/.test(role)) throw Error('Unexpected role')
    const event = body('pix', 'PAID')
    await alterSharedAcl(pool, 'REVOKE UPDATE ON payments FROM ' + role)
    try {
      expect((await hook(host, 'pix', event)).status).toBe(500)
      const receipt = (await snapshot()).inbox[0]!
      expect(receipt.processedAt).toBeNull()
      expect(receipt.lastError).toBe('CONSUMER_HTTP_500')
      expect(receipt.processingToken).toBeNull()
      expect(receipt.lockedUntil).toBeNull()
    } finally {
      await alterSharedAcl(pool, 'GRANT UPDATE ON payments TO ' + role)
    }
    expect((await hook(host, 'pix', event)).status).toBe(200)
    expect((await snapshot()).inbox).toHaveLength(1)
  })
  it('keeps payment deletion as cancellation evidence without removing the obligation', async () => {
    expect(
      (await hook(host, 'boleto', body('boleto', 'CANCELLED'))).status
    ).toBe(200)
    expect(
      await prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: attempts[1]! },
      })
    ).toMatchObject({
      status: 'CANCELLED',
      cancellationStatus: 'CONFIRMED',
      cancelledAt: expect.any(Date),
    })
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payments[1]! } }))
        .status
    ).toBe('PENDING')
  })
  it('records a paid non-current Asaas attempt for reconciliation without settling the current obligation', async () => {
    const oldExternal = 'old-' + external[1]!
    await prisma.paymentAttempt.create({
      data: {
        id: attempts[3]!,
        tenantId: context.alfa.id,
        paymentId: payments[1]!,
        integrationId: ids[1]!,
        provider: 'ASAAS',
        idempotencyKey: attempts[3]!,
        externalId: oldExternal,
        status: 'CANCELLED',
        amount: 100,
        dueDate: new Date('2030-01-01'),
      },
    })
    await prisma.externalResourceTenant.create({
      data: {
        tenantId: context.alfa.id,
        integrationId: ids[1]!,
        provider: 'ASAAS',
        resourceType: 'PAYMENT',
        resourceId: payments[1]!,
        externalId: oldExternal,
      },
    })
    const event = {
      ...body('boleto', 'PAID'),
      payment: { id: oldExternal, status: 'RECEIVED', value: 100 },
    }
    const first = await hook(host, 'boleto', event)
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ success: true, reconciliationRequired: true })
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payments[1]! } }))
        .status
    ).toBe('PENDING')
    expect(
      (
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: attempts[3]! },
        })
      ).status
    ).toBe('PAID')
    expect((await hook(host, 'boleto', event)).body).toEqual({
      success: true,
      duplicate: true,
    })
    expect(
      await prisma.auditLog.count({
        where: {
          tenantId: context.alfa.id,
          entityId: attempts[3]!,
          action: 'PAYMENT_RECONCILIATION_REQUIRED',
        },
      })
    ).toBe(1)
  })
})
it('shares the durable lease across both HTTP hosts', async () => {
  const event = body('pix', 'PAID')
  const result = await Promise.all(
    Array.from({ length: 8 }, (_, n) =>
      hook(rotatingTarget(context, n), 'pix', event)
    )
  )
  expect(result.every((r) => r.status === 200 || r.status === 202)).toBe(true)
  const state = await snapshot()
  expect(state.inbox).toHaveLength(1)
  expect(
    await prisma.outboxEvent.count({
      where: { aggregateId: state.inbox[0]!.id, topic: 'webhook.process' },
    })
  ).toBe(1)
  expect(state.payment.find((p) => p.id === payments[0])!.status).toBe('PAID')
})
it.each(hosts)(
  'authenticates VAULT Asaas hashes without an outbound key on HTTP host %s',
  async (host) => {
    const current = 'synthetic-http-current',
      previous = 'synthetic-http-previous'
    await prisma.tenantIntegration.update({
      where: { id: integration('boleto') },
      data: {
        credentialSource: 'VAULT',
        credentialsRef: null,
        webhookTokenHash: createHash('sha256').update(current).digest('hex'),
        webhookTokenPreviousHash: createHash('sha256')
          .update(previous)
          .digest('hex'),
        webhookTokenPreviousUntil: new Date(Date.now() + 60000),
      },
    })
    for (const token of [current, previous])
      expect(
        (
          await hook(host, 'boleto', body('boleto'), {
            token: 'asaas-access-token',
            auth: token,
          })
        ).status
      ).toBe(200)
    for (const header of ['access_token', 'x-hook-token'])
      expect(
        (
          await hook(host, 'boleto', body('boleto'), {
            token: header,
            auth: current,
          })
        ).status
      ).toBe(401)
    await prisma.tenantIntegration.update({
      where: { id: integration('boleto') },
      data: { webhookTokenPreviousUntil: new Date(Date.now() - 60000) },
    })
    expect(
      (
        await hook(host, 'boleto', body('boleto'), {
          token: 'asaas-access-token',
          auth: previous,
        })
      ).status
    ).toBe(401)
    expect(
      (
        await hook(host, 'boleto', body('boleto'), {
          token: 'asaas-access-token',
          auth: current,
        })
      ).status
    ).toBe(200)
    expect((await snapshot()).inbox.length).toBeGreaterThan(0)
  }
)
