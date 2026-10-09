import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createQuoteApi } from '../../packages/frontend/src/pages/orcamento/api/quote-api'
import { namedParityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const userId = context.identity.users[0]!.id
const marker = `quote-consumer-${randomUUID()}`
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[63]!,
}
let jar = ''
let profiles: Awaited<ReturnType<typeof prisma.clientProfile.findMany>> = []
const addressIds: string[] = []
const profileIds: string[] = []
beforeAll(async () => {
  profiles = await prisma.clientProfile.findMany({ where: { userId } })
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
  const quotes = await prisma.quote.findMany({
    where: { name: marker },
    select: { id: true },
  })
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: quotes.map((quote) => quote.id) } },
  })
  await prisma.quote.deleteMany({
    where: { id: { in: quotes.map((quote) => quote.id) } },
  })
  await prisma.address.deleteMany({ where: { id: { in: addressIds } } })
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
)('transporte real do orçamento — %s', (_name, baseUrl) => {
  it('consulta catálogo/perfil/endereços e persiste o pedido na locadora explícita', async () => {
    const client = createHttpClient({
      baseUrl,
      getHeaders: () => ({
        ...edge,
        Cookie: jar,
        Origin: edge['x-platform-origin'],
        'x-tenant-id': context.alfa.id,
      }),
    })
    const api = createQuoteApi(client, context.alfa.slug)
    const foreign = await prisma.clientProfile.findFirst({
      where: { tenantId: context.bravo.id, userId },
    })
    const equipments = await api.equipments<{ id: string }>()
    expect(
      equipments.some(
        (equipment) => equipment.id === context.alfa.equipmentIds[0]
      )
    ).toBe(true)
    expect(
      equipments.some((equipment) =>
        context.bravo.equipmentIds.includes(equipment.id)
      )
    ).toBe(false)
    await api.profile()
    await api.saveProfile({ company: marker })
    expect((await api.profile()).user.company).toBe(marker)
    const { address: saved } = await api.saveAddress({
      street: marker,
      number: '1',
      complement: null,
      neighborhood: 'Centro',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90000000',
      isPrimary: false,
    })
    addressIds.push(saved.id)
    expect(
      (await api.addresses()).addresses.some(
        (address) => address.id === saved.id
      )
    ).toBe(true)
    const quote = await api.submit(
      {
        name: marker,
        email: 'quote-consumer@example.test',
        phone: '51999999999',
        cpf: '',
        cnpj: '',
        cep: '',
        company: '',
        message: '',
        deliveryType: 'PICKUP',
      },
      [
        {
          equipmentId: context.alfa.equipmentIds[0]!,
          quantity: 2,
          days: 3,
          startDate: '2033-03-01T00:00:00Z',
          endDate: '2033-03-03T00:00:00Z',
          includeWeekends: true,
        },
      ]
    )
    expect(
      await prisma.quote.findUnique({
        where: { id: quote.id },
        select: { tenantId: true },
      })
    ).toEqual({ tenantId: context.alfa.id })
    const rows = await client.request<Array<{ id: string }>>('/api/quotes')
    expect(rows.some((row) => row.id === quote.id)).toBe(true)
    expect(
      await prisma.clientProfile.findFirst({
        where: { tenantId: context.bravo.id, userId },
      })
    ).toEqual(foreign)
  })
})
