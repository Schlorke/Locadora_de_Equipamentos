import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  PublicCategoryList,
  PublicEquipmentList,
  PublicQuoteCreated,
  PublicContactAccepted,
} from '@gb-locacoes/contracts/openapi'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createTestTracker,
} from '../helpers/fixtures'

interface Schema {
  $ref?: string
  type?: string
  properties?: Record<string, Schema>
  required?: string[]
}
interface Operation {
  parameters?: Array<{ name: string; in: string; required?: boolean }>
  requestBody?: {
    required?: boolean
    content: Record<string, { schema: Schema }>
  }
  responses: Record<string, unknown>
}
interface OpenAPISpec {
  openapi: string
  paths: Record<string, Record<string, Operation>>
  components: { schemas: Record<string, Schema> }
}
// O banco descartável pelo runtime do backend, o mesmo que a API compartilhada usa (onda 135, E4).
const { prisma } = getDatabaseRuntime()
const tenantA = createTestTracker()
const tenantB = createTestTracker()
let baseUrl: string
let spec: OpenAPISpec
let equipmentA: string
let equipmentB: string
let categoryA: string
let categoryB: string
let clientSequence = 0
const publicUrl = (path: string, slug = tenantA.tenantSlug) =>
  `${baseUrl}/api/${path}?tenantSlug=${encodeURIComponent(slug)}`
const post = (path: string, payload: unknown) =>
  fetch(`${baseUrl}/api/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `198.51.100.${++clientSequence}`,
    },
    body: JSON.stringify(payload),
  })
const quoteInput = (equipmentId = equipmentA) => ({
  tenantSlug: tenantA.tenantSlug,
  customerName: 'Cliente contrato A',
  customerEmail: 'contract@example.test',
  customerPhone: '00000000000',
  deliveryType: 'PICKUP',
  items: [
    {
      equipmentId,
      quantity: 1,
      days: 1,
      startDate: '2030-01-10',
      endDate: '2030-01-10',
    },
  ],
})

describe('API specification and explicit public tenant contracts', () => {
  beforeAll(async () => {
    if (!process.env.TEST_BASE_URL)
      throw new Error(
        'TEST_BASE_URL must identify the required integration server'
      )
    baseUrl = process.env.TEST_BASE_URL
    const health = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2000),
    })
    expect(health.status).toBe(200)
    spec = JSON.parse(
      readFileSync(join(process.cwd(), 'public/openapi.json'), 'utf8')
    )
    categoryA = (
      await createCategory(tenantA, {
        name: 'Categoria da locadora A',
        slug: 'same-category',
      })
    ).id
    categoryB = (
      await createCategory(tenantB, {
        name: 'Categoria da locadora B',
        slug: 'same-category',
      })
    ).id
    equipmentA = (
      await createEquipment(tenantA, categoryA, {
        name: 'Equipamento da locadora A',
        pricePerDay: 100,
        maxStock: 2,
      })
    ).id
    equipmentB = (
      await createEquipment(tenantB, categoryB, {
        name: 'Equipamento da locadora B',
        pricePerDay: 900,
        maxStock: 2,
      })
    ).id
  })
  afterAll(async () => {
    await cleanupTestData(tenantA)
    await cleanupTestData(tenantB)
  })

  describe('OpenAPI specification', () => {
    test('contains a version, real schemas and documented public and administrative endpoints', () => {
      expect(spec.openapi).toMatch(/^3\./)
      for (const path of ['/equipments', '/categories', '/quotes', '/contact'])
        expect(spec.paths[path]).toBeDefined()
      expect(
        Object.keys(spec.paths).some((path) => path.startsWith('/admin/'))
      ).toBe(true)
      for (const name of [
        'PublicTenantQuery',
        'PublicQuoteRequest',
        'PublicContactRequest',
        'PublicApiError',
      ])
        expect(spec.components.schemas[name]?.properties).toBeDefined()
    })
    test('declares required tenantSlug query and concrete success/error responses for catalog', () => {
      for (const path of ['/equipments', '/categories']) {
        const operation = spec.paths[path]!.get!
        expect(operation.parameters).toContainEqual(
          expect.objectContaining({
            name: 'tenantSlug',
            in: 'query',
            required: true,
          })
        )
        for (const status of ['200', '404', '409'])
          expect(operation.responses[status]).toBeDefined()
      }
    })
    test('declares actual quote/contact payloads and durable response statuses', () => {
      for (const [path, schemaName, status] of [
        ['/quotes', 'PublicQuoteRequest', '201'],
        ['/contact', 'PublicContactRequest', '202'],
      ] as const) {
        const operation = spec.paths[path]!.post!
        expect(operation.requestBody?.required).toBe(true)
        expect(
          operation.requestBody?.content['application/json']?.schema.$ref
        ).toBe('#/components/schemas/' + schemaName)
        expect(spec.components.schemas[schemaName]?.required).toContain(
          'tenantSlug'
        )
        for (const code of [status, '400', '404', '409'])
          expect(operation.responses[code]).toBeDefined()
      }
      expect(
        spec.components.schemas.PublicQuoteRequest?.properties
      ).toHaveProperty('customerName')
      expect(
        spec.components.schemas.PublicQuoteRequest?.properties
      ).toHaveProperty('items')
      expect(spec.paths['/contact']!.post!.responses['200']).toBeUndefined()
    })
  })

  describe('Public endpoints with two independent locadoras', () => {
    test('equipment arrays match their schema and exclude the other tenant equipment', async () => {
      for (const [slug, expectedId, excludedId] of [
        [tenantA.tenantSlug, equipmentA, equipmentB],
        [tenantB.tenantSlug, equipmentB, equipmentA],
      ] as const) {
        const response = await fetch(publicUrl('equipments', slug))
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain(
          'application/json'
        )
        const data = PublicEquipmentList.parse(await response.json())
        expect(data).toHaveLength(1)
        expect(data[0]!.id).toBe(expectedId)
        expect(data.map((item) => item.id)).not.toContain(excludedId)
        expect(data[0]!.category?.name).toBe(
          slug === tenantA.tenantSlug
            ? 'Categoria da locadora A'
            : 'Categoria da locadora B'
        )
      }
    })
    test('category arrays are scoped even when both companies use the same slug', async () => {
      for (const [slug, id] of [
        [tenantA.tenantSlug, categoryA],
        [tenantB.tenantSlug, categoryB],
      ] as const) {
        const response = await fetch(publicUrl('categories', slug))
        expect(response.status).toBe(200)
        const data = PublicCategoryList.parse(await response.json())
        expect(data).toHaveLength(1)
        expect(data[0]!.id).toBe(id)
        expect(data[0]!._count?.equipments).toBe(1)
      }
    })
    test('catalog requires a tenant and does not choose another company for an unknown slug', async () => {
      for (const path of ['equipments', 'categories']) {
        expect((await fetch(`${baseUrl}/api/${path}`)).status).toBe(409)
        expect(
          (await fetch(publicUrl(path, 'missing-' + tenantA.tenantSlug))).status
        ).toBe(404)
      }
    })
    test('contact validates required fields only after resolving tenant scope', async () => {
      expect((await post('contact', {})).status).toBe(409)
      const invalid = await post('contact', { tenantSlug: tenantA.tenantSlug })
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toHaveProperty('error')
    })
    test('quote validates required fields only after resolving tenant scope', async () => {
      expect((await post('quotes', {})).status).toBe(409)
      const invalid = await post('quotes', { tenantSlug: tenantA.tenantSlug })
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toHaveProperty('error')
    })
    test('quote rejects an equipment ID from another tenant without creating any quote', async () => {
      const before = await prisma.quote.count({
        where: { tenantId: tenantA.tenantId },
      })
      expect((await post('quotes', quoteInput(equipmentB))).status).toBe(404)
      expect(
        await prisma.quote.count({ where: { tenantId: tenantA.tenantId } })
      ).toBe(before)
    })
    test('quote creation preserves the selected tenant and queues its notification atomically', async () => {
      const response = await post('quotes', quoteInput())
      expect(response.status).toBe(201)
      const data = PublicQuoteCreated.parse(await response.json())
      expect(data.items).toHaveLength(1)
      expect(data.items[0]!.equipmentId).toBe(equipmentA)
      const row = await prisma.quote.findUniqueOrThrow({
        where: { id: data.id },
      })
      expect(row.tenantId).toBe(tenantA.tenantId)
      expect(row.userId).toBeNull()
      expect(
        await prisma.outboxEvent.count({
          where: {
            tenantId: tenantA.tenantId,
            aggregateId: data.id,
            topic: 'quote.created.notify',
          },
        })
      ).toBe(1)
    })
    test('contact accepts durable delivery without claiming that an email was already sent', async () => {
      const response = await post('contact', {
        tenantSlug: tenantB.tenantSlug,
        name: 'Contato locadora B',
        email: 'contact@example.test',
        message: 'Solicitação do teste de contrato',
      })
      expect(response.status).toBe(202)
      const data = PublicContactAccepted.parse(await response.json())
      expect(
        (
          await prisma.quote.findUniqueOrThrow({
            where: { id: data.data.messageId },
          })
        ).tenantId
      ).toBe(tenantB.tenantId)
      expect(
        await prisma.outboxEvent.count({
          where: {
            tenantId: tenantB.tenantId,
            aggregateId: data.data.messageId,
            topic: 'quote.created.notify',
          },
        })
      ).toBe(1)
    })
  })

  describe('Protected endpoints', () => {
    for (const path of ['dashboard', 'equipments', 'quotes'])
      test(`${path} requires authentication even with a tenant selector`, async () => {
        const response = await fetch(`${baseUrl}/api/admin/${path}`, {
          headers: { 'x-tenant-id': tenantA.tenantId },
        })
        expect(response.status).toBe(401)
        expect(await response.json()).toHaveProperty('error')
      })
  })
  test('warm public endpoints respond within the existing five-second budget', async () => {
    for (const path of ['equipments', 'categories']) {
      const started = Date.now()
      const response = await fetch(publicUrl(path))
      expect(response.status).toBe(200)
      expect(Date.now() - started).toBeLessThan(5000)
    }
  })
  test('missing API endpoint retains its JSON error contract', async () => {
    const response = await fetch(`${baseUrl}/api/nonexistent`)
    expect(response.status).toBe(404)
    expect(typeof (await response.json()).error).toBe('string')
  })
  test('successful and missing-scope catalog responses use JSON content type', async () => {
    for (const path of ['equipments', 'categories']) {
      for (const url of [publicUrl(path), `${baseUrl}/api/${path}`])
        expect((await fetch(url)).headers.get('content-type')).toContain(
          'application/json'
        )
    }
  })
})
