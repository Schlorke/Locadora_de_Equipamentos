import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets } from './targets'

const context = inject('apiParity')
const hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const marker = `public-identity-${randomUUID()}`
const member = randomUUID(),
  quote = randomUUID(),
  payment = randomUUID(),
  attempt = randomUUID()
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[60]!,
}
let client = '',
  staff = '',
  requests = 0
const endpoint =
  context.identity.mode === 'legacy'
    ? '/api/auth/session'
    : '/api/auth/get-session'
const contactBody = {
  name: marker,
  email: 'contact@example.test',
  message: 'Rental request',
}
async function request(
  host: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
  method = 'POST'
) {
  const response = await fetch(host + path, {
    method,
    headers: {
      ...edge,
      Origin: edge['x-platform-origin'],
      Cookie: client,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(method === 'GET'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body ?? {}) }),
    redirect: 'manual',
  })
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
  }
}
function publicHeaders() {
  return {
    'x-platform-host-kind': 'tenant',
    'x-platform-tenant-slug': context.alfa.slug,
    'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
    Origin: `https://${context.alfa.slug}.platform.test`,
    // Keep independent test requests out of the production strict limiter's
    // shared bucket; a separate test exercises the exact 10-request threshold.
    'x-platform-client-ip': context.directory.ips[requests++ % 60]!,
    Cookie: '',
  }
}
async function ownedQuotes() {
  return prisma.quote.findMany({
    where: { name: marker },
    orderBy: { id: 'asc' },
  })
}
beforeAll(async () => {
  // The client cookie is issued by the new HTTP engine, not fabricated. Both
  // hosts must read it against the same real credential/session store.
  client = await signInParityUser(
    { ...context, legacy: context.api },
    edge,
    0,
    { fresh: true }
  )
  staff = await signInParityUser(context, edge, 1, { fresh: true })
  await prisma.membership.create({
    data: {
      id: member,
      userId: context.identity.users[1]!.id,
      tenantId: context.alfa.id,
      role: 'ADMIN',
    },
  })
  await prisma.quote.create({
    data: {
      id: quote,
      tenantId: context.alfa.id,
      name: marker,
      email: 'payer@example.test',
      phone: '',
      cpf: '12345678909',
      total: 100,
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  })
  await prisma.payment.create({
    data: {
      id: payment,
      tenantId: context.alfa.id,
      quoteId: quote,
      method: 'BOLETO',
      type: 'DEPOSIT',
      amount: 100,
      transactionId: marker,
      dueDate: new Date('2033-03-01T12:00Z'),
    },
  })
  await prisma.paymentAttempt.create({
    data: {
      id: attempt,
      tenantId: context.alfa.id,
      paymentId: payment,
      provider: 'ASAAS',
      externalId: marker,
      idempotencyKey: marker,
      status: 'ISSUED',
      amount: 100,
      dueDate: new Date('2033-03-01T12:00Z'),
    },
  })
})
afterAll(async () => {
  try {
    const ids = (await ownedQuotes()).map((row) => row.id)
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: [...ids, payment] } },
    })
    await prisma.paymentAttempt.deleteMany({ where: { id: attempt } })
    await prisma.payment.deleteMany({ where: { id: payment } })
    await prisma.quoteItem.deleteMany({ where: { quoteId: { in: ids } } })
    await prisma.quote.deleteMany({ where: { id: { in: ids } } })
    await prisma.membership.deleteMany({ where: { id: member } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

/** Resposta esperada de `GET /api/auth/v2/get-session` sem sessão, por motor (onda 135, B2). */
function expectedV2Session(): unknown {
  return {
    status: context.identity.mode === 'legacy' ? 200 : 410,
    body:
      context.identity.mode === 'legacy'
        ? null
        : { error: 'Use /api/auth after cutover' },
    cache: context.identity.mode === 'legacy' ? 'no-store' : null,
    vary: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch',
    cookie: null,
  }
}
describe(`${context.identity.mode} — public writes, selection and identity HTTP parity`, () => {
  it('accepts the cookie issued by the service in both real session engines', async () => {
    for (const host of hosts) {
      const response = await fetch(host + endpoint, {
        headers: { ...edge, Cookie: client },
      })
      expect(response.status).toBe(200)
      expect((await response.json()).user.id).toBe(
        context.identity.users[0]!.id
      )
    }
  })
  it('keeps the auxiliary Better Auth namespace state and response contract', async () => {
    // Contrato explícito do namespace auxiliar por motor, em cada host (onda 135, B2).
    for (const host of hosts)
      expect(
        await request(
          host,
          '/api/auth/v2/get-session',
          undefined,
          { Cookie: '' },
          'GET'
        )
      ).toEqual(expectedV2Session())
  })
  it('refuses real login POSTs with missing NextAuth CSRF token or a sibling Better Auth origin', async () => {
    for (const host of hosts) {
      const path =
        context.identity.mode === 'legacy'
          ? '/api/auth/callback/credentials'
          : '/api/auth/sign-in/email'
      const response = await fetch(host + path, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          ...edge,
          Origin: 'https://bravo.platform.test',
          'Content-Type':
            context.identity.mode === 'legacy'
              ? 'application/x-www-form-urlencoded'
              : 'application/json',
        },
        body:
          context.identity.mode === 'legacy'
            ? new URLSearchParams({
                email: context.identity.users[0]!.email,
                password: context.identity.users[0]!.password,
                json: 'true',
              })
            : JSON.stringify({
                email: context.identity.users[0]!.email,
                password: context.identity.users[0]!.password,
              }),
      })
      if (context.identity.mode === 'better-auth')
        expect(response.status).toBe(403)
      expect(
        response.headers
          .getSetCookie()
          .some((cookie) =>
            /^(?:next-auth\.session-token|__Host-locadora\.session_token)=/.test(
              cookie
            )
          )
      ).toBe(false)
    }
  })
  it.each(hosts)(
    'validates membership before setting and clearing a host-only preference: %s',
    async (host) => {
      const selected = await request(
        host,
        '/api/auth/organizations/selection',
        { tenantId: context.alfa.id, role: 'ADMIN' }
      )
      expect(selected.status).toBe(200)
      expect(selected.body.selection).toMatchObject({
        tenant: { id: context.alfa.id },
        membershipId: context.identity.memberships[0]!,
        role: 'CLIENT',
      })
      expect(selected.cookie).toContain(`selected-tenant-id=${context.alfa.id}`)
      expect(selected.cookie).toMatch(/; Secure(?:;|$)/)
      expect(selected.cookie).toMatch(/; HttpOnly(?:;|$)/)
      expect(selected.cookie).not.toMatch(/; Domain=/i)
      expect(selected.cache).toBe('no-store')
      const saved = selected.cookie!.split(';')[0]!
      const current = await request(
        host,
        '/api/auth/organizations/selection',
        undefined,
        { Cookie: `${client}; ${saved}` },
        'GET'
      )
      expect(current.body.selection.tenant.id).toBe(context.alfa.id)
      const cleared = await request(
        host,
        '/api/auth/organizations/selection',
        '{',
        { Cookie: `${client}; ${saved}` },
        'DELETE'
      )
      expect(cleared.status).toBe(200)
      expect(cleared.body).toEqual({ selection: null })
      expect(cleared.cookie).toContain('Max-Age=0')
    }
  )
  it.each(hosts)(
    'does not trust a body role, revoked membership, sibling Origin or forged cookie: %s',
    async (host) => {
      const noSession = await request(
        host,
        '/api/auth/organizations/selection',
        '{',
        {
          Cookie:
            'next-auth.session-token=forged; __Host-locadora.session_token=forged',
        }
      )
      expect(noSession.status).toBe(401)
      expect(noSession.cookie).toContain('Max-Age=0')
      const foreign = await request(host, '/api/auth/organizations/selection', {
        tenantId: context.unconfigured,
        role: 'ADMIN',
      })
      expect(foreign.status).toBe(403)
      expect(foreign.cookie).toBeNull()
      const sibling = await request(
        host,
        '/api/auth/organizations/selection',
        { tenantId: context.alfa.id },
        { Origin: 'https://bravo.platform.test' }
      )
      expect(sibling.status).toBe(403)
      expect(sibling.cookie).toBeNull()
      try {
        await prisma.membership.update({
          where: { id: context.identity.memberships[0]! },
          data: { status: 'REVOKED' },
        })
        expect(
          (
            await request(host, '/api/auth/organizations/selection', {
              tenantId: context.alfa.id,
            })
          ).status
        ).toBe(403)
      } finally {
        await prisma.membership.update({
          where: { id: context.identity.memberships[0]! },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it.each(hosts)(
    'persists contact and notification atomically in the resolved company: %s',
    async (host) => {
      const response = await request(
        host,
        '/api/contact',
        {
          ...contactBody,
          tenantId: context.bravo.id,
          equipment: 'informational',
        },
        publicHeaders()
      )
      expect(response.status).toBe(202)
      expect(response.body.data.deliveryStatus).toBe('queued')
      const id = response.body.data.messageId
      const row = await prisma.quote.findUniqueOrThrow({ where: { id } })
      expect(row.tenantId).toBe(context.alfa.id)
      expect(row.total.toString()).toBe('0')
      expect(row.status).toBe('PENDING')
      expect(row.message).toBe(contactBody.message)
      const events = await prisma.outboxEvent.findMany({
        where: { aggregateId: id },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        tenantId: context.alfa.id,
        topic: 'quote.created.notify',
        dedupeKey: `${context.alfa.id}:quote-created:${id}`,
        payload: { quoteId: id, kind: 'contact' },
      })
    }
  )
  it.each(hosts)(
    'rejects conflicting tenant and origin before any contact write: %s',
    async (host) => {
      const before = await ownedQuotes()
      expect(
        (
          await request(
            host,
            '/api/contact',
            { ...contactBody, tenantSlug: context.bravo.slug },
            publicHeaders()
          )
        ).status
      ).toBe(400)
      expect(
        (
          await request(host, '/api/contact', contactBody, {
            ...publicHeaders(),
            Origin: `https://${context.bravo.slug}.platform.test`,
          })
        ).status
      ).toBe(403)
      expect(
        (
          await request(
            host,
            '/api/contact',
            { ...contactBody, email: 'invalid' },
            publicHeaders()
          )
        ).status
      ).toBe(400)
      expect(await ownedQuotes()).toEqual(before)
    }
  )
  it('rolls back the contact if its durable notification cannot be inserted', async () => {
    const name = `wave55_${randomUUID().replaceAll('-', '')}`
    const before = await ownedQuotes()
    try {
      await pool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.topic = 'quote.created.notify' AND EXISTS (SELECT 1 FROM quotes WHERE id = NEW."aggregateId" AND name = '${marker}') THEN RAISE EXCEPTION 'local notification failure'; END IF; RETURN NEW; END $$`
      )
      await pool.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      for (const host of hosts) {
        const response = await request(
          host,
          '/api/contact',
          contactBody,
          publicHeaders()
        )
        expect(response.status).toBe(500)
        expect(response.body).toEqual({ error: 'Erro ao salvar solicitação' })
      }
      expect(await ownedQuotes()).toEqual(before)
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON outbox_events`)
      await pool.query(`DROP FUNCTION IF EXISTS ${name}()`)
    }
  })
  it.each(hosts)(
    'preserves the localized quotation alias and queues its existing notification: %s',
    async (host) => {
      const response = await request(
        host,
        '/api/orcamentos',
        {
          customerName: marker,
          customerEmail: 'quote@example.test',
          customerPhone: '',
          deliveryType: 'PICKUP',
          items: [
            {
              equipmentId: context.alfa.equipmentIds[0],
              quantity: 1,
              days: 3,
              startDate: '2033-03-01T00:00:00Z',
              endDate: '2033-03-11T00:00:00Z',
              pricePerDay: 0.01,
              total: 0.03,
            },
          ],
          total: 0.03,
        },
        publicHeaders()
      )
      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      const row = await prisma.quote.findUniqueOrThrow({
        where: { id: response.body.data.id },
      })
      expect(row.tenantId).toBe(context.alfa.id)
      expect(response.body.data.totalValue).toBe(row.total.toJSON())
      expect(row.total.toNumber()).toBeGreaterThan(0.03)
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: row.id, topic: 'quote.created.notify' },
        })
      ).toBe(1)
    }
  )
  it('queues one boleto notification for the issued attempt across both hosts, without calling Asaas', async () => {
    for (const host of hosts) {
      const response = await request(
        host,
        `/api/admin/quotes/${quote}/send-boleto`,
        '{',
        {
          Cookie: staff,
          'x-tenant-id': context.alfa.id,
          'x-platform-client-ip': context.directory.ips[requests++ % 60]!,
        }
      )
      expect(response.status).toBe(202)
      expect(response.body.processing).toBe('PENDING')
      expect(response.body.boleto.paymentId).toBe(payment)
    }
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: payment },
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      topic: 'payment.boleto.notify',
      dedupeKey: `${context.alfa.id}:payment.boleto.notify:${attempt}`,
      payload: {
        paymentId: payment,
        externalId: marker,
        requestedBy: context.identity.users[1]!.id,
      },
    })
    expect(
      await prisma.paymentAttempt.count({ where: { paymentId: payment } })
    ).toBe(1)
  })
  it.each(hosts)(
    'refuses client/foreign/cross-origin boleto delivery without changing its queue: %s',
    async (host) => {
      const before = await prisma.outboxEvent.findMany({
        where: { aggregateId: payment },
      })
      const deniedHeaders: Record<string, string>[] = [
        { Cookie: client, 'x-tenant-id': context.alfa.id },
        { Cookie: staff, 'x-tenant-id': context.bravo.id },
        {
          Cookie: staff,
          'x-tenant-id': context.alfa.id,
          Origin: 'https://bravo.platform.test',
        },
      ]
      for (const headers of deniedHeaders)
        expect(
          (
            await request(
              host,
              `/api/admin/quotes/${quote}/send-boleto`,
              {},
              {
                ...headers,
                'x-platform-client-ip': context.directory.ips[requests++ % 60]!,
              }
            )
          ).status
        ).toBe(403)
      expect(
        await prisma.outboxEvent.findMany({ where: { aggregateId: payment } })
      ).toEqual(before)
    }
  )
  it('serves only the pinned HDR path surface and rejects invalid URLs without outbound access', async () => {
    for (const host of hosts)
      for (const path of [
        'not-allowed/file.hdr',
        'hdri/file.svg',
        'hdri/nested/file.hdr',
      ]) {
        const response = await fetch(`${host}/api/drei-proxy/${path}`)
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Invalid asset path' })
        expect(response.headers.get('access-control-allow-origin')).toBeNull()
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      }
  })
  it.each(hosts)(
    'keeps the strict contact limit without writing invalid requests: %s',
    async (host) => {
      const headers = {
        ...publicHeaders(),
        'x-platform-client-ip': context.directory.ips[62]!,
      }
      for (let index = 0; index < 10; index++)
        expect(
          (
            await request(
              host,
              '/api/contact',
              { ...contactBody, name: '' },
              headers
            )
          ).status
        ).toBe(400)
      expect(
        (
          await request(
            host,
            '/api/contact',
            { ...contactBody, name: '' },
            headers
          )
        ).status
      ).toBe(429)
    }
  )
  it('keeps contacts and their outbox rows invisible to a sibling under the real non-bypass role', async () => {
    const runtimePool = new Pool({ connectionString: context.runtimeUrl })
    const sql = await runtimePool.connect()
    try {
      const role = (
        await sql.query(
          'SELECT current_user AS name, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user'
        )
      ).rows[0]
      expect(role.name).toMatch(/^api_parity_/)
      expect(role.rolbypassrls).toBe(false)
      expect(role.rolsuper).toBe(false)
      await sql.query('BEGIN')
      await sql.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.bravo.id,
      ])
      expect(
        (await sql.query('SELECT id FROM quotes WHERE name = $1', [marker]))
          .rows
      ).toHaveLength(0)
      expect(
        (
          await sql.query(
            'SELECT id FROM outbox_events WHERE "aggregateId" = $1',
            [payment]
          )
        ).rows
      ).toHaveLength(0)
      await sql.query('ROLLBACK')
      await sql.query('BEGIN')
      await sql.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      expect(
        (await sql.query('SELECT id FROM quotes WHERE name = $1', [marker]))
          .rows.length
      ).toBeGreaterThan(0)
      expect(
        (
          await sql.query(
            'SELECT id FROM outbox_events WHERE "aggregateId" = $1',
            [payment]
          )
        ).rows
      ).toHaveLength(1)
      await sql.query('ROLLBACK')
    } finally {
      await sql.query('ROLLBACK')
      sql.release()
      await runtimePool.end()
    }
  })
})
