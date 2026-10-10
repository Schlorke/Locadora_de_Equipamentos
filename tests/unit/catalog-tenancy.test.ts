import { requireTenantPermission } from '../../apps/services/api/src/host/permissions'
import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
const fixtureDatabase = vi.hoisted(() => ({
  prisma: undefined as unknown,
  pool: undefined as import('pg').Pool | undefined,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-tenant-id': currentTenantId }),
}))
import { NextRequest } from 'next/server'
import { publishTestOrganizations } from '../helpers/public-site'
let currentUserId: string
let currentTenantId: string
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()
  if (!process.env.TEST_DATABASE_URL)
    return { ...actual, getDatabaseRuntime: () => ({ prisma: undefined }) }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const connectionString = requireTestDatabase(process.env)
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({ connectionString, max: 8 })
  fixtureDatabase.pool = pool
  const fixturePrisma = (fixtureDatabase.prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  }))
  fixtureDatabase.prisma = fixturePrisma
  return { ...actual, getDatabaseRuntime: () => ({ prisma: fixturePrisma }) }
})
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  adminApiRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () => ({ user: { id: currentUserId } }),
  }))()),
}))
import * as serviceRoute0 from '../../apps/services/api/src/app/api/categories/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/equipments/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/equipamentos/search/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/categories/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/categories/[id]/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/equipments/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/equipments/[id]/route'
import * as serviceRoute7 from '../../apps/services/api/src/app/api/admin/equipment-units/route'
import * as serviceRoute8 from '../../apps/services/api/src/app/api/admin/equipment-units/[id]/route'
import * as serviceRoute9 from '../../apps/services/api/src/app/api/admin/vehicles/route'
import * as serviceRoute10 from '../../apps/services/api/src/app/api/cart/sync/route'
import * as serviceRoute11 from '../../apps/services/api/src/app/api/cart/merge/route'
import * as serviceRoute12 from '../../apps/services/api/src/app/api/admin/permissions/route'

const HOSTS = [
  [
    'service',
    {
      categories: serviceRoute0.GET,
      equipment: serviceRoute1.GET,
      searchEquipment: serviceRoute2.GET,
      listCategories: serviceRoute3.GET,
      createCategory: serviceRoute3.POST,
      updateCategory: serviceRoute4.PUT,
      deleteCategory: serviceRoute4.DELETE,
      listEquipments: serviceRoute5.GET,
      createEquipment: serviceRoute5.POST,
      getEquipment: serviceRoute6.GET,
      updateEquipment: serviceRoute6.PUT,
      deleteEquipment: serviceRoute6.DELETE,
      listUnits: serviceRoute7.GET,
      createUnit: serviceRoute7.POST,
      readUnit: serviceRoute8.GET,
      updateUnit: serviceRoute8.PATCH,
      deleteUnit: serviceRoute8.DELETE,
      createVehicle: serviceRoute9.POST,
      vehicles: serviceRoute9.GET,
      syncCart: serviceRoute10.POST,
      readCart: serviceRoute10.GET,
      mergeCart: serviceRoute11.POST,
      updatePermissions: serviceRoute12.PUT,
      readPermissions: serviceRoute12.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      categories,
      equipment,
      searchEquipment,
      listCategories,
      createCategory,
      updateCategory,
      deleteCategory,
      listEquipments,
      createEquipment,
      getEquipment,
      updateEquipment,
      deleteEquipment,
      listUnits,
      createUnit,
      readUnit,
      updateUnit,
      deleteUnit,
      createVehicle,
      vehicles,
      syncCart,
      readCart,
      mergeCart,
      updatePermissions,
      readPermissions,
    }
  ) => {
    const prefix = `catalog-test-${randomUUID()}`
    let adminId: string
    let clientId: string
    let operatorId: string
    let tenantA: string
    let tenantB: string
    let categoryA: string
    let categoryB: string
    let equipmentA: string
    let equipmentB: string
    const req = (
      path: string,
      tenantId: string | null = tenantA,
      body?: unknown,
      method = body ? 'POST' : 'GET'
    ) =>
      new NextRequest(`http://localhost${path}`, {
        method,
        headers: {
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'catalog, cart and permissions across independent locadoras',
      () => {
        it('requires an active public tenant for autocomplete and never returns another catalog', async () => {
          expect(
            (await searchEquipment(req('/api/equipamentos/search?q=eq'))).status
          ).toBe(409)
          expect(
            (
              await searchEquipment(
                req('/api/equipamentos/search?tenantSlug=unknown-tenant&q=eq')
              )
            ).status
          ).toBe(404)
          const result = await searchEquipment(
            req(`/api/equipamentos/search?tenantSlug=${prefix}-a&q=eq`)
          )
          expect(result.status).toBe(200)
          const rows = await result.json()
          expect(rows.map((row: { id: string }) => row.id)).toContain(
            equipmentA
          )
          expect(rows.map((row: { id: string }) => row.id)).not.toContain(
            equipmentB
          )
        })
        beforeAll(async () => {
          tenantA = (
            await prisma.organization.create({
              data: { name: prefix, slug: prefix + '-a' },
            })
          ).id
          tenantB = (
            await prisma.organization.create({
              data: { name: prefix, slug: prefix + '-b' },
            })
          ).id
          // Locadoras vivas (S13): a vitrine pública só responde publicada.
          await publishTestOrganizations(prisma, [tenantA, tenantB])
          adminId = (
            await prisma.user.create({
              data: { email: prefix + 'admin@example.test', role: 'CLIENT' },
            })
          ).id
          clientId = (
            await prisma.user.create({
              data: { email: prefix + 'client@example.test', role: 'ADMIN' },
            })
          ).id
          operatorId = (
            await prisma.user.create({
              data: { email: prefix + 'operator@example.test', role: 'ADMIN' },
            })
          ).id
          for (const tenantId of [tenantA, tenantB])
            await prisma.membership.createMany({
              data: [
                { tenantId, userId: adminId, role: 'ADMIN' },
                { tenantId, userId: clientId, role: 'CLIENT' },
                { tenantId, userId: operatorId, role: 'OPERATOR' },
              ],
            })
          categoryA = (
            await prisma.category.create({
              data: {
                tenantId: tenantA,
                name: 'Categoria',
                slug: 'same-category',
              },
            })
          ).id
          categoryB = (
            await prisma.category.create({
              data: {
                tenantId: tenantB,
                name: 'Categoria',
                slug: 'same-category',
              },
            })
          ).id
          equipmentA = (
            await prisma.equipment.create({
              data: {
                tenantId: tenantA,
                categoryId: categoryA,
                name: 'Equipamento A',
                pricePerDay: 10,
                maxStock: 0,
              },
            })
          ).id
          equipmentB = (
            await prisma.equipment.create({
              data: {
                tenantId: tenantB,
                categoryId: categoryB,
                name: 'Equipamento B',
                pricePerDay: 20,
              },
            })
          ).id
          currentUserId = adminId
          currentTenantId = tenantA
        })
        afterAll(async () => {
          if (!tenantA) return
          const where = { tenantId: { in: [tenantA, tenantB] } }
          await prisma.cartItem.deleteMany({ where })
          await prisma.cart.deleteMany({ where })
          await prisma.equipmentUnit.deleteMany({ where })
          await prisma.equipment.deleteMany({ where })
          await prisma.category.deleteMany({ where })
          await prisma.vehicle.deleteMany({ where })
          await prisma.permission.deleteMany({ where })
          await prisma.membership.deleteMany({ where })
          await prisma.user.deleteMany({
            where: { id: { in: [adminId, clientId, operatorId] } },
          })
          await prisma.organization.deleteMany({
            where: { id: { in: [tenantA, tenantB] } },
          })
        })
        it('public catalog requires a slug and returns only its equipment while preserving zero stock', async () => {
          expect((await categories(req('/api/categories', null))).status).toBe(
            409
          )
          expect(
            (await equipment(req('/api/equipments?tenantSlug=unknown', null)))
              .status
          ).toBe(404)
          const resultA = await (
            await equipment(req(`/api/equipments?tenantSlug=${prefix}-a`, null))
          ).json()
          const resultB = await (
            await equipment(req(`/api/equipments?tenantSlug=${prefix}-b`, null))
          ).json()
          expect(resultA.map((item: { id: string }) => item.id)).toEqual([
            equipmentA,
          ])
          expect(resultA[0].maxStock).toBe(0)
          expect(resultB.map((item: { id: string }) => item.id)).toEqual([
            equipmentB,
          ])
          expect(
            (
              await (
                await categories(
                  req(`/api/categories?tenantSlug=${prefix}-a`, null)
                )
              ).json()
            )[0].id
          ).toBe(categoryA)
        })
        it('category names and slugs may repeat across locadoras, but foreign IDs cannot be edited or deleted', async () => {
          currentUserId = adminId
          const body = {
            name: 'Shared category',
            iconColor: '#111111',
            bgColor: '#ffffff',
            fontColor: '#222222',
          }
          expect(
            (await createCategory(req('/api/admin/categories', tenantA, body)))
              .status
          ).toBe(201)
          expect(
            (await createCategory(req('/api/admin/categories', tenantB, body)))
              .status
          ).toBe(201)
          expect(
            (await createCategory(req('/api/admin/categories', tenantA, body)))
              .status
          ).toBe(409)
          expect(
            (
              await updateCategory(
                req('/api/admin/categories/id', tenantA, body, 'PUT'),
                params(categoryB)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await deleteCategory(
                req('/api/admin/categories/id', tenantA, undefined, 'DELETE'),
                params(categoryB)
              )
            ).status
          ).toBe(404)
        })
        it('duplicate category names compare exactly, ignoring case, and never treat _ or % as wildcards', async () => {
          currentUserId = adminId
          const colors = {
            iconColor: '#111111',
            bgColor: '#ffffff',
            fontColor: '#222222',
          }
          const create = async (name: string) =>
            (
              await createCategory(
                req('/api/admin/categories', tenantA, { name, ...colors })
              )
            ).status
          expect(await create('Andaime tubular curinga')).toBe(201)
          expect(await create('Rolo compactador curinga')).toBe(201)
          // Nomes distintos (e slugs distintos) que um ILIKE sem escape casaria.
          expect(await create('Andaime%')).toBe(201)
          expect(await create('R_lo compactador curinga')).toBe(201)
          // O mesmo nome, com outra caixa, continua sendo duplicata.
          expect(await create('ANDAIME TUBULAR CURINGA')).toBe(409)
          expect(await create('r_lo COMPACTADOR curinga')).toBe(409)
          const names = await prisma.category.findMany({
            where: { tenantId: tenantA, name: { contains: 'curinga' } },
            select: { name: true },
          })
          expect(names.map(({ name }) => name).sort()).toEqual([
            'Andaime tubular curinga',
            'R_lo compactador curinga',
            'Rolo compactador curinga',
          ])
        })
        it('equipment endpoints reject category and equipment IDs from another locadora', async () => {
          currentUserId = adminId
          const body = {
            name: 'Novo equipamento',
            description: 'Descrição',
            pricePerDay: 12,
            categoryId: categoryB,
          }
          expect(
            (await createEquipment(req('/api/admin/equipments', tenantA, body)))
              .status
          ).toBe(404)
          expect(
            (
              await getEquipment(
                req('/api/admin/equipments/id', tenantA),
                params(equipmentB)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await updateEquipment(
                req('/api/admin/equipments/id', tenantA, body, 'PUT'),
                params(equipmentA)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await deleteEquipment(
                req('/api/admin/equipments/id', tenantA, undefined, 'DELETE'),
                params(equipmentB)
              )
            ).status
          ).toBe(404)
          const created = await createEquipment(
            req('/api/admin/equipments', tenantA, {
              ...body,
              categoryId: categoryA,
            })
          )
          expect(created.status).toBe(201)
          expect((await created.json()).tenantId).toBe(tenantA)
        })
        it('unit codes and vehicle plates may repeat across locadoras without accepting foreign equipment references', async () => {
          currentUserId = adminId
          expect(
            (
              await createUnit(
                req('/api/admin/equipment-units', tenantA, {
                  equipmentId: equipmentB,
                  uniqueCode: 'foreign',
                })
              )
            ).status
          ).toBe(404)
          const unitA = await createUnit(
            req('/api/admin/equipment-units', tenantA, {
              equipmentId: equipmentA,
              uniqueCode: 'UNIT-001',
            })
          )
          const unitB = await createUnit(
            req('/api/admin/equipment-units', tenantB, {
              equipmentId: equipmentB,
              uniqueCode: 'UNIT-001',
            })
          )
          expect(unitA.status).toBe(201)
          expect(unitB.status).toBe(201)
          expect(
            (
              await updateUnit(
                req(
                  '/api/admin/equipment-units/id',
                  tenantA,
                  { notes: 'changed' },
                  'PATCH'
                ),
                params((await unitB.json()).id)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await createVehicle(
                req('/api/admin/vehicles', tenantA, { plate: 'AAA1A11' })
              )
            ).status
          ).toBe(201)
          expect(
            (
              await createVehicle(
                req('/api/admin/vehicles', tenantB, { plate: 'AAA1A11' })
              )
            ).status
          ).toBe(201)
          const listed = await (
            await vehicles(req('/api/admin/vehicles', tenantA))
          ).json()
          expect(listed.vehicles).toHaveLength(1)
          expect(listed.vehicles[0].tenantId).toBe(tenantA)
        })
        it('admin listings, unit reads and unit deletion never cross locadoras', async () => {
          currentUserId = adminId
          const categoriesA = await (
            await listCategories(req('/api/admin/categories', tenantA))
          ).json()
          const categoryIds = categoriesA.map((row: { id: string }) => row.id)
          expect(categoryIds).toContain(categoryA)
          expect(categoryIds).not.toContain(categoryB)
          expect(
            categoriesA.every(
              (row: { tenantId: string }) => row.tenantId === tenantA
            )
          ).toBe(true)
          const equipmentsA = await (
            await listEquipments(req('/api/admin/equipments', tenantA))
          ).json()
          const equipmentIds = equipmentsA.equipments.map(
            (row: { id: string }) => row.id
          )
          expect(equipmentIds).toContain(equipmentA)
          expect(equipmentIds).not.toContain(equipmentB)
          expect(equipmentsA.pagination.totalItems).toBe(equipmentIds.length)
          const foreignUnit = await prisma.equipmentUnit.create({
            data: {
              tenantId: tenantB,
              equipmentId: equipmentB,
              uniqueCode: 'LIST-B',
            },
          })
          const unitsA = await (
            await listUnits(req('/api/admin/equipment-units', tenantA))
          ).json()
          expect(unitsA.length).toBeGreaterThan(0)
          expect(unitsA.map((row: { id: string }) => row.id)).not.toContain(
            foreignUnit.id
          )
          expect(
            unitsA.every(
              (row: { tenantId: string }) => row.tenantId === tenantA
            )
          ).toBe(true)
          expect(
            (
              await readUnit(
                req('/api/admin/equipment-units/id', tenantA),
                params(foreignUnit.id)
              )
            ).status
          ).toBe(404)
          expect(
            (
              await deleteUnit(
                req(
                  '/api/admin/equipment-units/id',
                  tenantA,
                  undefined,
                  'DELETE'
                ),
                params(foreignUnit.id)
              )
            ).status
          ).toBe(404)
          expect(
            await prisma.equipmentUnit.findUnique({
              where: { id: foreignUnit.id },
            })
          ).not.toBeNull()
          const own = await readUnit(
            req('/api/admin/equipment-units/id', tenantB),
            params(foreignUnit.id)
          )
          expect(own.status).toBe(200)
          expect((await own.json()).equipment.id).toBe(equipmentB)
        })
        it('a global identity gets separate carts, server prices and rollback for a foreign equipment item', async () => {
          currentUserId = clientId
          const itemA = {
            equipmentId: equipmentA,
            quantity: 2,
            days: 2,
            pricePerDay: 0.01,
            finalPrice: 0.01,
          }
          const itemB = {
            equipmentId: equipmentB,
            quantity: 1,
            days: 1,
            pricePerDay: 0.01,
          }
          expect(
            (await syncCart(req('/api/cart/sync', tenantA, { items: [itemA] })))
              .status
          ).toBe(200)
          expect(
            (await syncCart(req('/api/cart/sync', tenantB, { items: [itemB] })))
              .status
          ).toBe(200)
          const cartA = await (
            await readCart(req('/api/cart/sync', tenantA))
          ).json()
          const cartB = await (
            await readCart(req('/api/cart/sync', tenantB))
          ).json()
          expect(cartA.id).not.toBe(cartB.id)
          expect(Number(cartA.items[0].pricePerDay)).toBe(10)
          expect(Number(cartA.items[0].finalPrice)).toBe(40)
          expect(
            (await syncCart(req('/api/cart/sync', tenantA, { items: [itemB] })))
              .status
          ).toBe(404)
          expect(
            (await (await readCart(req('/api/cart/sync', tenantA))).json())
              .items[0].equipmentId
          ).toBe(equipmentA)
        })
        it('concurrent cart merges stay atomic and do not create duplicate items', async () => {
          currentUserId = clientId
          const body = {
            localCartItems: [{ equipmentId: equipmentA, quantity: 1, days: 3 }],
          }
          const responses = await Promise.all([
            mergeCart(req('/api/cart/merge', tenantA, body)),
            mergeCart(req('/api/cart/merge', tenantA, body)),
          ])
          expect(responses.map((response) => response.status)).toEqual([
            200, 200,
          ])
          const cart = await (
            await readCart(req('/api/cart/sync', tenantA))
          ).json()
          expect(cart.items).toHaveLength(1)
          expect(Number(cart.items[0].finalPrice)).toBe(30)
          currentUserId = adminId
          expect(
            (await syncCart(req('/api/cart/sync', tenantA, { items: [] })))
              .status
          ).toBe(403)
        })
        it('permission replacement is tenant-specific, rejects mixed roles, and identity role never grants access', async () => {
          currentUserId = adminId
          const permission = {
            role: 'OPERATOR',
            module: 'EQUIPMENTS',
            action: 'READ',
          }
          expect(
            (
              await updatePermissions(
                req(
                  '/api/admin/permissions',
                  tenantA,
                  { permissions: [permission] },
                  'PUT'
                )
              )
            ).status
          ).toBe(200)
          expect(
            (
              await updatePermissions(
                req(
                  '/api/admin/permissions',
                  tenantB,
                  { permissions: [{ ...permission, module: 'LOGISTICS' }] },
                  'PUT'
                )
              )
            ).status
          ).toBe(200)
          expect(
            (
              await updatePermissions(
                req(
                  '/api/admin/permissions',
                  tenantA,
                  {
                    permissions: [
                      permission,
                      { ...permission, role: 'CLIENT' },
                    ],
                  },
                  'PUT'
                )
              )
            ).status
          ).toBe(400)
          expect(
            (
              await (
                await readPermissions(req('/api/admin/permissions', tenantB))
              ).json()
            ).permissions[0].module
          ).toBe('LOGISTICS')
          currentUserId = operatorId
          expect(
            (
              await requireTenantPermission(
                req('/api/admin/equipments', tenantA),
                'EQUIPMENTS',
                'READ'
              )
            ).ok
          ).toBe(true)
          expect(
            (
              await requireTenantPermission(
                req('/api/admin/equipments', tenantB),
                'EQUIPMENTS',
                'READ'
              )
            ).ok
          ).toBe(false)
          currentUserId = clientId
          currentTenantId = tenantA
          // F: the retired root-only requireAdmin facade assertion is superseded by the real createUnit CLIENT=403 assertion immediately below.
          expect(
            (
              await createUnit(
                req('/api/admin/equipment-units', tenantA, {
                  equipmentId: equipmentA,
                  uniqueCode: 'forbidden',
                })
              )
            ).status
          ).toBe(403)
        })
      }
    )
  }
)

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = { prisma, testPool: requireFixturePool() }
  await database.prisma.$disconnect()
  await database.testPool.end()
})

const prisma = getDatabaseRuntime().prisma
function requireFixturePool() {
  const pool = fixtureDatabase.pool
  if (!pool) throw new Error('Owned fixture pool was not initialized')
  return pool
}
