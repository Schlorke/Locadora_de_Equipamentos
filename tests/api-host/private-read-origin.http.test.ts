import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { namedParityTargets } from './targets'

/**
 * Wave 132 (finding 144): every private read that goes through the common principal of both hosts refuses an
 * explicit browser Origin other than the host's own, on GET and HEAD as on mutations, after the current membership
 * (the role) and before any data. A request without Origin (navigation, native app, server-to-server) keeps
 * working, and the earlier refusals (401 without session, 403 without membership) keep their envelopes.
 *
 * One representative read per gate family: the principal followed by a route role check, the tenant permission
 * resolver, and the client area on a tenant host (portal list and notification counters).
 */
const context = inject('apiParity')
const hosts = namedParityTargets(context, { legacy: 'legacy', api: 'service' })
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const appOrigin = 'https://app.platform.test'
const alfaOrigin = `https://${context.alfa.slug}.platform.test`
const siblingOrigin = `https://${context.bravo.slug}.platform.test`
const clientIp = context.directory.ips[45]!
const appEdge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': appOrigin,
  'x-platform-client-ip': clientIp,
}
const alfaEdge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-origin': alfaOrigin,
  'x-platform-tenant-slug': context.alfa.slug,
  'x-platform-client-ip': clientIp,
}
const staffMembership = randomUUID()
const jars = { staff: '', customer: '' }

type Read = {
  label: string
  path: string
  edge: Record<string, string>
  own: string
  jar: keyof typeof jars
  tenant?: string
}
const reads: Read[] = [
  {
    label: 'principal and route role (drivers)',
    path: '/api/admin/drivers',
    edge: appEdge,
    own: appOrigin,
    jar: 'staff',
    tenant: context.alfa.id,
  },
  {
    label: 'tenant permission (categories)',
    path: '/api/admin/categories',
    edge: appEdge,
    own: appOrigin,
    jar: 'staff',
    tenant: context.alfa.id,
  },
  {
    label: 'client area on the tenant host (rentals)',
    path: '/api/client/rentals',
    edge: alfaEdge,
    own: alfaOrigin,
    jar: 'customer',
  },
  {
    label: 'client notification counters on the tenant host',
    path: '/api/client/notifications/stats',
    edge: alfaEdge,
    own: alfaOrigin,
    jar: 'customer',
  },
]

async function read(
  host: string,
  item: Read,
  headers: Record<string, string | undefined> = {},
  method: 'GET' | 'HEAD' = 'GET'
) {
  const merged: Record<string, string | undefined> = {
    ...item.edge,
    Cookie: jars[item.jar],
    ...(item.tenant ? { 'x-tenant-id': item.tenant } : {}),
    ...headers,
  }
  const response = await fetch(host + item.path, {
    method,
    headers: Object.fromEntries(
      Object.entries(merged).flatMap(([name, value]) =>
        value === undefined || value === '' ? [] : [[name, value] as const]
      )
    ),
  })
  const text = method === 'HEAD' ? '' : await response.text()
  let body: unknown = null
  if (text)
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  return {
    status: response.status,
    cache: response.headers.get('cache-control'),
    body,
  }
}
const refusal = {
  status: 403,
  cache: 'no-store',
  body: { error: 'Origem não permitida' },
}

beforeAll(async () => {
  jars.customer = await signInParityUser(context, appEdge, 0)
  jars.staff = await signInParityUser(context, appEdge, 2)
  await prisma.membership.create({
    data: {
      id: staffMembership,
      tenantId: context.alfa.id,
      userId: context.identity.users[2]!.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
})
afterAll(async () => {
  await prisma.membership.deleteMany({ where: { id: staffMembership } })
  await prisma.$disconnect()
  await pool.end()
})

describe.each(hosts)(
  'private reads and explicit Origin (%s host)',
  (_name, host) => {
    describe.each(reads)('$label', (item) => {
      it('answers without Origin (navigation, native app, server) and with its own Origin', async () => {
        expect((await read(host, item)).status).toBe(200)
        expect((await read(host, item, { Origin: item.own })).status).toBe(200)
        expect(
          (
            await read(host, item, {
              Origin: item.own,
              'Sec-Fetch-Site': 'same-origin',
            })
          ).status
        ).toBe(200)
        expect((await read(host, item, {}, 'HEAD')).status).toBe(200)
      })

      it('refuses a sibling locadora Origin on GET with the central 403 envelope', async () => {
        expect(await read(host, item, { Origin: siblingOrigin })).toEqual(
          refusal
        )
      })

      it('refuses a sibling locadora Origin on HEAD', async () => {
        expect(
          await read(host, item, { Origin: siblingOrigin }, 'HEAD')
        ).toMatchObject({ status: 403, cache: 'no-store' })
      })

      it('refuses an opaque Origin and cross-site metadata on an explicit Origin', async () => {
        expect(await read(host, item, { Origin: 'null' })).toEqual(refusal)
        expect(
          await read(host, item, {
            Origin: item.own,
            'Sec-Fetch-Site': 'cross-site',
          })
        ).toEqual(refusal)
      })

      it('keeps the unauthenticated envelope before the Origin check', async () => {
        const result = await read(host, item, {
          Origin: siblingOrigin,
          Cookie: undefined,
        })
        expect(result.status).toBe(401)
        expect(result.body).toEqual({ error: 'Authentication required' })
      })
    })

    it('keeps the membership refusal before the Origin check', async () => {
      const drivers = reads[0]!
      expect(
        await read(host, drivers, {
          Origin: siblingOrigin,
          'x-tenant-id': context.bravo.id,
        })
      ).toMatchObject({
        status: 403,
        body: { error: 'Organization access denied' },
      })
    })

    it('treats the panel origin as foreign on a tenant host', async () => {
      expect(await read(host, reads[2]!, { Origin: appOrigin })).toEqual(
        refusal
      )
    })

    it('still refuses a member without the route role', async () => {
      const drivers = { ...reads[0]!, jar: 'customer' as const }
      expect((await read(host, drivers)).status).toBe(403)
      expect(
        (await read(host, drivers, { Origin: siblingOrigin })).status
      ).toBe(403)
    })
  }
)
