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
import { randomUUID } from 'node:crypto'
import { PrismaClient, type Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity')
const hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const member = randomUUID(),
  integrations = [randomUUID(), randomUUID(), randomUUID()]
const path = 'integrations/melhor-envio/calculate'
const merchant = [
  ['GET', 'admin/google-merchant/status'],
  ['POST', 'admin/google-merchant/sync'],
  ['POST', 'admin/google-merchant/products/unknown'],
  ['DELETE', 'admin/google-merchant/products/unknown'],
] as const
const unavailable = {
  success: false,
  configured: false,
  error: 'Configure uma integração Merchant isolada por locadora',
  code: 'TENANT_MERCHANT_ADAPTER_UNAVAILABLE',
}
const input = {
  from: { postal_code: '01001-000' },
  to: { postal_code: '02002-000' },
  products: [
    {
      id: context.alfa.equipmentIds[0]!,
      width: 10,
      height: 10,
      length: 10,
      weight: 2,
    },
  ],
} as const
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[59]!,
}
let cookie = '',
  clientCookie = ''
async function request(
  host: string,
  method = 'POST',
  endpoint = path,
  body: unknown = input,
  headers: Record<string, string> = {}
) {
  const r = await fetch(`${host}/api/${endpoint}`, {
    method,
    headers: {
      ...edge,
      Origin: edge['x-platform-origin'],
      Cookie: cookie,
      'x-tenant-id': context.alfa.id,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(method !== 'GET'
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  })
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get('set-cookie'),
  }
}
async function providerCalls() {
  return (await (
    await fetch(context.shippingOrigin + '/__fixture/requests')
  ).json()) as Array<{
    path: string
    method: string
    authorization: string
    userAgent: string
    providerHost: string
    body: unknown
  }>
}
async function reset() {
  await prisma.tenantIntegration.deleteMany({
    where: { id: { in: integrations } },
  })
  await prisma.tenantIntegration.createMany({
    data: [
      {
        id: integrations[0]!,
        tenantId: context.alfa.id,
        provider: 'MELHOR_ENVIO',
        credentialsRef: 'env:LOCADORA_INTEGRATION_SHIPPING_PARITY',
      },
      {
        id: integrations[1]!,
        tenantId: context.bravo.id,
        provider: 'MELHOR_ENVIO',
        credentialsRef: 'env:LOCADORA_INTEGRATION_SHIPPING_FOREIGN',
      },
    ],
  })
  await withTestPlatformTransaction(prisma, async (tx) =>
    tx.organization.update({
      where: { id: context.alfa.id },
      data: { postalCode: '01001000', status: 'ACTIVE' },
    })
  )
  await prisma.organization.update({
    where: { id: context.bravo.id },
    data: { postalCode: '03003000' },
  })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await fetch(context.shippingOrigin + '/__fixture/requests', {
    method: 'DELETE',
  })
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
    },
  })
})
beforeEach(reset)
afterAll(async () => {
  await prisma.tenantIntegration.deleteMany({
    where: { id: { in: integrations } },
  })
  await prisma.membership.deleteMany({ where: { id: member } })
  await prisma.$disconnect()
  await pool.end()
})
describe('shipping and quarantined Merchant over both production HTTP hosts', () => {
  it.each([['POST', path] as const, ...merchant])(
    '%s %s preserves anonymous 401 before malformed input',
    async (method, endpoint) => {
      for (const host of hosts)
        expect(
          (await request(host, method, endpoint, '{', { Cookie: '' })).status
        ).toBe(401)
      expect(await providerCalls()).toEqual([])
    }
  )
  it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'] as Role[])(
    'active %s can quote shipping but cannot use Merchant',
    async (role) => {
      await prisma.membership.update({ where: { id: member }, data: { role } })
      for (const host of hosts) {
        expect((await request(host)).status).toBe(200)
        for (const [method, endpoint] of merchant)
          expect(await request(host, method, endpoint, '{')).toMatchObject({
            status: 403,
            body: { error: 'Forbidden' },
          })
      }
      expect(await providerCalls()).toHaveLength(hosts.length)
    }
  )
  it('accepts the real client membership for freight', async () => {
    for (const host of hosts)
      expect(
        (await request(host, 'POST', path, input, { Cookie: clientCookie }))
          .status
      ).toBe(200)
  })
  it('revoked or suspended access does not call a provider', async () => {
    await prisma.membership.update({
      where: { id: member },
      data: { status: 'REVOKED' },
    })
    for (const host of hosts)
      for (const [method, endpoint] of [['POST', path] as const, ...merchant])
        expect((await request(host, method, endpoint, '{')).status).toBe(403)
    await prisma.membership.update({
      where: { id: member },
      data: { status: 'ACTIVE' },
    })
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'SUSPENDED' },
      })
    )
    for (const host of hosts) expect((await request(host)).status).toBe(403)
    expect(await providerCalls()).toEqual([])
  })
  it.each([
    ['POST', path] as const,
    ...merchant.filter(([method]) => method !== 'GET'),
  ])(
    '%s %s refuses sibling-origin before input/effects',
    async (method, endpoint) => {
      for (const host of hosts)
        expect(
          (
            await request(host, method, endpoint, '{', {
              Origin: 'https://bravo.platform.test',
            })
          ).status
        ).toBe(403)
      expect(await providerCalls()).toEqual([])
    }
  )
  it.each(merchant)(
    '%s %s preserves explicit Merchant 503 without provider effects',
    async (method, endpoint) => {
      for (const host of hosts)
        expect(await request(host, method, endpoint, '{')).toEqual({
          status: 503,
          body: unavailable,
          cookie: null,
        })
      expect(await providerCalls()).toEqual([])
    }
  )
  it('normalizes payload and preserves identical DTO/quantity without changing equipment', async () => {
    const before = await prisma.equipment.findUniqueOrThrow({
      where: { id: input.products[0].id },
    })
    const data = {
      ...input,
      from: { ...input.from, ignored: 'stripped' },
      products: [
        { ...input.products[0], tenantId: context.bravo.id },
        { ...input.products[0], quantity: 3, insurance_value: 0 },
      ],
    }
    for (const host of hosts)
      expect(await request(host, 'POST', path, data)).toEqual({
        status: 200,
        cookie: null,
        body: {
          shippingOptions: [
            {
              id: 1,
              name: 'Local',
              company: 'Carrier',
              price: 12.5,
              deliveryTime: '4 dias úteis',
              estimatedDays: 4,
            },
          ],
          chargeableWeight: 8,
        },
      })
    // Uma chamada ao provedor por host da rodada (onda 135, B2).
    expect(await providerCalls()).toEqual(
      Array.from({ length: hosts.length }, () => ({
        path: '/api/v2/me/shipment/calculate',
        method: 'POST',
        authorization: 'Bearer local-shipping-parity-key',
        userAgent: 'Fixture (shipping@example.test)',
        providerHost: 'sandbox.melhorenvio.com.br',
        body: {
          from: { postal_code: '01001000' },
          to: { postal_code: '02002000' },
          products: [
            { ...input.products[0], quantity: 1 },
            { ...input.products[0], quantity: 3, insurance_value: 0 },
          ],
        },
      }))
    )
    expect(
      await prisma.equipment.findUniqueOrThrow({
        where: { id: input.products[0].id },
      })
    ).toEqual(before)
  })
  it('uses the selected company credential and origin in production mode, never company A', async () => {
    const data = {
      ...input,
      from: { postal_code: '03003000' },
      products: [{ ...input.products[0], id: context.bravo.equipmentIds[0]! }],
    }
    for (const host of hosts)
      expect(
        (
          await request(host, 'POST', path, data, {
            'x-tenant-id': context.bravo.id,
          })
        ).status
      ).toBe(200)
    const calls = await providerCalls()
    expect(calls).toHaveLength(hosts.length)
    for (const call of calls)
      expect(call).toMatchObject({
        providerHost: 'melhorenvio.com.br',
        authorization: 'Bearer local-shipping-foreign-key',
        userAgent: 'Foreign (shipping@example.test)',
      })
  })
  it.each([
    { label: 'foreign-tenant', id: context.bravo.equipmentIds[0]! },
    { label: 'unassigned', id: context.unassignedEquipment },
    { label: 'unknown', id: randomUUID() },
  ])('product $label stays 404', async ({ id }) => {
    await prisma.tenantIntegration.delete({ where: { id: integrations[0] } })
    for (const host of hosts)
      expect(
        await request(host, 'POST', path, {
          ...input,
          products: [{ ...input.products[0], id }],
        })
      ).toMatchObject({
        status: 404,
        body: { error: 'Equipamento não encontrado' },
      })
    expect(await providerCalls()).toEqual([])
  })
  it.each([
    'missing',
    'disabled',
    'duplicate',
    'no-postal',
    'vault-unconfigured',
    'empty-key',
    'invalid-user-agent',
  ])('configuration %s preserves 503 without provider', async (mode) => {
    if (mode === 'missing')
      await prisma.tenantIntegration.delete({ where: { id: integrations[0] } })
    if (mode === 'disabled')
      await prisma.tenantIntegration.update({
        where: { id: integrations[0] },
        data: { status: 'DISABLED' },
      })
    if (mode === 'duplicate')
      await prisma.tenantIntegration.create({
        data: {
          id: integrations[2]!,
          tenantId: context.alfa.id,
          provider: 'MELHOR_ENVIO',
          credentialsRef: 'env:LOCADORA_INTEGRATION_SHIPPING_PARITY',
          externalAccountId: 'duplicate',
        },
      })
    if (mode === 'no-postal')
      await prisma.organization.update({
        where: { id: context.alfa.id },
        data: { postalCode: null },
      })
    if (
      ['vault-unconfigured', 'empty-key', 'invalid-user-agent'].includes(mode)
    )
      await prisma.tenantIntegration.update({
        where: { id: integrations[0] },
        data: {
          credentialSource: mode === 'vault-unconfigured' ? 'VAULT' : 'ENV_REF',
          credentialsRef:
            mode === 'vault-unconfigured'
              ? null
              : mode === 'empty-key'
                ? 'env:LOCADORA_INTEGRATION_SHIPPING_EMPTY'
                : 'env:LOCADORA_INTEGRATION_SHIPPING_BAD_AGENT',
        },
      })
    for (const host of hosts)
      expect(await request(host)).toMatchObject({
        status: 503,
        body: {
          error: [
            'vault-unconfigured',
            'empty-key',
            'invalid-user-agent',
          ].includes(mode)
            ? 'Credenciais de frete da locadora indisponíveis'
            : 'Frete da locadora não configurado',
        },
      })
    expect(await providerCalls()).toEqual([])
  })
  it('rejects a literal credential reference in the database without changing the integration or reaching a provider', async () => {
    const where = { id: integrations[0]! }
    const before = await prisma.tenantIntegration.findUniqueOrThrow({ where })
    await expect(
      prisma.tenantIntegration.update({
        where,
        data: { credentialsRef: 'invalid-reference' },
      })
    ).rejects.toThrow(/tenant_integrations_credential_source/)
    expect(await prisma.tenantIntegration.findUniqueOrThrow({ where })).toEqual(
      before
    )
    expect(await providerCalls()).toEqual([])
  })
  it.each([
    ['strict body', { ...input, tenantId: context.bravo.id }],
    ['origin postal', { ...input, from: { postal_code: '99999999' } }],
  ])('%s stays 400', async (_name, data) => {
    for (const host of hosts)
      expect((await request(host, 'POST', path, data)).status).toBe(400)
    expect(await providerCalls()).toEqual([])
  })
  it('malformed JSON stays generic 502, not a new validation contract', async () => {
    for (const host of hosts)
      expect(await request(host, 'POST', path, '{')).toMatchObject({
        status: 502,
        body: { error: 'Não foi possível consultar o frete' },
      })
    expect(await providerCalls()).toEqual([])
  })
  it.each([
    ['10000001', 'Cotação indisponível no provedor'],
    ['10000002', 'Não foi possível consultar o frete'],
    ['10000003', 'Resposta de frete inválida'],
    ['10000004', 'Não foi possível consultar o frete'],
    ['10000005', 'Não foi possível consultar o frete'],
  ])(
    'provider failure %s keeps sanitized envelope and does not follow redirects',
    async (postal_code, error) => {
      for (const host of hosts)
        expect(
          await request(host, 'POST', path, { ...input, to: { postal_code } })
        ).toMatchObject({ status: 502, body: { error } })
      const calls = await providerCalls()
      expect(calls).toHaveLength(hosts.length)
      expect(
        calls.every((call) => call.path === '/api/v2/me/shipment/calculate')
      ).toBe(true)
    }
  )
  it('preserves zero custom values, drops invalid peers and chooses volumetric weight', async () => {
    const data = {
      ...input,
      to: { postal_code: '10000006' },
      products: [{ ...input.products[0], length: 100, quantity: 3 }],
    }
    for (const host of hosts)
      expect(await request(host, 'POST', path, data)).toMatchObject({
        status: 200,
        body: {
          shippingOptions: [
            {
              id: 1,
              name: 'Local',
              company: 'Carrier',
              price: 0,
              deliveryTime: '0 dias úteis',
              estimatedDays: 0,
            },
          ],
          chargeableWeight: 30,
        },
      })
  })
  it('keeps empty options as a successful provider result', async () => {
    for (const host of hosts)
      expect(
        await request(host, 'POST', path, {
          ...input,
          to: { postal_code: '10000007' },
        })
      ).toMatchObject({
        status: 200,
        body: { shippingOptions: [], chargeableWeight: 2 },
      })
  })
  it('aborts at the existing 12-second deadline in both real servers', async () => {
    for (const host of hosts) {
      const began = Date.now()
      expect(
        await request(host, 'POST', path, {
          ...input,
          to: { postal_code: '10000008' },
        })
      ).toMatchObject({
        status: 502,
        body: { error: 'Não foi possível consultar o frete' },
      })
      expect(Date.now() - began).toBeGreaterThanOrEqual(11000)
      expect(Date.now() - began).toBeLessThan(19000)
    }
  }, 35000)
  it('runtime SQL hides foreign equipment while integration lookup uses the explicit tenant filter', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl }),
      client = await runtime.connect()
    try {
      const role = await client.query(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user'
      )
      expect(role.rows).toEqual([{ rolsuper: false, rolbypassrls: false }])
      const force = await client.query(
        "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname = 'equipments'"
      )
      expect(force.rows).toHaveLength(1)
      expect(force.rows.every((row) => row.relforcerowsecurity)).toBe(true)
      await client.query('BEGIN')
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      expect(
        (
          await client.query(
            'SELECT id FROM equipments WHERE id=ANY($1::text[])',
            [[context.bravo.equipmentIds[0], context.unassignedEquipment]]
          )
        ).rows
      ).toEqual([])
      expect(
        (
          await client.query(
            'SELECT id FROM tenant_integrations WHERE id=ANY($1::text[]) AND "tenantId"=$2',
            [integrations, context.alfa.id]
          )
        ).rows
      ).toEqual([{ id: integrations[0] }])
    } finally {
      await client.query('ROLLBACK')
      client.release()
      await runtime.end()
    }
  })
  it('database failures retain the original generic 502 with no outbound request', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl })
    let role: string
    try {
      role = (await runtime.query('SELECT current_user AS role')).rows[0].role
    } finally {
      await runtime.end()
    }
    if (!/^api_parity_[a-f0-9]+$/.test(role))
      throw new Error('Unexpected fixture role')
    await alterSharedAcl(
      pool,
      `REVOKE SELECT ON tenant_integrations FROM ${role}`
    )
    try {
      for (const host of hosts)
        expect(await request(host)).toMatchObject({
          status: 502,
          body: { error: 'Não foi possível consultar o frete' },
        })
      expect(await providerCalls()).toEqual([])
    } finally {
      await alterSharedAcl(
        pool,
        `GRANT SELECT ON tenant_integrations TO ${role}`
      )
    }
  })
})
