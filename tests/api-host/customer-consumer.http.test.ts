import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createCustomerApi } from '../../packages/frontend/src/entities/cliente/api/customer-api'
import { namedParityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const userId = context.identity.users[0]!.id
const marker = `customer-consumer-${randomUUID()}`
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[62]!,
}
let jar = ''
let profiles: Awaited<ReturnType<typeof prisma.clientProfile.findMany>> = []
let addresses: Awaited<ReturnType<typeof prisma.address.findMany>> = []
const profileIds: string[] = []
const addressIds: string[] = []
beforeAll(async () => {
  profiles = await prisma.clientProfile.findMany({ where: { userId } })
  addresses = await prisma.address.findMany({ where: { userId } })
  for (const tenant of [context.alfa, context.bravo]) {
    if (!profiles.some((profile) => profile.tenantId === tenant.id)) {
      const row = await prisma.clientProfile.create({
        data: {
          tenantId: tenant.id,
          userId,
          name: marker,
          email: 'consumer@example.test',
          company: tenant.slug,
        },
      })
      profileIds.push(row.id)
    }
  }
  jar = await signInParityUser(context, edge, 0)
})
afterAll(async () => {
  await prisma.address.deleteMany({ where: { id: { in: addressIds } } })
  await prisma.address.updateMany({
    where: { id: { in: addresses.map((address) => address.id) } },
    data: { isPrimary: false },
  })
  for (const address of addresses) {
    const { id, tenantId: _tenantId, userId: _userId, ...data } = address
    await prisma.address.update({ where: { id }, data })
  }
  await prisma.clientProfile.deleteMany({ where: { id: { in: profileIds } } })
  for (const profile of profiles) {
    const { id, tenantId: _tenantId, userId: _userId, ...data } = profile
    await prisma.clientProfile.update({ where: { id }, data })
  }
  await prisma.$disconnect()
  await pool.end()
})

describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'compartilhado' })
)('consumidor privado — %s', (_name, baseUrl) => {
  it('atualiza perfil e cria/edita/promove/exclui endereços sem atingir outra locadora ou usuário', async () => {
    const client = createHttpClient({
      baseUrl,
      getHeaders: () => ({
        ...edge,
        Cookie: jar,
        Origin: edge['x-platform-origin'],
        'x-tenant-id': context.alfa.id,
      }),
    })
    const api = createCustomerApi(client)
    const globalUser = await prisma.user.findUnique({ where: { id: userId } })
    const foreignProfile = await prisma.clientProfile.findFirst({
      where: { tenantId: context.bravo.id, userId },
    })
    const foreignAddresses = await prisma.address.findMany({
      where: {
        id: {
          in: [context.addresses.bravo[0]!, context.addresses.otherAlfa[0]!],
        },
      },
    })
    await api.updateProfile({ phone: '(51) 99999-9999', company: marker })
    expect((await api.profile()).user).toMatchObject({
      phone: '51999999999',
      company: marker,
    })
    const input = {
      street: marker,
      number: '1',
      complement: null,
      neighborhood: 'Centro',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90000000',
      isPrimary: false,
    }
    const first = (await api.createAddress(input)).address
    addressIds.push(first.id)
    const second = (await api.createAddress({ ...input, number: '2' })).address
    addressIds.push(second.id)
    expect(
      (await api.updateAddress(first.id, { number: '3' })).address.number
    ).toBe('3')
    await api.updateAddress(second.id, { isPrimary: true })
    const current = (await api.addresses()).addresses
    expect(
      current
        .filter((address) => address.isPrimary)
        .map((address) => address.id)
    ).toEqual([second.id])
    expect(
      current.some((address) =>
        foreignAddresses.some((foreign) => foreign.id === address.id)
      )
    ).toBe(false)
    for (const foreign of foreignAddresses) {
      await expect(
        api.updateAddress(foreign.id, { isPrimary: true })
      ).rejects.toMatchObject({ status: 404 })
      await expect(api.deleteAddress(foreign.id)).rejects.toMatchObject({
        status: 404,
      })
    }
    expect(await api.deleteAddress(second.id)).toEqual({
      message: 'Endereço removido com sucesso',
    })
    expect(
      (await api.addresses()).addresses.some(
        (address) => address.id === second.id
      )
    ).toBe(false)
    expect(await prisma.user.findUnique({ where: { id: userId } })).toEqual(
      globalUser
    )
    expect(
      await prisma.clientProfile.findFirst({
        where: { tenantId: context.bravo.id, userId },
      })
    ).toEqual(foreignProfile)
    expect(
      await prisma.address.findMany({
        where: { id: { in: foreignAddresses.map((address) => address.id) } },
      })
    ).toEqual(foreignAddresses)
  })
})
