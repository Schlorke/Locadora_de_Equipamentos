const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  if (!process.env.TEST_DATABASE_URL) return { prisma: {} }
  const { requireTestDatabase } = await import('../helpers/test-database')
  const { Pool } = await import('pg')
  const { PrismaClient } = await import('@prisma/client')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  fPreparedDatabase.pool = pool
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
  }
}
import { getDatabaseRuntime as getFPreparedDatabaseRuntime } from '@gb-locacoes/backend/runtime'
/**
 * Achado 2 da revisão com linhas reais (banco descartável): o cliente da
 * locadora A tem sessão em `a.<raiz>`; um script de `b.<raiz>` (mesmo site)
 * dispara `fetch('https://a.<raiz>/api/cart/sync', { method: 'POST',
 * credentials: 'include', body: '{"items":[]}' })` como `text/plain`. A borda
 * de A e a sessão formam o principal, mas a origem não é a do host: nada muda
 * no banco. A mesma requisição vinda de `a.<raiz>` grava (controle positivo).
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const state = vi.hoisted(() => ({ userId: null as string | null }))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))

import { NextRequest } from 'next/server'
// As fixtures (tests/helpers/fixtures.ts) leem o banco pelo runtime do backend (onda 135, E4): o mesmo cliente que a
// composição simulada do runtime fornece, guardado no momento da criação (sem import cruzado entre os dublês).
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})
const { prisma } = getFPreparedDatabaseRuntime()
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createTestTracker,
  createUser,
  ensureTestTenant,
} from '../helpers/fixtures'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade da raiz foi retirada no bloco F.
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () =>
      state.userId ? { user: { id: state.userId } } : null,
  }))()),
}))

import * as serviceRoute0 from '../../apps/services/api/src/app/api/cart/sync/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/cart/merge/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/addresses/route'

import * as serviceRoute3 from '../../apps/services/api/src/app/api/addresses/[id]/route'

const HOSTS = [
  [
    'service',
    {
      cartSync: serviceRoute0.POST,
      cartMerge: serviceRoute1.POST,
      createAddress: serviceRoute2.POST,
      deleteAddress: serviceRoute3.DELETE,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { cartSync, cartMerge, createAddress, deleteAddress }) => {
    const SECRET = 'edge-secret-same-origin-db-0123456789'
    const ROOT = 'plataforma.test'
    const API = 'https://backend.internal'

    describe.skipIf(!process.env.TEST_DATABASE_URL)(
      'a sibling tenant origin cannot mutate the client data of A (disposable database)',
      () => {
        const trackerA = createTestTracker()
        const trackerB = createTestTracker()
        const originA = `https://${trackerA.tenantSlug}.${ROOT}`
        const originB = `https://${trackerB.tenantSlug}.${ROOT}`
        const hostA = {
          'x-platform-edge-auth': SECRET,
          'x-platform-host-kind': 'tenant',
          'x-platform-tenant-slug': trackerA.tenantSlug,
          'x-platform-origin': originA,
        }
        const fromA = {
          ...hostA,
          origin: originA,
          'sec-fetch-site': 'same-origin',
          'content-type': 'application/json',
        }
        const fromB = {
          ...hostA,
          origin: originB,
          'sec-fetch-site': 'same-site',
          'content-type': 'text/plain;charset=UTF-8',
        }
        let clientId = ''
        let equipmentId = ''

        const send = (
          method: string,
          path: string,
          headers: Record<string, string>,
          body?: unknown
        ) =>
          new NextRequest(API + path, {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          })
        const cartItems = () =>
          prisma.cartItem.findMany({
            where: { tenantId: trackerA.tenantId },
            select: { equipmentId: true, quantity: true, days: true },
          })
        const addresses = () =>
          prisma.address.count({ where: { tenantId: trackerA.tenantId } })
        const address = {
          street: 'Rua A',
          number: '1',
          neighborhood: 'Centro',
          city: 'Curitiba',
          state: 'PR',
          zipCode: '80000-000',
        }

        beforeAll(async () => {
          await ensureTestTenant(trackerA)
          await ensureTestTenant(trackerB)
          clientId = (await createUser(trackerA, { role: 'CLIENT' })).id
          equipmentId = (
            await createEquipment(trackerA, (await createCategory(trackerA)).id)
          ).id
        })
        beforeEach(() => {
          vi.stubEnv('PLATFORM_ENV', 'staging')
          vi.stubEnv('VERCEL_ENV', '')
          vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
          vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
          vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
          state.userId = clientId
        })
        afterAll(async () => {
          vi.unstubAllEnvs()
          await prisma.cartItem.deleteMany({
            where: { tenantId: trackerA.tenantId },
          })
          await prisma.cart.deleteMany({
            where: { tenantId: trackerA.tenantId },
          })
          await cleanupTestData(trackerB)
          await cleanupTestData(trackerA)
        })

        it('cart: the sibling origin cannot empty or merge into the cart', async () => {
          const item = { equipmentId, quantity: 1, days: 2 }
          const seeded = await cartSync(
            send('POST', '/api/cart/sync', fromA, { items: [item] })
          )
          expect(seeded.status).toBe(200)
          expect(await cartItems()).toEqual([item])

          const emptied = await cartSync(
            send('POST', '/api/cart/sync', fromB, { items: [] })
          )
          expect(emptied.status).toBe(403)
          const merged = await cartMerge(
            send('POST', '/api/cart/merge', fromB, {
              localCartItems: [{ equipmentId, quantity: 5, days: 9 }],
            })
          )
          expect(merged.status).toBe(403)
          expect(await cartItems()).toEqual([item])

          // Controle positivo: a mesma troca vinda do próprio host grava.
          const replaced = await cartSync(
            send('POST', '/api/cart/sync', fromA, { items: [] })
          )
          expect(replaced.status).toBe(200)
          expect(await cartItems()).toEqual([])
        })

        it('addresses: the sibling origin cannot create or delete an address', async () => {
          const before = await addresses()
          expect(
            (
              await createAddress(
                send('POST', '/api/addresses', fromB, address)
              )
            ).status
          ).toBe(403)
          expect(await addresses()).toBe(before)

          const created = await createAddress(
            send('POST', '/api/addresses', fromA, address)
          )
          expect(created.status).toBe(201)
          const { address: row } = (await created.json()) as {
            address: { id: string }
          }
          expect(await addresses()).toBe(before + 1)

          const params = { params: Promise.resolve({ id: row.id }) }
          expect(
            (
              await deleteAddress(
                send('DELETE', `/api/addresses/${row.id}`, fromB),
                params
              )
            ).status
          ).toBe(403)
          expect(await addresses()).toBe(before + 1)
          expect(
            (
              await deleteAddress(
                send('DELETE', `/api/addresses/${row.id}`, fromA),
                { params: Promise.resolve({ id: row.id }) }
              )
            ).status
          ).toBe(200)
          expect(await addresses()).toBe(before)
        })
      }
    )
  }
)

// Close the fixture-created Prisma and Pool after original row cleanup.
afterAll(async () => {
  if (!fPreparedDatabase.pool) return
  try {
    await getFPreparedDatabaseRuntime().prisma.$disconnect()
  } finally {
    await fPreparedDatabase.pool.end()
  }
})
