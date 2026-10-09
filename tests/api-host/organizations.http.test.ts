import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { platformRateLimitDigest } from '../../packages/backend/src/modules/directory/rate-limit'

import { sessionCookies as cookies, signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { namedParityTargets, parityTargets } from './targets'

const context = inject('apiParity')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[63]!,
}
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const jars: string[] = []
let loginStartedAt = 0
// Next 16 adds its RSC negotiation fields to the adapter's Vary: Cookie.
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const vary = `${frameworkVary}, Cookie`
const plainHeaders = { cache: null, vary: frameworkVary }
/** Headers of a guarded administrative read: the principal's private refusal, or the route's own reply. */
function guardedHeaders(body: unknown, own = plainHeaders) {
  const error = (body as { error?: string } | null)?.error
  if (error === 'Locadora não encontrada' || error === 'Origem não permitida')
    return { cache: 'no-store', vary: frameworkVary }
  return own
}
type Read = { status: number; body: string }
type BodyCheck = (body: never) => void
/**
 * Every host of the run against the explicit expected reply (wave 135, B2): exact status and headers, and the body
 * itself or a `check` that runs on each host's body. No host is the oracle of another. Returns the last host's reply
 * (the API).
 */
async function eachHost<T extends Read>(
  read: (origin: string) => Promise<T>,
  status: number,
  headers: Omit<T, 'status' | 'body'>,
  body?: unknown
): Promise<T> {
  let last: T | undefined
  for (const origin of parityTargets(context)) {
    const result = await read(origin)
    const { body: text, ...rest } = result
    expect(rest).toEqual({ status, ...headers })
    let parsed: unknown = text
    try {
      parsed = text === '' ? '' : JSON.parse(text)
    } catch {
      /* A framework body that is not JSON stays text and is compared as such. */
    }
    if (typeof body === 'function')
      (body as BodyCheck as unknown as (value: unknown) => void)(parsed)
    else if (body !== undefined) expect(parsed).toEqual(body)
    last = result
  }
  return last!
}

beforeAll(async () => {
  loginStartedAt = Date.now()
  for (let index = 0; index < context.identity.users.length; index++)
    jars.push(await signInParityUser(context, edge, index, { fresh: true }))
})
afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})

/** Headers of an OPTIONS/405 framework reply (no handler of ours runs). */
const frameworkMethodHeaders = {
  cache: null,
  vary: frameworkVary,
  cookie: null,
}
/**
 * OPTIONS of a route on each host: 204, empty body, the exact Allow (sorted) and the framework headers; the methods
 * the route does not export are 405 (wave 135, B2).
 */
async function methodContract<T extends Read & { allow: string | null }>(
  read: (origin: string, method: string) => Promise<T>,
  allow: string[],
  headers: Omit<T, 'status' | 'body' | 'allow'>,
  unsupported: string[]
) {
  for (const origin of parityTargets(context)) {
    const { allow: header, ...rest } = await read(origin, 'OPTIONS')
    expect({ ...rest, allow: header?.split(/,\s*/).sort() }).toEqual({
      status: 204,
      body: '',
      ...headers,
      allow,
    })
    for (const method of unsupported)
      expect((await read(origin, method)).status).toBe(405)
  }
}
/** Run suffix of the global fixture (`api-alfa-<run>`), used by its generated slugs. */
const run = context.alfa.id.slice('api-alfa-'.length)
const tenantName = (tenant: 'alfa' | 'bravo') => tenant
/** A fixture category row as the administrative routes serialize it (global-setup.ts). */
function categoryRow(tenant: 'alfa' | 'bravo') {
  return {
    id: context[tenant].categoryId,
    tenantId: context[tenant].id,
    name: tenant === 'alfa' ? 'Andaimes' : 'Betoneiras',
    description: null,
    icon: null,
    iconColor: '#ea580c',
    bgColor: '#fff7ed',
    fontColor: '#7c2d12',
    slug: `cat-${tenantName(tenant)}-${run}`,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
    placement: null,
    customIcon: null,
  }
}
/** A fixture equipment row with the private administrative fields (global-setup.ts). */
function equipmentRow(tenant: 'alfa' | 'bravo', index: number) {
  const ids = context[tenant].equipmentIds
  const last = index === ids.length - 1
  const name = tenantName(tenant)
  return {
    id: ids[index]!,
    tenantId: context[tenant].id,
    name: last
      ? `Andaime exclusivo ${name}`
      : `Betoneira ${name} ${String(index).padStart(2, '0')}`,
    description: last ? `guindaste na descrição ${name}` : `Concreto ${name}`,
    pricePerDay: 12.5,
    images: index === 0 ? [`https://assets.example.test/${name}.jpg`] : [],
    available: index !== 10,
    isAvailable: index !== 10,
    categoryId: context[tenant].categoryId,
    createdAt: new Date(Date.UTC(2030, 0, 1, 0, 0, index)).toISOString(),
    updatedAt: expect.any(String),
    biweeklyDiscount: 0,
    dailyDiscount: 0,
    maxStock: index === 0 ? 3 : index === 2 ? 0 : 1,
    monthlyDiscount: 0,
    popularPeriod: 'weekly',
    weeklyDiscount: 0,
    specifications: { internal: 'fixture-private' },
    biweeklyDirectValue: null,
    biweeklyUseDirectValue: false,
    dailyDirectValue: '17.25',
    dailyUseDirectValue: true,
    monthlyDirectValue: null,
    monthlyUseDirectValue: false,
    weeklyDirectValue: null,
    weeklyUseDirectValue: false,
    dailyRentalEnabled: true,
    weeklyRentalEnabled: true,
    biweeklyRentalEnabled: true,
    monthlyRentalEnabled: true,
    depreciationRate: null,
    hourMeter: null,
    odometer: null,
    purchaseDate: null,
    purchasePrice: '99999',
    partsLossHistory: { internal: 'fixture-private' },
    partsLossCount: 0,
    category: categoryRow(tenant),
  }
}
/** A physical unit of the fixture with its equipment projection (global-setup.ts). */
function unitRow(tenant: 'alfa' | 'bravo', index: number) {
  const alfa = tenant === 'alfa'
  const equipment = alfa ? (index < 2 ? 0 : 1) : 0
  return {
    id: context.units[tenant][index]!,
    tenantId: context[tenant].id,
    equipmentId: context[tenant].equipmentIds[equipment]!,
    uniqueCode: alfa
      ? `UNIT-0${[2, 1, 3, 5, 4][index]}`
      : index
        ? 'UNIT-06'
        : 'UNIT-01',
    status: alfa
      ? ['AVAILABLE', 'RENTED', 'RESERVED', 'MAINTENANCE', 'RETIRED'][index]
      : ['RENTED', 'AVAILABLE'][index],
    hourMeter: alfa
      ? index === 0
        ? '12.345'
        : index === 2
          ? '0'
          : null
      : null,
    odometer: alfa ? (index === 0 ? '987.65' : index === 2 ? '0' : null) : null,
    serialNumber: alfa
      ? (['Serial-Alfa', 'Case-Marker', 'Unique-Serial'][index] ?? null)
      : index
        ? null
        : 'Case-Marker',
    notes: alfa
      ? index === 0
        ? 'Private unit note'
        : null
      : 'Foreign unit private note',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    equipment: {
      id: context[tenant].equipmentIds[equipment]!,
      name: `Betoneira ${tenant} ${String(equipment).padStart(2, '0')}`,
      category: { name: alfa ? 'Andaimes' : 'Betoneiras' },
    },
  }
}
/** A customer address of the fixture (global-setup.ts). */
function addressRow(
  id: string,
  tenantId: string,
  userId: string,
  isPrimary: boolean,
  createdAt: string
) {
  return {
    id,
    tenantId,
    userId,
    street: 'Fixture private street',
    number: '1',
    complement: null,
    neighborhood: 'Fixture neighborhood',
    city: 'Fixture city',
    state: 'SP',
    zipCode: '01001000',
    isPrimary,
    createdAt,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
const alfaAddresses = () => ({
  addresses: [0, 2, 1].map((index) =>
    addressRow(
      context.addresses.alfa[index]!,
      context.alfa.id,
      context.identity.users[0]!.id,
      index === 0,
      new Date(Date.UTC(2026, 0, index + 1)).toISOString()
    )
  ),
})
/** A permission row of the fixture or of a test (createdAt/updatedAt from the database unless given). */
function permissionRow(
  id: string,
  tenantId: string,
  role: string,
  module: string,
  action: string,
  date?: Date
) {
  return {
    id,
    tenantId,
    role,
    module,
    action,
    createdAt: date ? date.toISOString() : expect.any(String),
    updatedAt: date ? date.toISOString() : expect.any(String),
  }
}
async function readPermissionRows(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  query = '',
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/admin/permissions${query}`, {
    method,
    headers: { Cookie: jar, ...headers },
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
    type: response.headers.get('content-type'),
  }
}
function permissionHeaders(status: number, body: unknown) {
  return {
    ...guardedHeaders(body),
    cookie: null,
    allow: null,
    type:
      status === 500
        ? null
        : status === 200 || body
          ? 'application/json'
          : null,
  }
}
async function permissionRowsParity(
  jar: string,
  headers: Record<string, string>,
  status: number,
  body?: unknown,
  query = ''
) {
  return eachHost(
    (origin) => readPermissionRows(origin, jar, headers, query),
    status,
    permissionHeaders(status, typeof body === 'function' ? {} : body),
    body
  )
}

describe(`${context.identity.mode} — administrative permission rows parity`, () => {
  const own = { 'x-tenant-id': context.alfa.id }
  const foreign = { 'x-tenant-id': context.bravo.id }
  it.each([
    '',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])('requires a real live session: %s', async (jar) => {
    await permissionRowsParity(jar, own, 401, {
      error: 'Authentication required',
    })
  })
  it('does not choose a tenant from query parameters', async () => {
    await permissionRowsParity(
      jars[0]!,
      {},
      409,
      { error: 'Select an organization' },
      `?tenantId=${context.alfa.id}&userId=${context.identity.users[1]!.id}&role=ADMIN`
    )
  })
  it('does not grant tenant administration through the global account ADMIN role', async () => {
    await permissionRowsParity(jars[1]!, own, 403, {
      error: 'Organization access denied',
    })
  })
  it.each(['CLIENT', 'FINANCIAL', 'OPERATOR'] as const)(
    'refuses %s despite its stored grant and a spoofed ADMIN query',
    async (role) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { role } })
        await permissionRowsParity(
          jars[0]!,
          own,
          403,
          { error: 'Não autorizado' },
          '?role=ADMIN'
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'CLIENT' },
        })
      }
    }
  )
  it('keeps the full permission DTO and enum/module/action ordering under tenant RLS', async () => {
    const ids = Array.from({ length: 4 }, () => randomUUID())
    const date = new Date('2026-01-01T00:00:00.000Z')
    try {
      await prisma.permission.createMany({
        data: [
          {
            id: ids[0]!,
            role: 'ADMIN' as const,
            module: 'USERS',
            action: 'MANAGE',
          },
          {
            id: ids[1]!,
            role: 'FINANCIAL' as const,
            module: 'EQUIPMENTS',
            action: 'DELETE',
          },
          {
            id: ids[2]!,
            role: 'FINANCIAL' as const,
            module: 'EQUIPMENTS',
            action: 'MANAGE',
          },
          {
            id: ids[3]!,
            role: 'FINANCIAL' as const,
            module: 'USERS',
            action: 'READ',
          },
        ].map((row) => ({
          ...row,
          tenantId: context.alfa.id,
          createdAt: date,
          updatedAt: date,
        })),
      })
      // Full list in role/module/action order, built from the fixture and the four rows above (wave 135, B2).
      const alfa = context.alfa.id
      const expectedRows = {
        permissions: [
          permissionRow(ids[0]!, alfa, 'ADMIN', 'USERS', 'MANAGE', date),
          permissionRow(
            ids[1]!,
            alfa,
            'FINANCIAL',
            'EQUIPMENTS',
            'DELETE',
            date
          ),
          permissionRow(
            ids[2]!,
            alfa,
            'FINANCIAL',
            'EQUIPMENTS',
            'MANAGE',
            date
          ),
          permissionRow(
            context.permissions.wrongAction,
            alfa,
            'FINANCIAL',
            'EQUIPMENTS',
            'WRITE'
          ),
          permissionRow(
            context.permissions.wrongModule,
            alfa,
            'FINANCIAL',
            'FINANCIAL',
            'READ'
          ),
          permissionRow(ids[3]!, alfa, 'FINANCIAL', 'USERS', 'READ', date),
          permissionRow(
            context.permissions.alfaOperator,
            alfa,
            'OPERATOR',
            'EQUIPMENTS',
            'READ'
          ),
          permissionRow(
            context.permissions.alfaClient,
            alfa,
            'CLIENT',
            'EQUIPMENTS',
            'READ'
          ),
        ],
      }
      await asTenantAdmin(async () => {
        await permissionRowsParity(jars[0]!, own, 200, expectedRows)
        // Query overrides change nothing: the same explicit list.
        await permissionRowsParity(
          jars[0]!,
          own,
          200,
          expectedRows,
          `?tenantId=${context.bravo.id}&userId=foreign&role=CLIENT&module=USERS&action=DELETE&limit=1&orderBy=createdAt`
        )
      })
    } finally {
      await prisma.permission.deleteMany({ where: { id: { in: ids } } })
    }
  })
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'keeps %s selection with the same authenticated ADMIN membership',
    async (transport) => {
      await asTenantAdmin(async () => {
        const headers =
          transport === 'cookie'
            ? {}
            : transport === 'header'
              ? foreign
              : transport === 'host'
                ? tenantEdge(context.bravo.slug)
                : { ...tenantEdge(context.bravo.slug), ...foreign }
        const jar =
          transport === 'cookie' || transport === 'matching'
            ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
            : jars[0]!
        await permissionRowsParity(jar, headers, 200, {
          permissions: [
            permissionRow(
              context.permissions.bravoFinancial,
              context.bravo.id,
              'FINANCIAL',
              'EQUIPMENTS',
              'READ'
            ),
          ],
        })
      })
    }
  )
  it('returns an empty list for the existing empty tenant ADMIN', async () => {
    const id = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await permissionRowsParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        200,
        { permissions: [] }
      )
    } finally {
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
    }
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks a %s membership after login',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({
          where: { id },
          data: { role: 'ADMIN', status },
        })
        await permissionRowsParity(jars[0]!, own, 403, {
          error: 'Organization access denied',
        })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'CLIENT', status: 'ACTIVE' },
        })
      }
    }
  )
  it('rechecks an organization suspended after login', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'SUSPENDED' },
        })
      )
      await permissionRowsParity(jars[0]!, own, 403, {
        error: 'Organization access denied',
      })
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it.each(['header-cookie', 'host-header', 'host-cookie'] as const)(
    'refuses a %s tenant conflict',
    async (kind) => {
      const jar =
        kind === 'host-header'
          ? jars[0]!
          : `${jars[0]}; selected-tenant-id=${context.alfa.id}`
      const headers =
        kind === 'header-cookie'
          ? foreign
          : kind === 'host-header'
            ? { ...tenantEdge(context.bravo.slug), ...own }
            : tenantEdge(context.bravo.slug)
      await permissionRowsParity(jar, headers, 400, {
        error: 'Conflicting tenant selection',
      })
    }
  )
  it.each(['unknown-locadora', context.suspended])(
    'keeps the neutral 404 for unknown/suspended host %s before identity',
    async (slug) => {
      await permissionRowsParity('', tenantEdge(slug), 404, {
        error: 'Locadora não encontrada',
      })
    }
  )
  it('preserves the framework 500 on a real SELECT failure, while non-ADMIN still refuses before SELECT', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON permissions FROM ${role}`)
      await permissionRowsParity(jars[0]!, foreign, 403, {
        error: 'Não autorizado',
      })
      await asTenantAdmin(async () => {
        const result = await permissionRowsParity(
          jars[0]!,
          own,
          500,
          (body: unknown) => {
            expect(body).toBe('')
            expect(JSON.stringify(body)).not.toContain('permission')
            expect(JSON.stringify(body)).not.toContain(context.alfa.id)
          }
        )
        expect(result.body).not.toContain('permissions')
        expect(result.body).not.toContain('permission denied')
        expect(result.body).not.toContain(context.alfa.id)
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON permissions TO ${role}`)
    }
  })
  it('keeps HEAD/OPTIONS and the guarded PUT in both hosts', async () => {
    await asTenantAdmin(async () => {
      await eachHost(
        (origin) => readPermissionRows(origin, jars[0]!, own, '', 'HEAD'),
        200,
        permissionHeaders(200, {}),
        ''
      )
    })
    await methodContract(
      (origin, method) =>
        readPermissionRows(
          origin,
          method === 'OPTIONS' ? '' : jars[0]!,
          method === 'OPTIONS' ? {} : own,
          '',
          method
        ),
      ['GET', 'HEAD', 'OPTIONS', 'PUT'],
      { ...frameworkMethodHeaders, type: null },
      ['POST', 'PATCH', 'DELETE']
    )
    const unauthenticated = { error: 'Authentication required' }
    await eachHost(
      (origin) => readPermissionRows(origin, '', {}, '', 'PUT'),
      401,
      permissionHeaders(401, unauthenticated),
      unauthenticated
    )
  })
})

type EquipmentDetailRequest = { id: string; query?: string; method?: string }
async function readAdminEquipment(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  input: EquipmentDetailRequest
) {
  const response = await fetch(
    `${origin}/api/admin/equipments/${encodeURIComponent(input.id)}${input.query ?? ''}`,
    {
      method: input.method ?? 'GET',
      headers: { Cookie: jar, ...headers },
    }
  )
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function adminEquipmentParity(
  jar: string,
  headers: Record<string, string>,
  input: EquipmentDetailRequest,
  status: number,
  body: unknown
) {
  return eachHost(
    (origin) => readAdminEquipment(origin, jar, headers, input),
    status,
    {
      ...guardedHeaders(typeof body === 'function' ? {} : body),
      cookie: null,
      allow: null,
    },
    body
  )
}

describe(`${context.identity.mode} — administrative equipment detail`, () => {
  const a = { 'x-tenant-id': context.alfa.id }
  const b = { 'x-tenant-id': context.bravo.id }
  const own = { id: context.alfa.equipmentIds[0]! }
  const foreign = { id: context.bravo.equipmentIds[0]! }
  it('preserves the full administrative DTO, numeric price, textual decimals and count mapping', async () => {
    await asTenantAdmin(async () => {
      // Full administrative DTO built from the fixture (wave 135, B2); overrides in the query change nothing.
      const dto = {
        ...equipmentRow('alfa', 0),
        _count: { quoteItems: 2, reviews: 0 },
      }
      await adminEquipmentParity(jars[0]!, a, own, 200, dto)
      const query = `?id=${foreign.id}&tenantId=${context.bravo.id}&role=CLIENT&fields=name&include=units`
      await adminEquipmentParity(jars[0]!, a, { ...own, query }, 200, dto)
    })
  })
  it('maps unavailable equipment to false without hiding it from an authorized member', async () => {
    await asTenantAdmin(async () => {
      await adminEquipmentParity(
        jars[0]!,
        a,
        { id: context.alfa.equipmentIds[10]! },
        200,
        { ...equipmentRow('alfa', 10), _count: { quoteItems: 0, reviews: 0 } }
      )
    })
  })
  it.each(['foreign', 'unassigned', 'missing', 'encoded'] as const)(
    '%s ID keeps the same neutral 404 after authorization',
    async (kind) => {
      await asTenantAdmin(async () => {
        const id =
          kind === 'foreign'
            ? foreign.id
            : kind === 'unassigned'
              ? context.unassignedEquipment
              : kind === 'missing'
                ? randomUUID()
                : 'literal %_ equipment'
        if (kind === 'unassigned')
          expect(
            (await prisma.equipment.findUniqueOrThrow({ where: { id } }))
              .tenantId
          ).toBeNull()
        await adminEquipmentParity(jars[0]!, a, { id }, 404, {
          error: 'Equipamento não encontrado',
        })
      })
    }
  )
  it.each([
    'anonymous',
    'unselected',
    'client-with-grant',
    'operator-without-grant',
    'foreign-membership',
  ] as const)('refuses %s before revealing equipment', async (kind) => {
    const jar =
      kind === 'anonymous'
        ? ''
        : kind === 'operator-without-grant' || kind === 'foreign-membership'
          ? jars[1]!
          : jars[0]!
    const headers =
      kind === 'unselected' ? {} : kind === 'operator-without-grant' ? b : a
    const status =
      kind === 'anonymous' ? 401 : kind === 'unselected' ? 409 : 403
    const error =
      kind === 'anonymous'
        ? 'Authentication required'
        : kind === 'unselected'
          ? 'Select an organization'
          : kind === 'client-with-grant'
            ? 'Acesso administrativo não permitido'
            : kind === 'operator-without-grant'
              ? 'Permissão insuficiente nesta locadora'
              : 'Organization access denied'
    await adminEquipmentParity(jar, headers, own, status, { error })
  })
  it('FINANCIAL grant exposes only the selected tenant detail', async () => {
    await adminEquipmentParity(jars[0]!, b, foreign, 200, {
      ...equipmentRow('bravo', 0),
      _count: { quoteItems: 1, reviews: 0 },
    })
    await adminEquipmentParity(jars[0]!, b, own, 404, {
      error: 'Equipamento não encontrado',
    })
  })
  it('revalidates OPERATOR grant after login', async () => {
    const id = context.identity.memberships[0]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { role: 'OPERATOR' },
      })
      await adminEquipmentParity(jars[0]!, a, own, 200, {
        ...equipmentRow('alfa', 0),
        _count: { quoteItems: 2, reviews: 0 },
      })
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'MANAGE' },
      })
      await adminEquipmentParity(jars[0]!, a, own, 403, {
        error: 'Permissão insuficiente nesta locadora',
      })
    } finally {
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'READ' },
      })
      await prisma.membership.update({
        where: { id },
        data: { role: 'CLIENT' },
      })
    }
  })
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'keeps %s tenant selection on the same authenticated detail',
    async (transport) => {
      const jar =
        transport === 'cookie' || transport === 'matching'
          ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
          : jars[0]!
      const headers =
        transport === 'cookie'
          ? {}
          : transport === 'header'
            ? b
            : transport === 'host'
              ? tenantEdge(context.bravo.slug)
              : { ...tenantEdge(context.bravo.slug), ...b }
      await adminEquipmentParity(jar, headers, foreign, 200, {
        ...equipmentRow('bravo', 0),
        _count: { quoteItems: 1, reviews: 0 },
      })
      await adminEquipmentParity(jar, headers, own, 404, {
        error: 'Equipamento não encontrado',
      })
    }
  )
  it.each(['header-cookie', 'host-header', 'host-cookie'] as const)(
    'refuses a %s conflict',
    async (kind) => {
      const jar =
        kind === 'host-header'
          ? jars[0]!
          : `${jars[0]}; selected-tenant-id=${context.alfa.id}`
      const headers =
        kind === 'header-cookie'
          ? b
          : kind === 'host-header'
            ? { ...tenantEdge(context.bravo.slug), ...a }
            : tenantEdge(context.bravo.slug)
      await adminEquipmentParity(jar, headers, foreign, 400, {
        error: 'Conflicting tenant selection',
      })
    }
  )
  it('refuses malformed selection and ignores a forged edge', async () => {
    await adminEquipmentParity(
      `${jars[0]}; selected-tenant-id=%`,
      {},
      own,
      400,
      { error: 'Invalid tenant selection' }
    )
    await adminEquipmentParity(
      jars[0]!,
      {
        ...tenantEdge(context.bravo.slug),
        'x-platform-edge-auth': 'fixture-forged-secret',
      },
      foreign,
      409,
      { error: 'Select an organization' }
    )
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'revalidates %s membership after login',
    async (status) => {
      const id = context.identity.memberships[1]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await adminEquipmentParity(jars[0]!, b, foreign, 403, {
          error: 'Organization access denied',
        })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('keeps neutral suspended-host response and explicit suspended-tenant denial', async () => {
    await adminEquipmentParity(
      jars[0]!,
      tenantEdge(context.suspended),
      own,
      404,
      { error: 'Locadora não encontrada' }
    )
    await adminEquipmentParity(
      jars[0]!,
      { 'x-tenant-id': context.suspended },
      own,
      403,
      { error: 'Organization access denied' }
    )
  })
  it('authorized empty tenant cannot read another tenant equipment', async () => {
    const id = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await adminEquipmentParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        own,
        404,
        { error: 'Equipamento não encontrado' }
      )
    } finally {
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
    }
  })
  it('equipment RLS hides foreign and unassigned rows and clears context on rollback', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      expect(
        (await connection.query('SELECT id FROM equipments')).rows
      ).toEqual([])
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      expect(
        (await connection.query('SELECT id FROM equipments')).rows
          .map((row) => row.id)
          .sort()
      ).toEqual([...context.alfa.equipmentIds].sort())
      expect(
        (
          await connection.query(
            'SELECT id FROM equipments WHERE "tenantId"=$1 OR id=$2',
            [context.bravo.id, context.unassignedEquipment]
          )
        ).rows
      ).toEqual([])
      expect(
        (
          await connection.query(
            'SELECT count(*)::int AS count FROM quote_items'
          )
        ).rows
      ).toEqual([{ count: 2 }])
      expect(
        (
          await connection.query(
            'SELECT id FROM quote_items WHERE "tenantId"=$1',
            [context.bravo.id]
          )
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect(
        (await connection.query('SELECT id FROM equipments')).rows
      ).toEqual([])
    } finally {
      connection.release()
      await scoped.end()
    }
  })
  it('keeps the original generic 500 on actual equipment SELECT failure', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON equipments FROM ${role}`)
      await adminEquipmentParity(jars[0]!, b, foreign, 500, {
        error: 'Erro interno do servidor',
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON equipments TO ${role}`)
    }
  })
  it('keeps the original generic 500 when the count table cannot be read', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON quote_items FROM ${role}`)
      await adminEquipmentParity(jars[0]!, b, foreign, 500, {
        error: 'Erro interno do servidor',
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON quote_items TO ${role}`)
    }
  })
  it('keeps HEAD/OPTIONS parity with equipment PUT/DELETE in the service', async () => {
    await eachHost(
      (origin) =>
        readAdminEquipment(origin, jars[0]!, b, { ...foreign, method: 'HEAD' }),
      200,
      { ...plainHeaders, cookie: null, allow: null },
      ''
    )
    await methodContract(
      (origin, method) =>
        readAdminEquipment(
          origin,
          method === 'OPTIONS' ? '' : jars[0]!,
          method === 'OPTIONS' ? {} : b,
          { ...foreign, method }
        ),
      ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PUT'],
      frameworkMethodHeaders,
      ['POST', 'PATCH']
    )
  })
})

type UnitRequest = { id?: string; query?: string; method?: string }
async function readUnits(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  input: UnitRequest = {}
) {
  const response = await fetch(
    `${origin}/api/admin/equipment-units${input.id ? `/${encodeURIComponent(input.id)}` : ''}${input.query ?? ''}`,
    {
      method: input.method ?? 'GET',
      headers: { Cookie: jar, ...headers },
    }
  )
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function unitParity(
  jar: string,
  headers: Record<string, string>,
  input: UnitRequest,
  status: number,
  body: unknown
) {
  return eachHost(
    (origin) => readUnits(origin, jar, headers, input),
    status,
    {
      ...guardedHeaders(typeof body === 'function' ? {} : body),
      cookie: null,
      allow: null,
    },
    body
  )
}

describe(`${context.identity.mode} — physical unit reads`, () => {
  const a = { 'x-tenant-id': context.alfa.id }
  const b = { 'x-tenant-id': context.bravo.id }
  const sorted = [
    context.units.alfa[1],
    context.units.alfa[0],
    context.units.alfa[2],
    context.units.alfa[4],
    context.units.alfa[3],
  ]
  it('preserves ordering, full nested DTO, decimal strings, null and zero meters', async () => {
    await asTenantAdmin(async () => {
      // Full nested DTOs in uniqueCode order, built from the fixture (wave 135, B2).
      await unitParity(
        jars[0]!,
        a,
        {},
        200,
        [1, 0, 2, 4, 3].map((index) => unitRow('alfa', index))
      )
      expect(sorted).toEqual(
        [1, 0, 2, 4, 3].map((index) => context.units.alfa[index])
      )
      await unitParity(
        jars[0]!,
        a,
        {
          id: context.units.alfa[0]!,
          query: `?id=${context.units.bravo[0]}&tenantId=${context.bravo.id}&role=CLIENT`,
        },
        200,
        unitRow('alfa', 0)
      )
    })
  })
  it.each([
    [
      'equipment A0',
      `?equipmentId=${context.alfa.equipmentIds[0]}`,
      [context.units.alfa[1], context.units.alfa[0]],
    ],
    [
      'equipment A1',
      `?equipmentId=${context.alfa.equipmentIds[1]}`,
      [context.units.alfa[2], context.units.alfa[4], context.units.alfa[3]],
    ],
    ['foreign equipment', `?equipmentId=${context.bravo.equipmentIds[0]}`, []],
    ['available', '?status=AVAILABLE', [context.units.alfa[0]]],
    ['rented', '?status=RENTED', [context.units.alfa[1]]],
    ['reserved', '?status=RESERVED', [context.units.alfa[2]]],
    ['maintenance', '?status=MAINTENANCE', [context.units.alfa[3]]],
    ['retired', '?status=RETIRED', [context.units.alfa[4]]],
    ['code, insensitive', '?search=uNiT-02', [context.units.alfa[0]]],
    [
      'serial, insensitive and foreign duplicate',
      '?search=cAsE-mArKeR',
      [context.units.alfa[1]],
    ],
    [
      'conjunction',
      `?equipmentId=${context.alfa.equipmentIds[0]}&status=RENTED&search=Case`,
      [context.units.alfa[1]],
    ],
    ['no match', '?search=not-found', []],
    ['empty filters', '?equipmentId=&status=&search=', sorted],
    [
      'first duplicate',
      '?status=AVAILABLE&status=RENTED',
      [context.units.alfa[0]],
    ],
    ['percent wildcard', '?search=%25', sorted],
    ['underscore wildcard', '?search=_', sorted],
    ['literal plus', '?search=%2B', []],
  ] as const)('preserves %s filtering', async (_name, query, ids) => {
    await asTenantAdmin(async () => {
      await unitParity(jars[0]!, a, { query }, 200, (rows: { id: string }[]) =>
        expect(rows).toEqual(
          ids.map((id) =>
            unitRow('alfa', context.units.alfa.indexOf(id as string))
          )
        )
      )
    })
  })
  it('preserves generic 500 for a status outside the enum', async () => {
    await unitParity(jars[0]!, b, { query: '?status=invalid' }, 500, {
      error: 'Erro ao buscar unidades',
    })
  })
  it.each(['list', 'detail'] as const)(
    '%s denies identity, selection and unauthorized roles before data',
    async (kind) => {
      const input = kind === 'detail' ? { id: context.units.alfa[0]! } : {}
      await unitParity('', a, input, 401, { error: 'Authentication required' })
      await unitParity(jars[0]!, {}, input, 409, {
        error: 'Select an organization',
      })
      await unitParity(jars[0]!, a, input, 403, {
        error: 'Acesso administrativo não permitido',
      })
      await unitParity(jars[1]!, b, input, 403, {
        error: 'Permissão insuficiente nesta locadora',
      })
      await unitParity(jars[1]!, a, input, 403, {
        error: 'Organization access denied',
      })
    }
  )
  it('valid FINANCIAL grant permits only the selected tenant data', async () => {
    await unitParity(jars[0]!, b, {}, 200, [
      unitRow('bravo', 0),
      unitRow('bravo', 1),
    ])
    await unitParity(
      jars[0]!,
      b,
      { id: context.units.bravo[0]! },
      200,
      unitRow('bravo', 0)
    )
    await unitParity(jars[0]!, b, { id: context.units.alfa[0]! }, 404, {
      error: 'Unidade não encontrada',
    })
  })
  it('OPERATOR grant is revalidated for both reads after login', async () => {
    const id = context.identity.memberships[0]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { role: 'OPERATOR' },
      })
      await unitParity(
        jars[0]!,
        a,
        {},
        200,
        [1, 0, 2, 4, 3].map((index) => unitRow('alfa', index))
      )
      await unitParity(
        jars[0]!,
        a,
        { id: context.units.alfa[0]! },
        200,
        unitRow('alfa', 0)
      )
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'MANAGE' },
      })
      await unitParity(jars[0]!, a, {}, 403, {
        error: 'Permissão insuficiente nesta locadora',
      })
      await unitParity(jars[0]!, a, { id: context.units.alfa[0]! }, 403, {
        error: 'Permissão insuficiente nesta locadora',
      })
    } finally {
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'READ' },
      })
      await prisma.membership.update({
        where: { id },
        data: { role: 'CLIENT' },
      })
    }
  })
  it('foreign, missing and unassigned unit IDs have the same neutral detail response', async () => {
    await asTenantAdmin(async () => {
      // The same explicit neutral 404 for every kind of foreign or missing ID, on each host.
      for (const id of [
        context.units.bravo[0]!,
        context.units.unassigned,
        randomUUID(),
        'literal %_ unit',
      ])
        await unitParity(jars[0]!, a, { id }, 404, {
          error: 'Unidade não encontrada',
        })
    })
  })
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'validates %s transport without changing the DTO',
    async (transport) => {
      const jar =
        transport === 'cookie' || transport === 'matching'
          ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
          : jars[0]!
      const headers =
        transport === 'cookie'
          ? {}
          : transport === 'header'
            ? b
            : transport === 'host'
              ? tenantEdge(context.bravo.slug)
              : { ...tenantEdge(context.bravo.slug), ...b }
      await unitParity(jar, headers, {}, 200, [
        unitRow('bravo', 0),
        unitRow('bravo', 1),
      ])
      await unitParity(
        jar,
        headers,
        { id: context.units.bravo[0]! },
        200,
        unitRow('bravo', 0)
      )
    }
  )
  it('ignores tenant/role/ordering query overrides for list and detail', async () => {
    const query = `?tenantId=${context.alfa.id}&userId=foreign&role=CLIENT&module=FINANCIAL&action=WRITE&orderBy=createdAt&limit=1`
    const list = [unitRow('bravo', 0), unitRow('bravo', 1)]
    await unitParity(jars[0]!, b, {}, 200, list)
    await unitParity(jars[0]!, b, { query }, 200, list)
    await unitParity(
      jars[0]!,
      b,
      { id: context.units.bravo[0]! },
      200,
      unitRow('bravo', 0)
    )
    await unitParity(
      jars[0]!,
      b,
      { id: context.units.bravo[0]!, query },
      200,
      unitRow('bravo', 0)
    )
  })
  it.each(['list', 'detail'] as const)(
    '%s refuses conflicting, malformed and forged context',
    async (kind) => {
      const input = kind === 'detail' ? { id: context.units.bravo[0]! } : {}
      for (const [jar, headers] of [
        [`${jars[0]}; selected-tenant-id=${context.alfa.id}`, b],
        [jars[0]!, { ...tenantEdge(context.bravo.slug), ...a }],
        [
          `${jars[0]}; selected-tenant-id=${context.alfa.id}`,
          tenantEdge(context.bravo.slug),
        ],
      ] as const)
        await unitParity(jar, headers, input, 400, {
          error: 'Conflicting tenant selection',
        })
      await unitParity(`${jars[0]}; selected-tenant-id=%`, {}, input, 400, {
        error: 'Invalid tenant selection',
      })
      await unitParity(
        jars[0]!,
        {
          ...tenantEdge(context.bravo.slug),
          'x-platform-edge-auth': 'fixture-forged-secret',
        },
        input,
        409,
        { error: 'Select an organization' }
      )
    }
  )
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks %s membership for both reads',
    async (status) => {
      const id = context.identity.memberships[1]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await unitParity(jars[0]!, b, {}, 403, {
          error: 'Organization access denied',
        })
        await unitParity(jars[0]!, b, { id: context.units.bravo[0]! }, 403, {
          error: 'Organization access denied',
        })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('keeps suspended-host neutrality and authorized empty-tenant behavior', async () => {
    const id = context.identity.memberships[3]!
    for (const input of [{}, { id: context.units.alfa[0]! }]) {
      await unitParity(jars[0]!, tenantEdge(context.suspended), input, 404, {
        error: 'Locadora não encontrada',
      })
      await unitParity(
        jars[0]!,
        { 'x-tenant-id': context.suspended },
        input,
        403,
        { error: 'Organization access denied' }
      )
    }
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await unitParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        {},
        200,
        []
      )
      await unitParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        { id: context.units.alfa[0]! },
        404,
        { error: 'Unidade não encontrada' }
      )
    } finally {
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
    }
  })
  it('unit RLS excludes foreign tenant and unassigned history, then resets on rollback', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      expect(
        (await connection.query('SELECT id FROM equipment_units')).rows
      ).toEqual([])
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      expect(
        (await connection.query('SELECT id FROM equipment_units')).rows
          .map((row) => row.id)
          .sort()
      ).toEqual([...context.units.alfa].sort())
      expect(
        (
          await connection.query(
            'SELECT id FROM equipment_units WHERE "tenantId"=$1',
            [context.bravo.id]
          )
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect(
        (await connection.query('SELECT id FROM equipment_units')).rows
      ).toEqual([])
    } finally {
      connection.release()
      await scoped.end()
    }
  })
  it('keeps original generic errors on actual unit SELECT failure', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(
        pool,
        `REVOKE SELECT ON equipment_units FROM ${role}`
      )
      await unitParity(jars[0]!, b, {}, 500, {
        error: 'Erro ao buscar unidades',
      })
      await unitParity(jars[0]!, b, { id: context.units.bravo[0]! }, 500, {
        error: 'Erro ao buscar unidade',
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON equipment_units TO ${role}`)
    }
  })
  it.each(['list', 'detail'] as const)(
    '%s preserves HEAD/OPTIONS and the declared migration scope',
    async (kind) => {
      const input = kind === 'detail' ? { id: context.units.bravo[0]! } : {}
      await eachHost(
        (origin) =>
          readUnits(origin, jars[0]!, b, { ...input, method: 'HEAD' }),
        200,
        { ...plainHeaders, cookie: null, allow: null },
        ''
      )
      await methodContract(
        (origin, method) =>
          readUnits(
            origin,
            method === 'OPTIONS' ? '' : jars[0]!,
            method === 'OPTIONS' ? {} : b,
            { ...input, method }
          ),
        kind === 'list'
          ? ['GET', 'HEAD', 'OPTIONS', 'POST']
          : ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH'],
        frameworkMethodHeaders,
        kind === 'list' ? ['PUT', 'PATCH', 'DELETE'] : ['POST', 'PUT']
      )
    }
  )
})

async function readAdminCategories(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  query = '',
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/admin/categories${query}`, {
    method,
    headers: { Cookie: jar, ...headers },
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function adminCategoryParity(
  jar: string,
  headers: Record<string, string>,
  status: number,
  body: unknown,
  query = ''
) {
  return eachHost(
    (origin) => readAdminCategories(origin, jar, headers, query),
    status,
    {
      ...guardedHeaders(typeof body === 'function' ? {} : body),
      cookie: null,
      allow: null,
    },
    body
  )
}

describe(`${context.identity.mode} — permission-backed administrative category reads`, () => {
  const insufficient = { error: 'Permissão insuficiente nesta locadora' }
  it.each([
    [
      'missing session',
      '',
      { 'x-tenant-id': context.alfa.id },
      401,
      'Authentication required',
    ],
    ['missing selection', 'session', {}, 409, 'Select an organization'],
    [
      'CLIENT even with a stored grant',
      'session',
      { 'x-tenant-id': context.alfa.id },
      403,
      'Acesso administrativo não permitido',
    ],
    [
      'global ADMIN without membership',
      'other',
      { 'x-tenant-id': context.alfa.id },
      403,
      'Organization access denied',
    ],
    [
      'foreign and unassigned OPERATOR grants',
      'other',
      { 'x-tenant-id': context.bravo.id },
      403,
      'Permissão insuficiente nesta locadora',
    ],
  ] as const)('%s', async (_name, who, headers, status, error) => {
    await adminCategoryParity(
      who === 'session' ? jars[0]! : who === 'other' ? jars[1]! : '',
      headers,
      status,
      { error }
    )
  })
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'FINANCIAL with an exact grant through %s',
    async (transport) => {
      const jar =
        transport === 'cookie' || transport === 'matching'
          ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
          : jars[0]!
      const headers: Record<string, string> =
        transport === 'cookie'
          ? {}
          : transport === 'header'
            ? { 'x-tenant-id': context.bravo.id }
            : transport === 'host'
              ? tenantEdge(context.bravo.slug)
              : {
                  ...tenantEdge(context.bravo.slug),
                  'x-tenant-id': context.bravo.id,
                }
      await adminCategoryParity(jar, headers, 200, [
        { ...categoryRow('bravo'), _count: { equipments: 2 } },
      ])
    }
  )
  it('rechecks OPERATOR and FINANCIAL roles and grants after login', async () => {
    const id = context.identity.memberships[0]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { role: 'OPERATOR' },
      })
      const alfaCategories = [
        { ...categoryRow('alfa'), _count: { equipments: 12 } },
      ]
      await adminCategoryParity(
        jars[0]!,
        { 'x-tenant-id': context.alfa.id },
        200,
        alfaCategories
      )
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'MANAGE' },
      })
      await adminCategoryParity(
        jars[0]!,
        { 'x-tenant-id': context.alfa.id },
        403,
        insufficient
      )
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'READ' },
      })
      await adminCategoryParity(
        jars[0]!,
        { 'x-tenant-id': context.alfa.id },
        200,
        alfaCategories
      )
      await prisma.membership.update({
        where: { id },
        data: { role: 'FINANCIAL' },
      })
      // FINANCIAL has A grants for the wrong module/action and a valid B grant.
      await adminCategoryParity(
        jars[0]!,
        { 'x-tenant-id': context.alfa.id },
        403,
        insufficient
      )
    } finally {
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'READ' },
      })
      await prisma.membership.update({
        where: { id },
        data: { role: 'CLIENT' },
      })
    }
  })
  it.each(['tenant', 'role', 'module', 'action'] as const)(
    'requires an exact %s in the grant',
    async (dimension) => {
      const id = context.permissions.bravoFinancial
      const saved = await prisma.permission.findUniqueOrThrow({ where: { id } })
      try {
        const data =
          dimension === 'tenant'
            ? { tenantId: context.alfa.id }
            : dimension === 'role'
              ? { role: 'OPERATOR' as const }
              : dimension === 'module'
                ? { module: 'FINANCIAL' }
                : { action: 'WRITE' }
        await prisma.permission.update({ where: { id }, data })
        await adminCategoryParity(
          jars[0]!,
          { 'x-tenant-id': context.bravo.id },
          403,
          insufficient
        )
      } finally {
        await prisma.permission.update({
          where: { id },
          data: {
            tenantId: saved.tenantId,
            role: saved.role,
            module: saved.module,
            action: saved.action,
          },
        })
      }
    }
  )
  it('preserves the bare array, complete DTO and descending creation ordering', async () => {
    const ids = [randomUUID(), randomUUID()]
    try {
      await prisma.category.createMany({
        data: ids.map((id, index) => ({
          id,
          tenantId: context.alfa.id,
          name: `fixture-category-${index}`,
          description: 'Private category description',
          slug: id,
          icon: 'fixture-icon',
          iconColor: '#ea580c',
          bgColor: '#fff7ed',
          fontColor: '#7c2d12',
          placement: 'types',
          customIcon: { source: 'emoji', emoji: '🔧' },
          createdAt: new Date(
            index ? '2020-01-01T00:00:00Z' : '2030-01-01T00:00:00Z'
          ),
        })),
      })
      await asTenantAdmin(async () => {
        const headers = { 'x-tenant-id': context.alfa.id }
        const created = (index: number) => ({
          id: ids[index]!,
          tenantId: context.alfa.id,
          name: `fixture-category-${index}`,
          description: 'Private category description',
          icon: 'fixture-icon',
          iconColor: '#ea580c',
          bgColor: '#fff7ed',
          fontColor: '#7c2d12',
          slug: ids[index]!,
          createdAt: index
            ? '2020-01-01T00:00:00.000Z'
            : '2030-01-01T00:00:00.000Z',
          updatedAt: expect.any(String),
          placement: 'types',
          customIcon: { source: 'emoji', emoji: '🔧' },
          _count: { equipments: 0 },
        })
        const rows = [
          created(0),
          { ...categoryRow('alfa'), _count: { equipments: 12 } },
          created(1),
        ]
        await adminCategoryParity(jars[0]!, headers, 200, rows)
        await adminCategoryParity(
          jars[0]!,
          headers,
          200,
          rows,
          `?tenantId=${context.bravo.id}&role=CLIENT&module=FINANCIAL&action=WRITE&limit=1&orderBy=name`
        )
      })
    } finally {
      await prisma.category.deleteMany({ where: { id: { in: ids } } })
    }
  })
  it('ADMIN bypasses permission lookup but permission storage errors still fail granted roles', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON permissions FROM ${role}`)
      await asTenantAdmin(async () => {
        await adminCategoryParity(
          jars[0]!,
          { 'x-tenant-id': context.alfa.id },
          200,
          [{ ...categoryRow('alfa'), _count: { equipments: 12 } }]
        )
      })
      await adminCategoryParity(
        jars[0]!,
        { 'x-tenant-id': context.bravo.id },
        500,
        { error: 'Erro ao buscar categorias' }
      )
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON permissions TO ${role}`)
    }
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'refuses a %s membership before the stored permission',
    async (status) => {
      const id = context.identity.memberships[1]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await adminCategoryParity(
          jars[0]!,
          { 'x-tenant-id': context.bravo.id },
          403,
          { error: 'Organization access denied' }
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it.each(['header-cookie', 'host-header', 'host-cookie'] as const)(
    'refuses conflicting %s tenant candidates',
    async (kind) => {
      const jar =
        kind === 'host-header'
          ? jars[0]!
          : `${jars[0]}; selected-tenant-id=${context.alfa.id}`
      const headers =
        kind === 'header-cookie'
          ? { 'x-tenant-id': context.bravo.id }
          : kind === 'host-header'
            ? {
                ...tenantEdge(context.bravo.slug),
                'x-tenant-id': context.alfa.id,
              }
            : tenantEdge(context.bravo.slug)
      await adminCategoryParity(jar, headers, 400, {
        error: 'Conflicting tenant selection',
      })
    }
  )
  it('ignores forged edge and rejects a malformed preference', async () => {
    await adminCategoryParity(
      jars[0]!,
      { ...tenantEdge(), 'x-platform-edge-auth': 'fixture-forged-secret' },
      409,
      { error: 'Select an organization' }
    )
    await adminCategoryParity(`${jars[0]}; selected-tenant-id=%`, {}, 400, {
      error: 'Invalid tenant selection',
    })
  })
  it('keeps the suspended-host response neutral', async () => {
    await adminCategoryParity(jars[0]!, tenantEdge(context.suspended), 404, {
      error: 'Locadora não encontrada',
    })
    await adminCategoryParity(
      jars[0]!,
      { 'x-tenant-id': context.suspended },
      403,
      { error: 'Organization access denied' }
    )
  })
  it('returns an empty array for an authorized empty tenant', async () => {
    const id = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await adminCategoryParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        200,
        []
      )
    } finally {
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
    }
  })
  it('permission RLS excludes foreign and unassigned grants and resets after rollback', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      expect(
        (await connection.query('SELECT id FROM permissions')).rows
      ).toEqual([])
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      expect(
        (await connection.query('SELECT id FROM permissions')).rows
          .map((row) => row.id)
          .sort()
      ).toEqual(
        [
          context.permissions.alfaOperator,
          context.permissions.alfaClient,
          context.permissions.wrongModule,
          context.permissions.wrongAction,
        ].sort()
      )
      expect(
        (
          await connection.query(
            'SELECT id FROM permissions WHERE "tenantId"=$1',
            [context.bravo.id]
          )
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect(
        (await connection.query('SELECT id FROM permissions')).rows
      ).toEqual([])
    } finally {
      connection.release()
      await scoped.end()
    }
  })
  it('preserves the generic category storage error', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON categories FROM ${role}`)
      await asTenantAdmin(async () => {
        await adminCategoryParity(
          jars[0]!,
          { 'x-tenant-id': context.alfa.id },
          500,
          { error: 'Erro ao buscar categorias' }
        )
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON categories TO ${role}`)
    }
  })
  it('preserves HEAD and declares GET/HEAD/OPTIONS/POST for categories in both hosts', async () => {
    const headers = { 'x-tenant-id': context.bravo.id }
    await eachHost(
      (origin) => readAdminCategories(origin, jars[0]!, headers, '', 'HEAD'),
      200,
      { ...plainHeaders, cookie: null, allow: null },
      ''
    )
    await methodContract(
      (origin, method) =>
        readAdminCategories(
          origin,
          method === 'OPTIONS' ? '' : jars[0]!,
          method === 'OPTIONS' ? {} : headers,
          '',
          method
        ),
      ['GET', 'HEAD', 'OPTIONS', 'POST'],
      frameworkMethodHeaders,
      ['PUT', 'PATCH', 'DELETE']
    )
  })
})

async function read(
  origin: string,
  jar = '',
  query = '',
  headers = {},
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/auth/organizations${query}`, {
    headers: { Cookie: jar, ...headers },
    method,
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
const expected = (index = 0) => ({
  memberships:
    index === 0
      ? [
          {
            membershipId: context.identity.memberships[0],
            role: 'CLIENT',
            tenant: {
              id: context.alfa.id,
              slug: context.alfa.slug,
              name: 'alfa',
              status: 'ACTIVE',
            },
          },
          {
            membershipId: context.identity.memberships[1],
            role: 'FINANCIAL',
            tenant: {
              id: context.bravo.id,
              slug: context.bravo.slug,
              name: 'bravo',
              status: 'ACTIVE',
            },
          },
        ]
      : index === 1
        ? [
            {
              membershipId: context.identity.memberships[4],
              role: 'OPERATOR',
              tenant: {
                id: context.bravo.id,
                slug: context.bravo.slug,
                name: 'bravo',
                status: 'ACTIVE',
              },
            },
          ]
        : [],
})

describe(`${context.identity.mode} — authenticated memberships parity`, () => {
  it('real login retains the selected engine budget and clears legacy account windows', async () => {
    if (context.identity.mode === 'better-auth') {
      // The installed engine uses auth_rate_limits after cutover, rather than
      // the shared legacy credential guard. The real login helper forwards
      // this run's reserved IPv6 address; the installed engine pads its /64.
      const ip =
        context.directory.ips[63]!.split('::')[0]!
          .split(':')
          .map((part) => part.padStart(4, '0'))
          .join(':') + ':0000:0000:0000:0000'
      const window = await prisma.authRateLimit.findUnique({
        where: { key: `${ip}|/sign-in/email` },
      })
      expect(window).not.toBeNull()
      expect(window!.count).toBeGreaterThanOrEqual(
        context.identity.users.length
      )
      expect(window!.lastRequest).toBeGreaterThanOrEqual(BigInt(loginStartedAt))
      return
    }
    for (const user of context.identity.users) {
      const digest = platformRateLimitDigest(
        context.directory.secret,
        'account',
        user.email
      )
      expect(
        await prisma.platformRateLimit.count({
          where: {
            OR: ['account', 'account-ip'].map((kind) => ({
              key: { startsWith: `auth:sign-in:${kind}:${digest}:` },
            })),
          },
        })
      ).toBe(0)
    }
    const ipDigest = platformRateLimitDigest(
      context.directory.secret,
      'ip',
      context.directory.ips[63]!.replace(/::1$/, '::/64')
    )
    expect(
      await prisma.platformRateLimit.count({
        where: { key: { startsWith: `auth:sign-in:ip:${ipDigest}:` } },
      })
    ).toBeGreaterThan(0)
  })
  it.each([
    '',
    'forged-session=fixture',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])(
    'refuses an absent or unsigned session (%s) in both hosts',
    async (jar) => {
      for (const origin of parityTargets(context)) {
        const response = await read(origin, jar)
        expect(response.status).toBe(401)
        expect(JSON.parse(response.body)).toEqual({
          error: 'Authentication required',
        })
        expect(response.cache).toBe('no-store')
        expect(response.vary).toBe(vary)
      }
    }
  )
  it.each([0, 1, 2])(
    'reads only identity %s active memberships, with no global-role or default-tenant fallback',
    async (index) => {
      const service = await eachHost(
        (origin) => read(origin, jars[index]),
        200,
        { cache: 'no-store', vary, cookie: null, allow: null },
        expected(index)
      )
      expect(service.body).not.toContain('fixture-private')
    }
  )
  it('ignores attempted identity/tenant/role overrides in the request', async () => {
    for (const origin of parityTargets(context)) {
      const response = await read(
        origin,
        `${jars[0]}; selected-tenant-id=${context.bravo.id}`,
        `?userId=${context.identity.users[1]!.id}&tenantId=${context.bravo.id}&role=ADMIN`,
        {
          'x-tenant-id': context.bravo.id,
          'x-user-id': context.identity.users[1]!.id,
          ...edge,
        }
      )
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual(expected())
    }
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks a %s membership even with the same live session cookie',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        for (const origin of parityTargets(context)) {
          const response = await read(origin, jars[0])
          expect(response.status).toBe(200)
          expect(JSON.parse(response.body)).toEqual({
            memberships: expected().memberships.slice(1),
          })
        }
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('rechecks organization suspension without relying on the login snapshot', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.bravo.id },
          data: { status: 'SUSPENDED' },
        })
      )
      for (const origin of parityTargets(context)) {
        const response = await read(origin, jars[0])
        expect(JSON.parse(response.body)).toEqual({
          memberships: expected().memberships.slice(0, 1),
        })
      }
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.bravo.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'keeps %s unmounted',
    async (method) => {
      await eachHost(
        (origin) => read(origin, jars[0], '', {}, method),
        405,
        { ...frameworkMethodHeaders, allow: null },
        ''
      )
    }
  )
  it('serves the selected identity engine in both hosts with the existing session', async () => {
    const path =
      context.identity.mode === 'legacy'
        ? '/api/auth/session'
        : '/api/auth/get-session'
    for (const host of parityTargets(context)) {
      const response = await fetch(`${host}${path}`, {
        headers: { Cookie: jars[0]! },
        redirect: 'manual',
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect((await response.json()).user.id).toBe(
        context.identity.users[0]!.id
      )
    }
  })
  it('refuses a session revoked by its own engine in both hosts', async () => {
    const userId = context.identity.users[2]!.id
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    })
    try {
      if (context.identity.mode === 'better-auth')
        await prisma.authSession.deleteMany({ where: { userId } })
      else
        await prisma.user.update({
          where: { id: userId },
          data: { password: 'fixture-rotated-credential' },
        })
      for (const origin of parityTargets(context)) {
        const response = await read(origin, jars[2])
        expect(response.status).toBe(401)
        expect(JSON.parse(response.body)).toEqual({
          error: 'Authentication required',
        })
        expect(response.cache).toBe('no-store')
      }
      for (const origin of parityTargets(context)) {
        const response = await readSelection(
          origin,
          jars[2]!,
          `selected-tenant-id=${context.alfa.id}`
        )
        expect(response.status).toBe(401)
        expect(JSON.parse(response.body)).toEqual({
          error: 'Authentication required',
        })
        expect(response.cookie).toBe(clearedPreference)
      }
      await currentParity(jars[2]!, tenantEdge(), '', 401, {
        error: 'Authentication required',
      })
      await driverParity(
        jars[2]!,
        { 'x-tenant-id': context.alfa.id },
        '',
        401,
        { error: 'Authentication required' }
      )
      await adminListParity(
        jars[2]!,
        { 'x-tenant-id': context.alfa.id },
        '',
        401,
        { error: 'Authentication required' }
      )
      await permissionRowsParity(
        jars[2]!,
        { 'x-tenant-id': context.alfa.id },
        401,
        { error: 'Authentication required' }
      )
      await addressParity(jars[2]!, { 'x-tenant-id': context.alfa.id }, 401, {
        error: 'Authentication required',
      })
      await adminCategoryParity(
        jars[2]!,
        { 'x-tenant-id': context.alfa.id },
        401,
        {
          error: 'Authentication required',
        }
      )
      for (const input of [{}, { id: context.units.alfa[0]! }])
        await unitParity(
          jars[2]!,
          { 'x-tenant-id': context.alfa.id },
          input,
          401,
          {
            error: 'Authentication required',
          }
        )
      await adminEquipmentParity(
        jars[2]!,
        { 'x-tenant-id': context.alfa.id },
        { id: context.alfa.equipmentIds[0]! },
        401,
        { error: 'Authentication required' }
      )
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { password: stored.password },
      })
    }
  })
})

async function readAdminList(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  query = '',
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/admin/equipments${query}`, {
    method,
    headers: { Cookie: jar, ...headers },
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
    limit: response.headers.get('x-ratelimit-limit'),
    remaining: response.headers.get('x-ratelimit-remaining'),
    reset: response.headers.get('x-ratelimit-reset'),
    retry: response.headers.get('retry-after'),
  }
}
async function adminListParity(
  jar: string,
  headers: Record<string, string>,
  query: string,
  status: number,
  body: unknown
) {
  return eachHost(
    (origin) => readAdminList(origin, jar, headers, query),
    status,
    {
      ...guardedHeaders(typeof body === 'function' ? {} : body),
      cookie: null,
      allow: null,
      limit: null,
      remaining: null,
      reset: null,
      retry: null,
    },
    body
  )
}
describe(`${context.identity.mode} — administrative equipment list`, () => {
  const a = { 'x-tenant-id': context.alfa.id }
  const b = { 'x-tenant-id': context.bravo.id }
  const sorted = [...context.alfa.equipmentIds].reverse()
  it('preserves default pagination, full private DTO and scoped relation counts', async () => {
    await asTenantAdmin(async () => {
      // Full private DTOs (newest first) with scoped relation counts, built from the fixture (wave 135, B2).
      await adminListParity(jars[0]!, a, '', 200, {
        equipments: [...context.alfa.equipmentIds.keys()]
          .reverse()
          .map((index) => ({
            ...equipmentRow('alfa', index),
            _count: {
              quoteItems: index === 0 ? 2 : 0,
              rental_items: index === 0 ? 4 : index === 1 ? 5 : 0,
            },
          })),
        pagination: { page: 1, limit: 100, totalItems: 12, totalPages: 1 },
      })
    })
  })
  it.each([
    ['second page', '?page=2&limit=5', sorted.slice(5, 10), 2, 5, 12],
    ['beyond end', '?page=9&limit=5', [], 9, 5, 12],
    [
      'integer prefixes',
      '?page=2tail&limit=5.9',
      sorted.slice(5, 10),
      2,
      5,
      12,
    ],
    [
      'empty defaults',
      '?page=&limit=&search=&categoryId=all&isAvailable=all',
      sorted,
      1,
      100,
      12,
    ],
    ['no maximum cap', '?limit=101', sorted, 1, 101, 12],
    [
      'first duplicate',
      '?page=1&page=5&limit=2&limit=9',
      sorted.slice(0, 2),
      1,
      2,
      12,
    ],
    ['description match', '?search=guindaste', sorted.slice(0, 1), 1, 100, 1],
    ['case insensitive', '?search=BETONEIRA', sorted.slice(1), 1, 100, 11],
    [
      'foreign category',
      `?categoryId=${context.bravo.categoryId}`,
      [],
      1,
      100,
      0,
    ],
    [
      'own category',
      `?categoryId=${context.alfa.categoryId}`,
      sorted,
      1,
      100,
      12,
    ],
    [
      'available',
      '?isAvailable=true',
      sorted.filter((id) => id !== context.alfa.equipmentIds[10]),
      1,
      100,
      11,
    ],
    [
      'unavailable',
      '?isAvailable=false',
      [context.alfa.equipmentIds[10]],
      1,
      100,
      1,
    ],
    [
      'other boolean',
      '?isAvailable=maybe',
      [context.alfa.equipmentIds[10]],
      1,
      100,
      1,
    ],
    [
      'empty boolean',
      '?isAvailable=',
      [context.alfa.equipmentIds[10]],
      1,
      100,
      1,
    ],
    ['percent wildcard', '?search=%25', sorted, 1, 100, 12],
    ['underscore wildcard', '?search=_', sorted, 1, 100, 12],
    ['no match', '?search=missing-fixture', [], 1, 100, 0],
    [
      'old undocumented aliases ignored',
      '?category=foreign&available=false&tenantId=foreign&fields=name',
      sorted,
      1,
      100,
      12,
    ],
  ] as const)('preserves %s', async (_name, query, ids, page, limit, total) => {
    await asTenantAdmin(async () => {
      await adminListParity(
        jars[0]!,
        a,
        query,
        200,
        (body: { equipments: { id: string }[]; pagination: unknown }) => {
          expect(body.equipments.map((row) => row.id)).toEqual(ids)
          expect(body.pagination).toEqual({
            page,
            limit,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          })
        }
      )
    })
  })
  it.each([
    '?page=0',
    '?page=-1',
    '?page=NaN',
    '?limit=0',
    '?limit=-1',
    '?limit=NaN',
  ])('preserves validation %s', async (query) => {
    await adminListParity(jars[0]!, b, query, 400, {
      error: `Parâmetro '${query.includes('page') ? 'page' : 'limit'}' inválido.`,
    })
  })
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'exact FINANCIAL grant through %s sees only bravo',
    async (transport) => {
      const jar =
        transport === 'cookie' || transport === 'matching'
          ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
          : jars[0]!
      const headers =
        transport === 'cookie'
          ? {}
          : transport === 'header'
            ? b
            : transport === 'host'
              ? tenantEdge(context.bravo.slug)
              : { ...tenantEdge(context.bravo.slug), ...b }
      await adminListParity(jar, headers, '', 200, {
        equipments: [1, 0].map((index) => ({
          ...equipmentRow('bravo', index),
          _count: {
            quoteItems: index === 0 ? 1 : 0,
            rental_items: index === 0 ? 3 : 0,
          },
        })),
        pagination: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
      })
    }
  )
  it('refuses identity/selection/CLIENT/global role before even invalid pagination', async () => {
    await adminListParity('', a, '?page=invalid', 401, {
      error: 'Authentication required',
    })
    await adminListParity(jars[0]!, {}, '?page=invalid', 409, {
      error: 'Select an organization',
    })
    await adminListParity(jars[0]!, a, '?page=invalid', 403, {
      error: 'Acesso administrativo não permitido',
    })
    await adminListParity(jars[1]!, a, '', 403, {
      error: 'Organization access denied',
    })
    await adminListParity(jars[1]!, b, '', 403, {
      error: 'Permissão insuficiente nesta locadora',
    })
    await adminListParity(jars[0]!, tenantEdge(context.suspended), '', 404, {
      error: 'Locadora não encontrada',
    })
    await adminListParity(jars[0]!, { ...tenantEdge(), ...b }, '', 400, {
      error: 'Conflicting tenant selection',
    })
  })
  it('revalidates the OPERATOR permission and revoked membership after login', async () => {
    const membership = context.identity.memberships[0]!
    try {
      await prisma.membership.update({
        where: { id: membership },
        data: { role: 'OPERATOR' },
      })
      await adminListParity(
        jars[0]!,
        a,
        '',
        200,
        (body: { equipments: { id: string }[] }) =>
          expect(body.equipments.map((row) => row.id)).toEqual(sorted)
      )
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'MANAGE' },
      })
      await adminListParity(jars[0]!, a, '', 403, {
        error: 'Permissão insuficiente nesta locadora',
      })
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'READ' },
      })
      await prisma.membership.update({
        where: { id: membership },
        data: { status: 'REVOKED' },
      })
      await adminListParity(jars[0]!, a, '', 403, {
        error: 'Organization access denied',
      })
    } finally {
      await prisma.permission.update({
        where: { id: context.permissions.alfaOperator },
        data: { action: 'READ' },
      })
      await prisma.membership.update({
        where: { id: membership },
        data: { role: 'CLIENT', status: 'ACTIVE' },
      })
    }
  })
  it('authorized empty tenant lists no foreign or unassigned equipment', async () => {
    const membership = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id: membership },
        data: { status: 'ACTIVE' },
      })
      await adminListParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        '',
        200,
        {
          equipments: [],
          pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
        }
      )
    } finally {
      await prisma.membership.update({
        where: { id: membership },
        data: { status: 'REVOKED' },
      })
    }
  })
  it('preserves generic production failure when equipment SELECT is actually denied', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON equipments FROM ${role}`)
      await adminListParity(jars[0]!, b, '', 500, {
        error: 'Erro interno do servidor ao buscar equipamentos.',
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON equipments TO ${role}`)
    }
  })
  it('preserves HEAD/OPTIONS parity after installing equipment POST in the service', async () => {
    await eachHost(
      (origin) => readAdminList(origin, jars[0]!, b, '', 'HEAD'),
      200,
      {
        ...plainHeaders,
        cookie: null,
        allow: null,
        limit: null,
        remaining: null,
        reset: null,
        retry: null,
      },
      ''
    )
    await methodContract(
      (origin, method) =>
        readAdminList(
          origin,
          method === 'OPTIONS' ? '' : jars[0]!,
          method === 'OPTIONS' ? {} : b,
          '',
          method
        ),
      ['GET', 'HEAD', 'OPTIONS', 'POST'],
      {
        ...frameworkMethodHeaders,
        limit: null,
        remaining: null,
        reset: null,
        retry: null,
      },
      ['PUT', 'PATCH', 'DELETE']
    )
  })
  it('counts before identity, isolates instances and uses only the trusted edge IP', async () => {
    const headers = {
      ...edge,
      'x-platform-client-ip': context.directory.ips[62]!,
    }
    const started = Date.now()
    // Each process keeps its own window: exhaust it on every host of the run (GET and POST count alike), the API
    // starting its window only after the root's is exhausted when both run.
    for (const origin of parityTargets(context))
      for (let i = 0; i < 200; i++)
        expect(
          (
            await readAdminList(
              origin,
              '',
              {
                ...headers,
                Origin: 'https://app.platform.test',
                'Sec-Fetch-Site': 'same-origin',
              },
              '',
              i < 100 ? 'GET' : 'POST'
            )
          ).status
        ).toBe(401)
    for (const origin of parityTargets(context)) {
      const result = await readAdminList(origin, '', {
        ...headers,
        'x-real-ip': '198.51.100.99',
        'x-forwarded-for': '198.51.100.100',
      })
      expect({
        status: result.status,
        cache: result.cache,
        vary: result.vary,
        cookie: result.cookie,
        allow: result.allow,
        limit: result.limit,
        remaining: result.remaining,
      }).toEqual({
        status: 429,
        ...plainHeaders,
        cookie: null,
        allow: null,
        limit: '200',
        remaining: '0',
      })
      const now = Date.now()
      expect(Number(result.reset) * 1000).toBeGreaterThanOrEqual(
        started + 60_000
      )
      expect(Number(result.reset) * 1000).toBeLessThanOrEqual(now + 61_000)
      expect(Number(result.retry)).toBeGreaterThanOrEqual(1)
      expect(Number(result.retry)).toBeLessThanOrEqual(60)
      expect(JSON.parse(result.body)).toEqual({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Number(result.retry),
      })
      const head = await readAdminList(origin, '', headers, '', 'HEAD')
      expect(head.status).toBe(429)
      expect(head.body).toBe('')
      expect(head.limit).toBe('200')
      expect(
        (
          await readAdminList(origin, '', {
            ...headers,
            'x-platform-client-ip': context.directory.ips[61]!,
          })
        ).status
      ).toBe(401)
    }
  })
})

async function readDrivers(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  query = '',
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/admin/drivers${query}`, {
    method,
    headers: { Cookie: jar, ...headers },
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function driverParity(
  jar: string,
  headers: Record<string, string>,
  query: string,
  status: number,
  body: unknown
) {
  return eachHost(
    (origin) => readDrivers(origin, jar, headers, query),
    status,
    {
      ...guardedHeaders(typeof body === 'function' ? {} : body),
      cookie: null,
      allow: null,
    },
    body
  )
}
/** A driver of the fixture as the private listing serializes it (global-setup.ts). */
function driverRow(tenant: 'alfa' | 'bravo', index: number) {
  return tenant === 'alfa'
    ? {
        id: context.drivers.alfa[index]!,
        tenantId: context.alfa.id,
        name: ['Zeta alfa', 'Alpha alfa', 'Middle alfa'][index],
        phone: 'fixture-private-phone',
        cnh: 'fixture-private-cnh',
        cnhCategory: 'B',
        status: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'][index],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
    : {
        id: context.drivers.bravo[0]!,
        tenantId: context.bravo.id,
        name: 'Only bravo',
        phone: 'fixture-private-phone',
        cnh: null,
        cnhCategory: null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }
}
async function asTenantAdmin(run: () => Promise<void>) {
  const membershipIds = context.identity.memberships.slice(0, 2)
  const saved = await prisma.membership.findMany({
    where: { id: { in: membershipIds } },
    select: { id: true, role: true },
  })
  try {
    await prisma.membership.updateMany({
      where: { id: { in: membershipIds } },
      data: { role: 'ADMIN' },
    })
    await run()
  } finally {
    for (const row of saved)
      await prisma.membership.update({
        where: { id: row.id },
        data: { role: row.role },
      })
  }
}
describe(`${context.identity.mode} — private driver listing parity`, () => {
  it.each([
    [
      'missing session',
      '',
      { 'x-tenant-id': context.alfa.id },
      401,
      'Authentication required',
    ],
    ['missing selection', 'session', {}, 409, 'Select an organization'],
    [
      'CLIENT membership',
      'session',
      { 'x-tenant-id': context.alfa.id },
      403,
      'Forbidden',
    ],
    [
      'FINANCIAL membership',
      'session',
      { 'x-tenant-id': context.bravo.id },
      403,
      'Forbidden',
    ],
    [
      'OPERATOR membership',
      'operator',
      { 'x-tenant-id': context.bravo.id },
      403,
      'Forbidden',
    ],
    [
      'global ADMIN without membership',
      'session',
      { 'x-tenant-id': context.unconfigured },
      403,
      'Organization access denied',
    ],
    [
      'bad selection',
      'session',
      { 'x-tenant-id': '../foreign' },
      400,
      'Invalid tenant selection',
    ],
    [
      'undecodable cookie',
      'session',
      { Cookie: 'selected-tenant-id=%zz' },
      400,
      'Invalid tenant selection',
    ],
  ] as const)('%s', async (_name, who, headers, status, error) => {
    const jar =
      who === 'session' ? jars[0]! : who === 'operator' ? jars[1]! : ''
    const actualHeaders: Record<string, string> = { ...headers }
    if ('Cookie' in headers && headers.Cookie) {
      actualHeaders.Cookie = `${jar}; ${headers.Cookie}`
    }
    await driverParity(jar, actualHeaders, '', status, { error })
  })
  it.each(['header', 'cookie', 'host', 'matching sources'] as const)(
    'reads only the selected tenant via %s',
    async (source) => {
      await asTenantAdmin(async () => {
        for (const tenant of [context.alfa, context.bravo]) {
          const headers: Record<string, string> =
            source === 'header'
              ? { 'x-tenant-id': tenant.id }
              : source === 'cookie'
                ? { Cookie: `${jars[0]}; selected-tenant-id=${tenant.id}` }
                : source === 'host'
                  ? tenantEdge(tenant.slug)
                  : {
                      ...tenantEdge(tenant.slug),
                      'x-tenant-id': tenant.id,
                      Cookie: `${jars[0]}; selected-tenant-id=${tenant.id}`,
                    }
          await driverParity(
            jars[0]!,
            headers,
            '?tenantId=foreign&userId=foreign&role=ADMIN',
            200,
            {
              drivers:
                tenant === context.alfa
                  ? [1, 2, 0].map((index) => driverRow('alfa', index))
                  : [driverRow('bravo', 0)],
            }
          )
        }
      })
    }
  )
  it.each(['ACTIVE', 'INACTIVE', 'ON_LEAVE', ''])(
    'keeps filtering and first status query semantics: %s',
    async (status) => {
      await asTenantAdmin(async () => {
        const statuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE']
        await driverParity(
          jars[0]!,
          { 'x-tenant-id': context.alfa.id },
          `?status=${status}&status=invalid`,
          200,
          {
            drivers: status
              ? [driverRow('alfa', statuses.indexOf(status))]
              : [1, 2, 0].map((index) => driverRow('alfa', index)),
          }
        )
      })
    }
  )
  it('invalid status stays a generic 500 without provider details', async () => {
    await asTenantAdmin(async () => {
      await driverParity(
        jars[0]!,
        { 'x-tenant-id': context.alfa.id },
        '?status=invalid',
        500,
        { error: 'Internal server error' }
      )
    })
  })
  it.each(['host/header', 'host/cookie', 'header/cookie'] as const)(
    'rejects conflicting %s candidates',
    async (conflict) => {
      const headers: Record<string, string> =
        conflict === 'host/header'
          ? { ...tenantEdge(), 'x-tenant-id': context.bravo.id }
          : conflict === 'host/cookie'
            ? {
                ...tenantEdge(),
                Cookie: `${jars[0]}; selected-tenant-id=${context.bravo.id}`,
              }
            : {
                'x-tenant-id': context.alfa.id,
                Cookie: `${jars[0]}; selected-tenant-id=${context.bravo.id}`,
              }
      await driverParity(jars[0]!, headers, '', 400, {
        error: 'Conflicting tenant selection',
      })
    }
  )
  it('a forged edge cannot select a locadora', async () => {
    await driverParity(
      jars[0]!,
      { ...tenantEdge(), 'x-platform-edge-auth': 'wrong-fixture-secret' },
      '',
      409,
      { error: 'Select an organization' }
    )
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks %s membership after issuing the session',
    async (status) => {
      const id = context.identity.memberships[0]!
      await prisma.membership.update({ where: { id }, data: { status } })
      try {
        await driverParity(
          jars[0]!,
          { 'x-tenant-id': context.alfa.id },
          '',
          403,
          { error: 'Organization access denied' }
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('suspended host remains the neutral 404, while an explicit suspended tenant is denied', async () => {
    await driverParity(jars[0]!, tenantEdge(context.suspended), '', 404, {
      error: 'Locadora não encontrada',
    })
    await driverParity(
      jars[0]!,
      { 'x-tenant-id': context.suspended },
      '',
      403,
      { error: 'Organization access denied' }
    )
  })
  it('keeps RLS enforced even without the application tenant filter', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      expect((await connection.query('SELECT id FROM drivers')).rows).toEqual(
        []
      )
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      expect(
        (
          await connection.query('SELECT id FROM drivers ORDER BY name')
        ).rows.map((row) => row.id)
      ).toEqual([
        context.drivers.alfa[1],
        context.drivers.alfa[2],
        context.drivers.alfa[0],
      ])
      expect(
        (
          await connection.query('SELECT id FROM drivers WHERE "tenantId"=$1', [
            context.bravo.id,
          ])
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect((await connection.query('SELECT id FROM drivers')).rows).toEqual(
        []
      )
    } finally {
      connection.release()
      await scoped.end()
    }
  })
  it('preserves HEAD and declares GET/HEAD/OPTIONS/POST in both hosts', async () => {
    await asTenantAdmin(async () => {
      const headers = { 'x-tenant-id': context.alfa.id }
      await eachHost(
        (origin) => readDrivers(origin, jars[0]!, headers, '', 'HEAD'),
        200,
        { ...plainHeaders, cookie: null, allow: null },
        ''
      )
    })
    await methodContract(
      (origin, method) =>
        readDrivers(
          origin,
          method === 'OPTIONS' ? '' : jars[0]!,
          {},
          '',
          method
        ),
      ['GET', 'HEAD', 'OPTIONS', 'POST'],
      frameworkMethodHeaders,
      ['PUT', 'PATCH', 'DELETE']
    )
  })
})

function tenantEdge(slug = context.alfa.slug) {
  return {
    ...edge,
    'x-platform-host-kind': 'tenant',
    'x-platform-origin': `https://${slug}.platform.test`,
    'x-platform-tenant-slug': slug,
  }
}
async function readCurrent(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  query = '',
  method = 'GET'
) {
  const response = await fetch(
    `${origin}/api/auth/organizations/current${query}`,
    { method, headers: { Cookie: jar, ...headers } }
  )
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function currentParity(
  jar: string,
  headers: Record<string, string>,
  query: string,
  status: number,
  body: unknown,
  privateResponse = true
) {
  const service = await eachHost(
    (origin) => readCurrent(origin, jar, headers, query),
    status,
    {
      cache: privateResponse ? 'private, no-store' : 'no-store',
      vary: privateResponse ? `${vary}, Host` : frameworkVary,
      cookie: null,
      allow: null,
    },
    body
  )
  expect(service.body).not.toContain('fixture-private')
  return service
}

describe(`${context.identity.mode} — host-scoped current membership parity`, () => {
  it.each(['no edge', 'app', 'apex', 'forged edge'])(
    '%s cannot become a tenant host through query or preferences',
    async (kind) => {
      const headers =
        kind === 'no edge'
          ? {}
          : kind === 'forged edge'
            ? { ...tenantEdge(), 'x-platform-edge-auth': 'forged-secret' }
            : kind === 'app'
              ? edge
              : {
                  ...edge,
                  'x-platform-host-kind': 'apex',
                  'x-platform-origin': 'https://platform.test',
                }
      for (const query of [
        '',
        `?tenantSlug=${context.alfa.slug}`,
        '?tenantSlug=unknown-locadora',
        '?tenantSlug=api',
        `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.bravo.slug}`,
      ])
        await currentParity(
          `${jars[0]}; selected-tenant-id=${context.alfa.id}`,
          { ...headers, 'x-tenant-id': context.alfa.id },
          query,
          409,
          {
            error: 'Disponível somente no endereço da locadora',
            code: 'TENANT_REQUIRED',
          }
        )
    }
  )
  it.each([
    '',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])('requires an actual identity on the tenant host: %s', async (jar) => {
    await currentParity(jar, tenantEdge(), '', 401, {
      error: 'Authentication required',
    })
  })
  it.each([0, 1])(
    'reads only identity 0 membership of locadora %s',
    async (index) => {
      const tenant = index === 0 ? context.alfa : context.bravo
      const response = await currentParity(
        jars[0]!,
        tenantEdge(tenant.slug),
        '',
        200,
        {
          membership: expected().memberships[index],
        }
      )
      expect(response.body).not.toContain(
        index === 0 ? context.bravo.id : context.alfa.id
      )
    }
  )
  it('the account global ADMIN role does not grant membership of another locadora', async () => {
    await currentParity(jars[1]!, tenantEdge(), '', 404, {
      error: 'Sem vínculo com esta locadora',
      code: 'NO_MEMBERSHIP',
    })
    await currentParity(jars[1]!, tenantEdge(context.bravo.slug), '', 200, {
      membership: expected(1).memberships[0],
    })
  })
  it.each(['matching', 'matching duplicates', 'empty', 'blank'])(
    'keeps query agreement for %s',
    async (kind) => {
      const query =
        kind === 'matching'
          ? `?tenantSlug=${context.alfa.slug}`
          : kind === 'matching duplicates'
            ? `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.alfa.slug}`
            : kind === 'empty'
              ? '?tenantSlug='
              : '?tenantSlug=%20%20'
      await currentParity(jars[0]!, tenantEdge(), query, 200, {
        membership: expected().memberships[0],
      })
    }
  )
  it.each(['other tenant', 'conflicting duplicates', 'padded slug'])(
    'query conflict precedes authentication: %s',
    async (kind) => {
      const query =
        kind === 'other tenant'
          ? `?tenantSlug=${context.bravo.slug}`
          : kind === 'conflicting duplicates'
            ? `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.bravo.slug}`
            : `?tenantSlug=%20${context.alfa.slug}%20`
      await currentParity(
        '',
        tenantEdge(),
        query,
        400,
        {
          error: 'Seleção de locadora conflitante',
          code: 'TENANT_CONFLICT',
        },
        false
      )
    }
  )
  it.each(['cookie', 'header', 'duplicate cookie', 'undecodable cookie'])(
    'ignores %s preference and spoofed identity/role on the tenant host',
    async (kind) => {
      const preference =
        kind === 'cookie'
          ? `selected-tenant-id=${context.bravo.id}`
          : kind === 'duplicate cookie'
            ? `selected-tenant-id=${context.alfa.id}; selected-tenant-id=${context.bravo.id}`
            : kind === 'undecodable cookie'
              ? 'selected-tenant-id=%FF'
              : ''
      await currentParity(
        [jars[0], preference].filter(Boolean).join('; '),
        {
          ...tenantEdge(),
          'x-tenant-id': context.bravo.id,
          'x-user-id': context.identity.users[1]!.id,
        },
        `?userId=${context.identity.users[1]!.id}&role=ADMIN`,
        200,
        {
          membership: expected().memberships[0],
        }
      )
    }
  )
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks the %s membership within the tenant transaction',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await currentParity(jars[0]!, tenantEdge(), '', 403, {
          error: 'Organization access denied',
        })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it.each(['unknown-locadora', context.suspended])(
    'unknown/suspended host stays neutral before identity: %s',
    async (slug) => {
      await currentParity(
        '',
        tenantEdge(slug),
        `?tenantSlug=${context.bravo.slug}`,
        404,
        {
          error: 'Locadora não encontrada',
        },
        false
      )
    }
  )
  it('rechecks organization suspension with the same live session', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'SUSPENDED' },
        })
      )
      await currentParity(
        jars[0]!,
        tenantEdge(),
        '',
        404,
        {
          error: 'Locadora não encontrada',
        },
        false
      )
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'keeps %s unmounted in both hosts',
    async (method) => {
      await eachHost(
        (origin) => readCurrent(origin, jars[0]!, tenantEdge(), '', method),
        405,
        { ...frameworkMethodHeaders, allow: null },
        ''
      )
    }
  )
  it('preserves implicit HEAD and OPTIONS', async () => {
    await eachHost(
      (origin) => readCurrent(origin, jars[0]!, tenantEdge(), '', 'HEAD'),
      200,
      {
        cache: 'private, no-store',
        vary: `${vary}, Host`,
        cookie: null,
        allow: null,
      },
      ''
    )
    await methodContract(
      (origin, method) => readCurrent(origin, '', {}, '', method),
      ['GET', 'HEAD', 'OPTIONS'],
      frameworkMethodHeaders,
      []
    )
  })
})

const selectionPath = '/api/auth/organizations/selection'
const selectionVary = `${vary}, x-tenant-id`
const clearedPreference =
  'selected-tenant-id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure'
async function readSelection(
  origin: string,
  jar: string,
  preference?: string,
  headers: Record<string, string> = {},
  method = 'GET',
  query = ''
) {
  const response = await fetch(`${origin}${selectionPath}${query}`, {
    headers: {
      Cookie: [jar, preference].filter(Boolean).join('; '),
      ...headers,
    },
    method,
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function selectionParity(
  preference: string | undefined,
  headers: Record<string, string>,
  status: number,
  body: unknown,
  cookie: string | null = null,
  index = 0
) {
  return eachHost(
    (origin) => readSelection(origin, jars[index]!, preference, headers),
    status,
    { cache: 'no-store', vary: selectionVary, cookie, allow: null },
    body
  )
}

describe(`${context.identity.mode} — authenticated selection GET parity`, () => {
  it.each([
    '',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])(
    'a preference cannot authenticate an absent or forged session: %s',
    async (jar) => {
      for (const origin of parityTargets(context)) {
        const response = await readSelection(
          origin,
          jar,
          `selected-tenant-id=${context.alfa.id}`
        )
        expect(response.status).toBe(401)
        expect(JSON.parse(response.body)).toEqual({
          error: 'Authentication required',
        })
        expect(response.cache).toBe('no-store')
        expect(response.vary).toBe(selectionVary)
        expect(response.cookie).toBe(clearedPreference)
      }
    }
  )
  it('does not choose a default locadora for an authenticated account', async () => {
    await selectionParity(undefined, {}, 200, { selection: null })
  })
  it.each(['cookie', 'header', 'both', 'encoded'])(
    'revalidates the current identity and locadora role using %s',
    async (transport) => {
      const cookie =
        transport === 'header'
          ? undefined
          : `selected-tenant-id=${transport === 'encoded' ? context.alfa.id.replace(/-/g, '%2D') : context.alfa.id}`
      const headers: Record<string, string> =
        transport === 'header' || transport === 'both'
          ? { 'x-tenant-id': context.alfa.id }
          : {}
      const response = await selectionParity(cookie, headers, 200, {
        selection: expected().memberships[0],
      })
      expect(response.body).not.toContain('fixture-private')
    }
  )
  it('ignores spoofed identity and role fields and returns the actual membership', async () => {
    for (const origin of parityTargets(context)) {
      const response = await readSelection(
        origin,
        jars[0]!,
        undefined,
        {
          ...edge,
          'x-tenant-id': context.alfa.id,
          'x-user-id': context.identity.users[1]!.id,
        },
        'GET',
        `?userId=${context.identity.users[1]!.id}&role=ADMIN&tenantId=${context.bravo.id}`
      )
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        selection: expected().memberships[0],
      })
      expect(response.cookie).toBeNull()
    }
  })
  it('does not grant access through the account global ADMIN role', async () => {
    await selectionParity(
      `selected-tenant-id=${context.alfa.id}`,
      {},
      200,
      { selection: null },
      clearedPreference,
      1
    )
    await selectionParity(
      undefined,
      { 'x-tenant-id': context.bravo.id },
      200,
      { selection: expected(1).memberships[0] },
      null,
      1
    )
  })
  it('refuses different header and cookie preferences without choosing either', async () => {
    await selectionParity(
      `selected-tenant-id=${context.alfa.id}`,
      { 'x-tenant-id': context.bravo.id },
      400,
      { error: 'Conflicting tenant selection' }
    )
  })
  it.each([
    'selected-tenant-id=alfa; selected-tenant-id=bravo',
    'selected-tenant-id=alfa; selected-tenant-id=alfa',
    'selected-tenant-id=%',
    'selected-tenant-id=%FF',
  ])(
    'clears an ambiguous or undecodable preference: %s',
    async (preference) => {
      await selectionParity(
        preference,
        {},
        400,
        { error: 'Invalid tenant selection' },
        clearedPreference
      )
    }
  )
  it.each(['', '../other', '%20alfa%20', 'a'.repeat(129)])(
    'preserves validation of the decoded selection: %s',
    async (id) => {
      await selectionParity(`selected-tenant-id=${id}`, {}, 400, {
        error: 'Invalid tenant selection',
      })
    }
  )
  it('accepts the 128-character boundary but clears an unknown membership', async () => {
    await selectionParity(
      undefined,
      { 'x-tenant-id': 'a'.repeat(128) },
      200,
      { selection: null },
      clearedPreference
    )
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks a %s membership using the existing live session cookie',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await selectionParity(
          `selected-tenant-id=${context.alfa.id}`,
          {},
          200,
          { selection: null },
          clearedPreference
        )
        await selectionParity(
          undefined,
          { 'x-tenant-id': context.alfa.id },
          200,
          { selection: null },
          clearedPreference
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('clears selection when the locadora is suspended after login', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'SUSPENDED' },
        })
      )
      await selectionParity(
        `selected-tenant-id=${context.alfa.id}`,
        {},
        200,
        { selection: null },
        clearedPreference
      )
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it.each(namedParityTargets(context, { legacy: 'legacy', api: 'api' }))(
    'preserves writes in %s and consumes their preference cookie in both hosts',
    async (_writer, writer) => {
      const selected = await fetch(`${writer}${selectionPath}`, {
        method: 'POST',
        headers: {
          ...edge,
          Cookie: jars[0]!,
          Origin: edge['x-platform-origin'],
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId: context.alfa.id, role: 'ADMIN' }),
      })
      expect(selected.status).toBe(200)
      expect(await selected.json()).toEqual({
        selection: expected().memberships[0],
      })
      expect(selected.headers.get('set-cookie')).toBe(
        `selected-tenant-id=${context.alfa.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure`
      )
      for (const host of parityTargets(context)) {
        const read = await readSelection(host, cookies(selected, jars[0]!))
        expect(read.status).toBe(200)
        expect(JSON.parse(read.body)).toEqual({
          selection: expected().memberships[0],
        })
        expect(read.cookie).toBeNull()
      }
      const deleted = await fetch(`${writer}${selectionPath}`, {
        method: 'DELETE',
        headers: {
          ...edge,
          Cookie: cookies(selected, jars[0]!),
          Origin: edge['x-platform-origin'],
        },
      })
      expect(deleted.status).toBe(200)
      expect(await deleted.json()).toEqual({ selection: null })
      expect(deleted.headers.get('set-cookie')).toBe(clearedPreference)
      // An explicitly empty cookie keeps its characterized 400 validation;
      // browsers remove it because Max-Age=0 instead of sending this value.
      for (const host of parityTargets(context)) {
        const cleared = await readSelection(host, cookies(deleted, jars[0]!))
        expect(cleared.status).toBe(400)
      }
      await selectionParity(undefined, {}, 200, { selection: null })
    }
  )
  it('keeps HEAD semantics and advertises the installed service methods in OPTIONS', async () => {
    await eachHost(
      (origin) => readSelection(origin, jars[0]!, undefined, {}, 'HEAD'),
      200,
      { cache: 'no-store', vary: selectionVary, cookie: null, allow: null },
      ''
    )
    const options = await readSelection(
      context.api,
      jars[0]!,
      undefined,
      {},
      'OPTIONS'
    )
    expect(options.status).toBe(204)
    expect(options.allow?.split(/,\s*/).sort()).toEqual([
      'DELETE',
      'GET',
      'HEAD',
      'OPTIONS',
      'POST',
    ])
  })
})

async function readAddresses(
  origin: string,
  jar: string,
  headers: Record<string, string>,
  query = '',
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/addresses${query}`, {
    method,
    headers: { Cookie: jar, ...headers },
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
async function addressParity(
  jar: string,
  headers: Record<string, string>,
  status: number,
  body: unknown,
  query = ''
) {
  return eachHost(
    (origin) => readAddresses(origin, jar, headers, query),
    status,
    {
      ...guardedHeaders(typeof body === 'function' ? {} : body),
      cookie: null,
      allow: null,
    },
    body
  )
}

describe(`${context.identity.mode} — customer address read parity`, () => {
  it.each(['alfa', 'bravo'] as const)(
    'preserves full DTO, primary/date ordering and owner isolation in %s',
    async (tenant) => {
      const expectedIds =
        tenant === 'alfa'
          ? [
              context.addresses.alfa[0],
              context.addresses.alfa[2],
              context.addresses.alfa[1],
            ]
          : context.addresses.bravo
      for (const transport of ['header', 'cookie', 'host', 'matching']) {
        const jar =
          transport === 'cookie' || transport === 'matching'
            ? `${jars[0]}; selected-tenant-id=${context[tenant].id}`
            : jars[0]!
        const headers: Record<string, string> =
          transport === 'cookie'
            ? {}
            : transport === 'header'
              ? { 'x-tenant-id': context[tenant].id }
              : transport === 'host'
                ? tenantEdge(context[tenant].slug)
                : {
                    ...tenantEdge(context[tenant].slug),
                    'x-tenant-id': context[tenant].id,
                  }
        await addressParity(
          jar,
          headers,
          200,
          tenant === 'alfa'
            ? alfaAddresses()
            : {
                addresses: [
                  addressRow(
                    context.addresses.bravo[0]!,
                    context.bravo.id,
                    context.identity.users[0]!.id,
                    true,
                    '2026-01-01T00:00:00.000Z'
                  ),
                ],
              }
        )
        expect(expectedIds).toHaveLength(tenant === 'alfa' ? 3 : 1)
      }
    }
  )
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
    'role %s does not expand user ownership within a tenant',
    async (role) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { role } })
        await addressParity(
          jars[0]!,
          { 'x-tenant-id': context.alfa.id },
          200,
          alfaAddresses()
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'CLIENT' },
        })
      }
    }
  )
  it('another authenticated identity in the same tenant sees only its own row', async () => {
    await addressParity(jars[1]!, { 'x-tenant-id': context.bravo.id }, 200, {
      addresses: [
        addressRow(
          context.addresses.otherBravo,
          context.bravo.id,
          context.identity.users[1]!.id,
          true,
          '2026-01-01T00:00:00.000Z'
        ),
      ],
    })
  })
  it('ignores query overrides of user, tenant, role, filters and ordering', async () => {
    const headers = { 'x-tenant-id': context.alfa.id }
    await addressParity(jars[0]!, headers, 200, alfaAddresses())
    await addressParity(
      jars[0]!,
      headers,
      200,
      alfaAddresses(),
      `?tenantId=${context.bravo.id}&userId=${context.identity.users[1]!.id}&role=ADMIN&isPrimary=false&limit=1&orderBy=street`
    )
  })
  it('refuses missing identity before private data', async () => {
    await addressParity('', { 'x-tenant-id': context.alfa.id }, 401, {
      error: 'Authentication required',
    })
  })
  it('does not choose a tenant for a signed-in identity', async () => {
    await addressParity(jars[0]!, {}, 409, { error: 'Select an organization' })
  })
  it('global ADMIN plus an address row does not authorize membership', async () => {
    await addressParity(jars[1]!, { 'x-tenant-id': context.alfa.id }, 403, {
      error: 'Organization access denied',
    })
  })
  it.each(['header-cookie', 'host-header', 'host-cookie'])(
    'refuses conflicting %s candidates',
    async (kind) => {
      const jar =
        kind === 'host-header'
          ? jars[0]!
          : `${jars[0]}; selected-tenant-id=${context.bravo.id}`
      const headers =
        kind === 'header-cookie'
          ? { 'x-tenant-id': context.alfa.id }
          : kind === 'host-header'
            ? { ...tenantEdge(), 'x-tenant-id': context.bravo.id }
            : tenantEdge()
      await addressParity(jar, headers, 400, {
        error: 'Conflicting tenant selection',
      })
    }
  )
  it('ignores a forged edge rather than using it as tenant authorization', async () => {
    await addressParity(
      jars[0]!,
      {
        ...tenantEdge(),
        'x-platform-edge-auth': 'fixture-forged-secret',
      },
      409,
      { error: 'Select an organization' }
    )
  })
  it('refuses a malformed selection cookie', async () => {
    await addressParity(`${jars[0]}; selected-tenant-id=%`, {}, 400, {
      error: 'Invalid tenant selection',
    })
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks a %s membership after login',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await addressParity(jars[0]!, { 'x-tenant-id': context.alfa.id }, 403, {
          error: 'Organization access denied',
        })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('preserves neutral suspended host and explicit tenant refusal', async () => {
    await addressParity(jars[0]!, tenantEdge(context.suspended), 404, {
      error: 'Locadora não encontrada',
    })
    await addressParity(jars[0]!, { 'x-tenant-id': context.suspended }, 403, {
      error: 'Organization access denied',
    })
  })
  it('keeps the empty collection without importing unassigned historic addresses', async () => {
    const id = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await addressParity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        200,
        { addresses: [] }
      )
    } finally {
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
    }
  })
  it('keeps tenant RLS independent of the additional application user predicate', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      expect((await connection.query('SELECT id FROM addresses')).rows).toEqual(
        []
      )
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      const visible = (
        await connection.query('SELECT id FROM addresses ORDER BY id')
      ).rows
      expect(visible.map((row) => row.id).sort()).toEqual(
        [...context.addresses.alfa, context.addresses.otherAlfa].sort()
      )
      expect(
        (
          await connection.query(
            'SELECT id FROM addresses WHERE "tenantId"=$1',
            [context.bravo.id]
          )
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect((await connection.query('SELECT id FROM addresses')).rows).toEqual(
        []
      )
    } finally {
      connection.release()
      await scoped.end()
    }
  })
  it('sanitizes a real storage permission failure in both adapters', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON addresses FROM ${role}`)
      await addressParity(jars[0]!, { 'x-tenant-id': context.alfa.id }, 500, {
        error: 'Erro ao buscar endereços',
      })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON addresses TO ${role}`)
    }
  })
  it('preserves HEAD/OPTIONS parity after installing POST in the service', async () => {
    const headers = { 'x-tenant-id': context.alfa.id }
    await eachHost(
      (origin) => readAddresses(origin, jars[0]!, headers, '', 'HEAD'),
      200,
      { ...plainHeaders, cookie: null, allow: null },
      ''
    )
    await methodContract(
      (origin, method) =>
        readAddresses(
          origin,
          method === 'OPTIONS' ? '' : jars[0]!,
          method === 'OPTIONS' ? {} : headers,
          '',
          method
        ),
      ['GET', 'HEAD', 'OPTIONS', 'POST'],
      frameworkMethodHeaders,
      ['PUT', 'PATCH', 'DELETE']
    )
  })
})
