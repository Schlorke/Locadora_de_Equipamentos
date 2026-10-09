import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/prisma', async () => {
  if (!process.env.TEST_DATABASE_URL) return { prisma: undefined }
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 12,
  })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () => null,
}))
import { prisma } from '@/lib/prisma'
import {
  AddressInputSchema,
  AddressPatchSchema,
} from '@gb-locacoes/contracts/addresses'
// Contraparte da API compartilhada (onda 135, B5): o mesmo serviço de endereços montado pelo serviço
// (`apps/services/api/src/host/customers.ts`), sobre o mesmo banco descartável pelo runtime do backend.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
}))
import * as legacyAddresses from '@/lib/customer-addresses'
import {
  createAddress as serviceCreateAddress,
  listAddresses as serviceListAddresses,
  updateAddress as serviceUpdateAddress,
  deleteAddress as serviceDeleteAddress,
} from '../../apps/services/api/src/host/customers'
const { AddressNotFound } = legacyAddresses
const HOSTS = [
  ['legacy root', legacyAddresses],
  [
    'service',
    {
      createAddress: serviceCreateAddress,
      listAddresses: serviceListAddresses,
      updateAddress: serviceUpdateAddress,
      deleteAddress: serviceDeleteAddress,
    },
  ],
] as const
describe.skipIf(!process.env.TEST_DATABASE_URL).each(HOSTS)(
  '%s: Customer addresses separated by locadora',
  (_host, { createAddress, listAddresses, updateAddress, deleteAddress }) => {
    const tenantA = 'address-a-' + randomUUID(),
      tenantB = 'address-b-' + randomUUID()
    let userId: string
    const principal = (tenantId: string) => ({
      tenantId,
      userId,
      membershipId: 'fixture-member',
      role: 'CLIENT' as const,
    })
    const input = {
      street: 'Test street',
      number: '1',
      neighborhood: 'Test neighborhood',
      city: 'Test city',
      state: 'SP',
      zipCode: '01001000',
    }
    beforeAll(async () => {
      await prisma.organization.createMany({
        data: [
          { id: tenantA, slug: tenantA, name: 'A' },
          { id: tenantB, slug: tenantB, name: 'B' },
        ],
      })
      const user = await prisma.user.create({
        data: { email: tenantA + '@example.test' },
      })
      userId = user.id
    })
    afterAll(async () => {
      await prisma.address.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      })
      await prisma.user.delete({ where: { id: userId } })
      await prisma.organization.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      })
    })
    it('serializes concurrent primary selection and does not unset primary in another locadora', async () => {
      await createAddress(principal(tenantB), input)
      await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          createAddress(principal(tenantA), {
            ...input,
            number: String(index),
            isPrimary: true,
          })
        )
      )
      expect(
        (await listAddresses(principal(tenantA))).filter((row) => row.isPrimary)
      ).toHaveLength(1)
      expect(
        (await listAddresses(principal(tenantB))).filter((row) => row.isPrimary)
      ).toHaveLength(1)
      await expect(
        prisma.address.create({
          data: { ...input, tenantId: tenantA, userId, isPrimary: true },
        })
      ).rejects.toThrow()
    })
    it('rejects a foreign address even when the same identity belongs to both locadoras', async () => {
      const address = (await listAddresses(principal(tenantB)))[0]!
      await expect(
        updateAddress(principal(tenantA), address.id, { city: 'Spoof' })
      ).rejects.toBeInstanceOf(AddressNotFound)
      await expect(
        deleteAddress(principal(tenantA), address.id)
      ).rejects.toBeInstanceOf(AddressNotFound)
      expect((await listAddresses(principal(tenantB)))[0]!.city).toBe(
        input.city
      )
    })
    it('deleting a secondary address preserves the selected primary; deleting primary promotes one remaining address', async () => {
      const before = await listAddresses(principal(tenantA))
      const primary = before.find((row) => row.isPrimary)!,
        secondary = before.find((row) => !row.isPrimary)!
      await deleteAddress(principal(tenantA), secondary.id)
      expect(
        (await listAddresses(principal(tenantA))).find((row) => row.isPrimary)!
          .id
      ).toBe(primary.id)
      await deleteAddress(principal(tenantA), primary.id)
      expect(
        (await listAddresses(principal(tenantA))).filter((row) => row.isPrimary)
      ).toHaveLength(1)
    })
    it('public input accepts only address fields and validates partial edits without Prisma relations', () => {
      const parsed = AddressInputSchema.parse({
        ...input,
        state: 'sp',
        userId: 'foreign',
        tenantId: tenantB,
        user: { connect: { id: 'foreign' } },
      })
      expect(parsed).toEqual(input)
      expect(AddressPatchSchema.safeParse({ street: '' }).success).toBe(false)
      expect(
        AddressInputSchema.safeParse({ ...input, zipCode: 'bad' }).success
      ).toBe(false)
    })
  }
)
// O cliente e o pool do banco descartável fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  await prisma.$disconnect()
  const mocked = (await import('@/lib/prisma')) as unknown as {
    testPool: { end(): Promise<void> }
  }
  await mocked.testPool.end()
})
