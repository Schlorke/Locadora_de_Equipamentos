import { beforeAll, afterAll, describe, expect, inject, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Pool } from 'pg'
import { PrismaClient, type Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import {
  SUBSCRIPTION_ACCESS,
  SubscriptionSummarySchema,
  PlatformInvoicesResponseSchema,
  type SubscriptionStatus,
} from '@gb-locacoes/contracts/subscription'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createLoginRole } from '../helpers/database-roles'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({
  connectionString: requireTestDatabase(process.env),
  max: 1,
})
const admin = new PrismaClient({ adapter: new PrismaPg(pool) })
const suffix = randomUUID().replaceAll('-', '')
const platformRole = 'owner_read_' + suffix
let platformPool: Pool | undefined,
  platformClient: PrismaClient | undefined,
  scope: ReturnType<typeof createPlatformScope> | undefined,
  roleCreated = false
const owner = context.identity.users[1]!.id
const rows = new Map<
  SubscriptionStatus,
  { tenantId: string; subscriptionId: string; invoiceId: string }
>()
const memberIds: string[] = [],
  tenantIds: string[] = []
let planId = '',
  legacyTenant = '',
  cookie = '',
  originalFunctionOwner = ''
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[58]!,
}
const platform = <T>(
  operation: (_tx: Prisma.TransactionClient) => Promise<T>
) => scope!.withPlatformTransaction(operation)
const prefix = '/api/admin/subscription'
async function read(
  host: string,
  path = prefix,
  tenantId?: string,
  credentials = cookie,
  method = 'GET'
) {
  return fetch(host + path, {
    method,
    headers: {
      ...edge,
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...(credentials ? { Cookie: credentials } : {}),
    },
  })
}
function privateRead(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(
    response.headers
      .get('Vary')
      ?.split(',')
      .map((v) => v.trim())
  ).toEqual(expect.arrayContaining(['Cookie', 'Host']))
}
beforeAll(async () => {
  const ownership = await pool.query<{ rolname: string }>(
    "SELECT r.rolname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='public' AND p.proname='memberships_forbid_platform_staff' AND p.pronargs=0"
  )
  if (ownership.rows.length !== 1)
    throw new Error('Missing platform membership guard')
  originalFunctionOwner = ownership.rows[0]!.rolname
  const url = await createLoginRole(
    pool,
    requireTestDatabase(process.env),
    platformRole,
    'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT'
  )
  roleCreated = true
  await alterSharedAcl(
    pool,
    readFileSync('prisma/sql/roles/platform_runtime.sql', 'utf8').replaceAll(
      'platform_runtime',
      platformRole
    )
  )
  platformPool = new Pool({ connectionString: url, max: 1 })
  platformClient = new PrismaClient({ adapter: new PrismaPg(platformPool) })
  scope = createPlatformScope(platformClient)
  cookie = await signInParityUser(context, edge, 1)
  await platform(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        code: 'read-' + suffix.slice(0, 20),
        name: 'Synthetic owner read fixture',
      },
    })
    planId = plan.id
    const version = await tx.planVersion.create({
      data: {
        planId,
        version: 1,
        amount: '149.90',
        entitlements: {
          schema: 1,
          limits: { equipments: 20, staffSeats: 3 },
          features: Object.fromEntries(
            ENTITLEMENT_FEATURES.map((key) => [key, false])
          ),
        },
      },
    })
    for (const [status, access] of Object.entries(SUBSCRIPTION_ACCESS)) {
      const tenantId =
        'read-' + suffix + '-' + status.toLowerCase().replaceAll('_', '-')
      tenantIds.push(tenantId)
      await tx.organization.create({
        data: {
          id: tenantId,
          slug: tenantId,
          name: 'Synthetic owner read fixture',
          ownerUserId: owner,
          access,
        },
      })
      memberIds.push(
        (
          await tx.membership.create({
            data: { tenantId, userId: owner, role: 'ADMIN' },
          })
        ).id
      )
      const subscription = await tx.subscription.create({
        data: {
          tenantId,
          planVersionId: version.id,
          status: status as SubscriptionStatus,
          canceledAt:
            status === 'CANCELED' ? new Date('2026-10-04T12:00:00Z') : null,
          currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
        },
      })
      const invoice = await tx.platformInvoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          providerPaymentId: randomUUID(),
          amount: '149.90',
          dueDate: new Date('2026-10-04T00:00:00Z'),
          syncedAt: new Date(),
          billingType: 'PIX',
          invoiceUrl: 'https://www.asaas.com/i/synthetic-read',
        },
      })
      rows.set(status as SubscriptionStatus, {
        tenantId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      })
    }
    legacyTenant = 'read-' + suffix + '-legacy'
    tenantIds.push(legacyTenant)
    await tx.organization.create({
      data: {
        id: legacyTenant,
        slug: legacyTenant,
        name: 'Synthetic legacy read fixture',
        ownerUserId: owner,
      },
    })
    memberIds.push(
      (
        await tx.membership.create({
          data: { tenantId: legacyTenant, userId: owner, role: 'ADMIN' },
        })
      ).id
    )
  })
}, 30_000)
afterAll(async () => {
  // Immutable commercial rows remain in the owned disposable database until that database is dropped.
  try {
    if (scope)
      await platform(async (tx) => {
        await tx.organization.updateMany({
          where: { id: { in: tenantIds } },
          data: { ownerUserId: null, access: 'ARCHIVED', status: 'SUSPENDED' },
        })
        if (planId)
          await tx.plan.updateMany({
            where: { id: planId },
            data: { archivedAt: new Date() },
          })
      })
    await admin.membership.deleteMany({ where: { id: { in: memberIds } } })
  } finally {
    await platformClient?.$disconnect()
    await platformPool?.end()
    // This role was created above for this disposable database, with no DDL/ownership permissions.
    if (roleCreated) {
      // The DBA role script temporarily assigns this SECURITY DEFINER function to the fixture role.
      // Restore its prior owner before removing grants; never drop or cascade the security function.
      await alterSharedAcl(pool, [
        'ALTER FUNCTION public.memberships_forbid_platform_staff() OWNER TO "' +
          originalFunctionOwner.replaceAll('"', '""') +
          '"',
        'DROP OWNED BY "' + platformRole + '"',
        'DROP ROLE "' + platformRole + '"',
      ])
    }
    await admin.$disconnect()
    await pool.end()
  }
})
describe.each(parityTargets(context))(
  'owner subscription HTTP contract at %s',
  (host) => {
    it.each(Object.keys(SUBSCRIPTION_ACCESS) as SubscriptionStatus[])(
      'reads %s using a real session and restricted runtime role',
      async (status) => {
        const fixture = rows.get(status)!
        const response = await read(host, prefix, fixture.tenantId)
        privateRead(response, 200)
        const result = SubscriptionSummarySchema.parse(await response.json())
        expect(result).toMatchObject({
          status,
          access: SUBSCRIPTION_ACCESS[status],
          plan: { amount: '149.90' },
          currentPeriodStart: '2026-10-01',
          currentPeriodEnd: '2026-11-01',
          usage: { equipments: 0, staffSeats: 1 },
        })
        const invoices = await read(
          host,
          prefix + '/invoices',
          fixture.tenantId
        )
        privateRead(invoices, 200)
        expect(
          PlatformInvoicesResponseSchema.parse(
            await invoices.json()
          ).invoices.map((i) => i.id)
        ).toEqual([fixture.invoiceId])
      }
    )
    it.each([prefix, prefix + '/invoices'])(
      'requires a real authenticated identity for %s',
      async (path) => {
        const response = await read(
          host,
          path,
          rows.get('ACTIVE')!.tenantId,
          ''
        )
        privateRead(response, 401)
      }
    )
    it('requires explicit tenant selection and does not infer one from ownership', async () => {
      privateRead(await read(host), 409)
    })
    it('refuses another company membership despite a global ADMIN account', async () => {
      const response = await read(host, prefix, context.bravo.id)
      privateRead(response, 403)
      expect(await response.json()).toMatchObject({ code: 'OWNER_REQUIRED' })
    })
    it('does not invent a subscription for an owned legacy organization', async () => {
      const response = await read(host, prefix, legacyTenant)
      privateRead(response, 404)
      expect(await response.json()).toMatchObject({
        code: 'SUBSCRIPTION_NOT_FOUND',
      })
      const invoices = await read(host, prefix + '/invoices', legacyTenant)
      privateRead(invoices, 200)
      expect(await invoices.json()).toEqual({ invoices: [] })
    })
    it('exposes only GET/HEAD, preserving the absence of billing mutation endpoints', async () => {
      expect(
        (await read(host, prefix, rows.get('ACTIVE')!.tenantId, cookie, 'POST'))
          .status
      ).toBe(405)
    })
  }
)
