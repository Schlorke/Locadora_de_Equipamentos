import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createAdminPaymentApi } from '../../packages/frontend/src/entities/pagamento/api/admin-payments'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const quotes: string[] = Array.from({ length: 3 }, () => randomUUID())
const paymentId = randomUUID(),
  attemptId = randomUUID(),
  integration = randomUUID(),
  member = randomUUID(),
  permission = randomUUID()
const user = context.identity.users[0]!.id
const clientMember = context.identity.memberships[0]!
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[54]!,
}
let jar: string,
  staffJar: string,
  counter = 0
const actions = ['pix', 'boleto', 'generate', 'regenerate', 'pdf'] as const
type Action = (typeof actions)[number]
const method = (action: Action) =>
  action === 'pdf' ? 'GET' : action === 'regenerate' ? 'PUT' : 'POST'
const pathname = (action: Action, id?: string) =>
  action === 'pix'
    ? '/api/payments/pix'
    : action === 'boleto'
      ? '/api/payments/boleto/generate'
      : action === 'generate'
        ? `/api/admin/quotes/${id ?? quotes[0]}/generate-boleto`
        : `/api/payments/boleto/${id ?? paymentId}/${action}`
const payload = () => ({
  quoteId: quotes[0],
  amount: 100,
  dueDate: '2026-12-01',
  tenantId: context.bravo.id,
  customerName: 'spoofed',
  customerDocument: 'spoofed',
  customerEmail: 'spoofed@example.test',
})
async function request(
  host: string,
  action: Action,
  body: unknown = payload(),
  opts: {
    cookie?: string
    tenant?: string | null
    id?: string
    origin?: string
    raw?: boolean
    verb?: string
  } = {}
) {
  const verb = opts.verb ?? method(action)
  const response = await fetch(host + pathname(action, opts.id), {
    method: verb,
    redirect: 'manual',
    headers: {
      ...edge,
      'x-platform-client-ip': context.directory.ips[counter++ % 64]!,
      Cookie: opts.cookie ?? jar,
      ...(opts.tenant === null
        ? {}
        : { 'x-tenant-id': opts.tenant ?? context.alfa.id }),
      Origin: opts.origin ?? 'https://app.platform.test',
      'Sec-Fetch-Site': opts.origin ? 'same-site' : 'same-origin',
      'content-type': 'application/json',
    },
    ...(verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS'
      ? {}
      : { body: opts.raw ? String(body) : JSON.stringify(body) }),
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  }
}
async function snapshot() {
  return {
    payments: await prisma.payment.findMany({
      where: { quoteId: { in: quotes } },
      orderBy: { id: 'asc' },
    }),
    attempts: await prisma.paymentAttempt.findMany({
      where: { payment: { quoteId: { in: quotes } } },
      orderBy: { id: 'asc' },
    }),
    events: await prisma.outboxEvent.findMany({
      where: { tenantId: context.alfa.id },
      orderBy: { id: 'asc' },
    }),
  }
}
async function cleanup() {
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: [paymentId, ...quotes] } },
  })
  const payments = await prisma.payment.findMany({
    where: { quoteId: { in: quotes } },
    select: { id: true },
  })
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: payments.map((p) => p.id) } },
  })
  await prisma.externalResourceTenant.deleteMany({
    where: { resourceId: { in: payments.map((p) => p.id) } },
  })
  await prisma.paymentAttempt.deleteMany({
    where: { paymentId: { in: payments.map((p) => p.id) } },
  })
  await prisma.payment.deleteMany({ where: { quoteId: { in: quotes } } })
  await prisma.quote.deleteMany({ where: { id: { in: quotes } } })
}
beforeAll(async () => {
  jar = await signInParityUser(context, edge, 0)
  staffJar = await signInParityUser(context, edge, 1)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
    },
  })
  await prisma.tenantIntegration.create({
    data: {
      id: integration,
      tenantId: context.alfa.id,
      provider: 'ASAAS',
      credentialsRef: 'env:LOCADORA_INTEGRATION_PARITY',
    },
  })
})
beforeEach(async () => {
  await cleanup()
  await prisma.permission.deleteMany({ where: { id: permission } })
  await prisma.membership.update({
    where: { id: clientMember },
    data: { status: 'ACTIVE', role: 'CLIENT' },
  })
  await prisma.membership.update({
    where: { id: member },
    data: { status: 'ACTIVE', role: 'ADMIN' },
  })
  await prisma.tenantIntegration.update({
    where: { id: integration },
    data: {
      status: 'ACTIVE',
      credentialsRef: 'env:LOCADORA_INTEGRATION_PARITY',
    },
  })
  for (let i = 0; i < quotes.length; i++)
    await prisma.quote.create({
      data: {
        id: quotes[i]!,
        tenantId: i === 1 ? context.bravo.id : context.alfa.id,
        userId: i === 2 ? context.identity.users[1]!.id : user,
        name: 'Persisted payer',
        email: 'payer@example.test',
        cpf: '12345678909',
        phone: '',
        total: 100,
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })
})
afterAll(async () => {
  try {
    await cleanup()
    await prisma.permission.deleteMany({ where: { id: permission } })
    await prisma.membership.deleteMany({ where: { id: member } })
    await prisma.membership.update({
      where: { id: clientMember },
      data: { role: 'CLIENT', status: 'ACTIVE' },
    })
    await prisma.tenantIntegration.deleteMany({ where: { id: integration } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
async function issued(
  metadata: object = { pdfUrl: 'https://www.asaas.com/invoice/fixture' }
) {
  await prisma.payment.create({
    data: {
      id: paymentId,
      tenantId: context.alfa.id,
      quoteId: quotes[0],
      amount: 100,
      type: 'DEPOSIT',
      method: 'BOLETO',
      transactionId: 'local-issued',
      dueDate: new Date('2026-01-01T12:00Z'),
      metadata,
    },
  })
  await prisma.paymentAttempt.create({
    data: {
      id: attemptId,
      tenantId: context.alfa.id,
      paymentId,
      integrationId: integration,
      provider: 'ASAAS',
      externalId: 'local-issued',
      status: 'ISSUED',
      amount: 100,
      dueDate: new Date('2026-01-01T12:00Z'),
      idempotencyKey: 'old-' + paymentId,
    },
  })
}
for (const host of hosts)
  describe(host, () => {
    it('wave66 consumer preserves queued quote issuance and tenant isolation', async () => {
      const api = createAdminPaymentApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Origin: edge['x-platform-origin'],
            Cookie: staffJar,
            'x-tenant-id': context.alfa.id,
          }),
        })
      )
      expect(await api.generateForQuote(quotes[0]!)).toMatchObject({
        ok: true,
        status: 202,
        data: { processing: 'PENDING', boleto: { processing: 'PENDING' } },
      })
      const state = await snapshot()
      expect(state.payments).toHaveLength(1)
      expect(state.payments[0]?.tenantId).toBe(context.alfa.id)
      expect(state.attempts).toHaveLength(0)
      expect(state.events[0]?.topic).toBe('payment.issue')
      expect(state.events[0]?.aggregateId).toBe(state.payments[0]?.id)
      expect(state.events).toHaveLength(1)
      expect(await api.generateForQuote(quotes[1]!)).toMatchObject({
        ok: false,
        status: 404,
      })
      expect(await snapshot()).toEqual(state)
    })
    it('wave66 consumer sends PUT reissue without body and preserves queued date', async () => {
      await issued()
      const api = createAdminPaymentApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Origin: edge['x-platform-origin'],
            Cookie: staffJar,
            'x-tenant-id': context.alfa.id,
          }),
        })
      )
      expect(await api.regenerate(paymentId)).toMatchObject({
        ok: true,
        status: 202,
        data: { processing: 'PENDING' },
      })
      expect(
        (
          await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })
        ).dueDate?.toISOString()
      ).toBe('2026-01-01T12:00:00.000Z')
      expect(await api.regenerate('missing')).toMatchObject({
        ok: false,
        status: 404,
      })
    })

    it.each(actions)('requires a real session for %s', async (action) => {
      const before = await snapshot()
      expect(
        (await request(host, action, payload(), { cookie: '' })).status
      ).toBe(401)
      expect(await snapshot()).toEqual(before)
    })
    it.each(actions)('requires explicit selection for %s', async (action) => {
      const before = await snapshot()
      expect(
        (await request(host, action, payload(), { tenant: null })).status
      ).toBe(409)
      expect(await snapshot()).toEqual(before)
    })
    it.each(actions)('checks current membership for %s', async (action) => {
      await prisma.membership.update({
        where: { id: clientMember },
        data: { status: 'REVOKED' },
      })
      expect((await request(host, action)).status).toBe(403)
      expect((await snapshot()).payments).toHaveLength(0)
    })
    it.each(['pix', 'boleto', 'generate', 'regenerate'] as const)(
      'rejects sibling CSRF before parsing %s',
      async (action) => {
        const before = await snapshot()
        expect(
          (
            await request(host, action, '{invalid', {
              raw: true,
              origin: 'https://bravo.platform.test',
            })
          ).status
        ).toBe(403)
        expect(await snapshot()).toEqual(before)
      }
    )
    it.each(['pix', 'boleto'] as const)(
      'enqueues one canonical %s obligation and no fabricated result',
      async (action) => {
        const a = await request(host, action),
          b = await request(host, action)
        expect(a.status).toBe(202)
        expect(b.status).toBe(202)
        expect(a.body).toMatchObject({
          processing: 'PENDING',
          payment: {
            tenantId: context.alfa.id,
            quoteId: quotes[0],
            amount: '100',
            status: 'PENDING',
            transactionId: null,
          },
        })
        expect(a.body.payment.id).toBe(b.body.payment.id)
        if (action === 'boleto') expect(a.body.boleto).toBeNull()
        else expect(a.body.pixCode).toBeNull()
        const state = await snapshot()
        expect(state.payments).toHaveLength(1)
        expect(state.attempts).toHaveLength(1)
        expect(state.events).toHaveLength(1)
        expect(state.attempts[0]).toMatchObject({
          integrationId: integration,
          status: 'QUEUED',
        })
        expect(state.events[0]).toMatchObject({
          topic: 'payment.issue',
          status: 'PENDING',
        })
      }
    )
    it.each(['pix', 'boleto'] as const)(
      'hides other tenants and other owners for %s',
      async (action) => {
        for (const quoteId of [quotes[1], quotes[2], randomUUID()])
          expect(
            (await request(host, action, { ...payload(), quoteId })).status
          ).toBe(404)
        expect((await snapshot()).payments).toHaveLength(0)
      }
    )
    it.each(['pix', 'boleto'] as const)(
      'preserves invalid body, references and amount refusals for %s',
      async (action) => {
        for (const body of [
          { ...payload(), amount: 1 },
          { ...payload(), amount: -1 },
          { ...payload(), dueDate: 'bad' },
          { ...payload(), rentalId: 'also-a-rental' },
          { amount: 100, dueDate: '2026-12-01' },
        ])
          expect((await request(host, action, body)).status).toBe(400)
        expect(
          (await request(host, action, '{bad', { raw: true })).status
        ).toBe(400)
        expect((await snapshot()).payments).toHaveLength(0)
      }
    )
    it('preserves cents balance and rejects another pending payment method', async () => {
      await prisma.quote.update({
        where: { id: quotes[0] },
        data: { total: '10.005' },
      })
      expect(
        (await request(host, 'pix', { ...payload(), amount: 10.01 })).body
          .payment.amount
      ).toBe('10.01')
      expect(
        (await request(host, 'boleto', { ...payload(), amount: 10.01 })).status
      ).toBe(409)
      expect((await snapshot()).payments).toHaveLength(1)
    })
    it('rejects unavailable credentials or inactive integration without writes', async () => {
      await prisma.tenantIntegration.update({
        where: { id: integration },
        data: { credentialsRef: 'env:LOCADORA_INTEGRATION_UNCONFIGURED' },
      })
      expect((await request(host, 'pix')).status).toBe(503)
      await prisma.tenantIntegration.update({
        where: { id: integration },
        data: { status: 'DISABLED' },
      })
      expect((await request(host, 'boleto')).status).toBe(503)
      expect((await snapshot()).payments).toHaveLength(0)
    })
    it('returns issued provider metadata without creating another attempt', async () => {
      await issued({
        barcode: 'persisted-code',
        pdfUrl: 'https://asaas.com/fixture',
      })
      const r = await request(host, 'boleto')
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({
        processing: 'ISSUED',
        boleto: { barcode: 'persisted-code' },
      })
      expect((await snapshot()).attempts).toHaveLength(1)
      expect((await snapshot()).events).toHaveLength(0)
    })
    it('does not accept local cancellation as proof of provider termination', async () => {
      await issued()
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'CANCELLED' },
      })
      const before = await snapshot(),
        r = await request(host, 'pix')
      expect(r.status).toBe(503)
      expect(await snapshot()).toEqual(before)
    })
    it('requires FINANCIAL WRITE for generation and regeneration', async () => {
      await issued()
      expect((await request(host, 'regenerate')).status).toBe(403)
      expect((await request(host, 'generate')).status).toBe(403)
      await prisma.membership.update({
        where: { id: clientMember },
        data: { role: 'OPERATOR' },
      })
      await prisma.permission.create({
        data: {
          id: permission,
          tenantId: context.alfa.id,
          role: 'OPERATOR',
          module: 'FINANCIAL',
          action: 'READ',
        },
      })
      expect((await request(host, 'regenerate')).status).toBe(403)
      await prisma.permission.update({
        where: { id: permission },
        data: { action: 'WRITE' },
      })
      expect((await request(host, 'regenerate')).status).toBe(202)
    })
    it('uses the existing quote boleto service and preserves its envelope', async () => {
      const a = await request(host, 'generate', {}, { cookie: staffJar }),
        b = await request(host, 'generate', {}, { cookie: staffJar })
      expect(a.status).toBe(202)
      expect(a.body).toMatchObject({
        success: true,
        processing: 'PENDING',
        boleto: { amount: 100, processing: 'PENDING' },
      })
      expect(b.body.boleto.paymentId).toBe(a.body.boleto.paymentId)
      expect((await snapshot()).events).toHaveLength(1)
    })
    it('keeps PDF redirect private, and never fetches provider content', async () => {
      await issued()
      const r = await request(host, 'pdf')
      expect(r.status).toBe(302)
      expect(r.headers.get('location')).toBe(
        'https://www.asaas.com/invoice/fixture'
      )
      expect(r.headers.get('cache-control')).toBe('private, no-store')
      expect((await snapshot()).events).toHaveLength(0)
    })
    it.each([
      'http://asaas.com/fixture',
      'https://asaas.com.evil.test/',
      'https://user:pass@asaas.com/',
      'not a URL',
    ])('refuses unsafe document URL %s', async (pdfUrl) => {
      await issued({ pdfUrl })
      expect((await request(host, 'pdf')).status).toBe(409)
    })
    it('preserves pending document and hides foreign/missing payments', async () => {
      await issued({})
      expect((await request(host, 'pdf')).body).toEqual({
        error: 'Documento do provedor ainda não disponível',
        processing: 'PENDING',
      })
      expect(
        (await request(host, 'pdf', {}, { id: randomUUID() })).status
      ).toBe(404)
    })
    it('rolls back a new obligation and attempt when outbox insertion fails', async () => {
      // This failure is injected into the temporary runtime role only.
      const role = new URL(context.runtimeUrl).searchParams
        .get('options')!
        .replace('-c role=', '')
      if (!/^api_parity_[a-f0-9]+$/.test(role))
        throw Error('Unexpected runtime role')
      await alterSharedAcl(pool, `REVOKE INSERT ON outbox_events FROM ${role}`)
      try {
        const r = await request(host, 'pix')
        expect(r.status).toBe(500)
        expect(r.body).toEqual({
          error: 'Não foi possível solicitar a cobrança',
        })
        expect((await snapshot()).payments).toHaveLength(0)
        expect((await snapshot()).attempts).toHaveLength(0)
      } finally {
        await alterSharedAcl(pool, `GRANT INSERT ON outbox_events TO ${role}`)
      }
    })
    it.each(actions)('preserves method discovery for %s', async (action) => {
      const r = await request(host, action, {}, { verb: 'OPTIONS' })
      expect(r.status).toBe(204)
      expect(r.headers.get('allow')?.split(/,\s*/)).toContain(method(action))
    })
    it('hides PDF ownership inside the tenant and across tenants under real RLS', async () => {
      await issued()
      await prisma.quote.update({
        where: { id: quotes[0] },
        data: { userId: context.identity.users[1]!.id },
      })
      const hidden = await request(host, 'pdf')
      expect(hidden.status).toBe(404)
      const foreign = await prisma.payment.create({
        data: {
          tenantId: context.bravo.id,
          quoteId: quotes[1],
          amount: 100,
          type: 'DEPOSIT',
          method: 'BOLETO',
          dueDate: new Date('2026-12-01'),
          metadata: { pdfUrl: 'https://asaas.com/foreign-private' },
        },
      })
      const r = await request(host, 'pdf', {}, { id: foreign.id })
      expect(r.status).toBe(404)
      expect(r.body).toEqual(hidden.body)
    })
  })
it('deduplicates concurrent requests across the two HTTP hosts', async () => {
  const responses = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      request(rotatingTarget(context, i), 'pix')
    )
  )
  expect(responses.map((r) => r.status)).toEqual(Array(8).fill(202))
  // parity-scan: oito pedidos reais simultâneos (alternando os hosts no ar) resultam numa só cobrança.
  expect(new Set(responses.map((r) => r.body.payment.id)).size).toBe(1)
  const state = await snapshot()
  expect(state.payments).toHaveLength(1)
  expect(state.attempts).toHaveLength(1)
  expect(state.events).toHaveLength(1)
})
