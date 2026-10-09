import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createClientRentalApi } from '../../packages/frontend/src/entities/locacao/api/client-rentals'
import { createClientQuoteApi } from '../../packages/frontend/src/entities/orcamento/api/client-quotes'
import { createCustomerApi } from '../../packages/frontend/src/entities/cliente/api/customer-api'
import { namedParityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const userId = context.identity.users[0]!.id
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[61]!,
}
let jar = ''
beforeAll(async () => {
  jar = await signInParityUser(context, edge, 0)
})
afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})

describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'compartilhado' })
)('consumidor de histórico — %s', (_name, baseUrl) => {
  it('lista recursos privados e remove só o histórico próprio, preservando estado e terceiros', async () => {
    const id = randomUUID(),
      quoteId = randomUUID(),
      foreignIds = [randomUUID(), randomUUID()],
      foreignQuoteId = randomUUID()
    const quote = await prisma.quote.create({
      data: {
        id: quoteId,
        tenantId: context.alfa.id,
        userId,
        name: 'history-consumer',
        email: 'history@example.test',
        phone: '51999999999',
        status: 'APPROVED',
        total: '31.15',
        finalTotal: '30.05',
      },
    })
    try {
      const rental = await prisma.rentals.create({
        data: {
          id,
          tenantId: context.alfa.id,
          userid: userId,
          quoteId,
          status: 'ACTIVE',
          startdate: new Date('2026-10-01'),
          enddate: new Date('2026-10-02'),
          total: '30.05',
          rental_items: {
            create: {
              id: randomUUID(),
              tenantId: context.alfa.id,
              equipmentid: context.alfa.equipmentIds[0]!,
              quantity: 1,
              totaldays: 1,
              priceperday: '30.05',
              totalprice: '30.05',
            },
          },
        },
      })
      const client = createHttpClient({
        baseUrl,
        getHeaders: () => ({
          ...edge,
          Cookie: jar,
          Origin: edge['x-platform-origin'],
          'x-tenant-id': context.alfa.id,
        }),
      })
      const rentals = createClientRentalApi(client),
        quotes = createClientQuoteApi(client),
        customer = createCustomerApi(client)
      const rentalList = (await rentals.list()).rentals
      expect(rentalList.find((row) => row.id === id)).toMatchObject({
        status: 'ACTIVE',
        quoteId,
      })
      expect(
        rentalList.every(
          (row) => !('tenantId' in row) || row.tenantId === context.alfa.id
        )
      ).toBe(true)
      const quoteList = await quotes.list(),
        rows = Array.isArray(quoteList) ? quoteList : quoteList.quotes
      expect(rows.some((row) => row.id === quoteId)).toBe(true)
      const activities = (await customer.activities()).activities
      expect(activities.length).toBeLessThanOrEqual(10)
      const foreign = await prisma.rentals.create({
        data: {
          id: foreignIds[0]!,
          tenantId: context.bravo.id,
          userid: context.identity.users[1]!.id,
          startdate: rental.startdate,
          enddate: rental.enddate,
          total: '5',
        },
      })
      const other = await prisma.rentals.create({
        data: {
          id: foreignIds[1]!,
          tenantId: context.alfa.id,
          userid: context.identity.users[1]!.id,
          startdate: rental.startdate,
          enddate: rental.enddate,
          total: '5',
        },
      })
      for (const row of [foreign, other]) {
        expect(
          (await rentals.list()).rentals.some((r) => r.id === row.id)
        ).toBe(false)
        await expect(rentals.hide(row.id)).rejects.toMatchObject({
          status: 404,
        })
        expect(
          await prisma.rentals.findUnique({ where: { id: row.id } })
        ).toEqual(row)
      }
      const foreignQuote = await prisma.quote.create({
        data: {
          id: foreignQuoteId,
          tenantId: context.bravo.id,
          userId: context.identity.users[1]!.id,
          name: 'foreign-history',
          email: 'foreign@example.test',
          phone: '51999999999',
          total: '5',
        },
      })
      await expect(quotes.hide(foreignQuote.id)).rejects.toMatchObject({
        status: 404,
      })
      expect(
        await prisma.quote.findUnique({ where: { id: foreignQuote.id } })
      ).toEqual(foreignQuote)
      expect(await rentals.hide(id)).toEqual({
        message: 'Locação removida do histórico com sucesso',
      })
      expect((await rentals.list()).rentals.some((row) => row.id === id)).toBe(
        false
      )
      const hidden = await prisma.rentals.findUniqueOrThrow({ where: { id } })
      expect(hidden.clientDeletedAt).toBeInstanceOf(Date)
      expect({
        ...hidden,
        clientDeletedAt: rental.clientDeletedAt,
        updatedat: rental.updatedat,
      }).toEqual(rental)
      expect(await quotes.hide(quoteId)).toEqual({
        message: 'Orçamento removido do histórico com sucesso',
      })
      const after = await quotes.list()
      expect(
        (Array.isArray(after) ? after : after.quotes).some(
          (row) => row.id === quoteId
        )
      ).toBe(false)
      const hiddenQuote = await prisma.quote.findUniqueOrThrow({
        where: { id: quoteId },
      })
      expect(hiddenQuote.clientDeletedAt).toBeInstanceOf(Date)
      expect({
        ...hiddenQuote,
        clientDeletedAt: quote.clientDeletedAt,
        updatedAt: quote.updatedAt,
      }).toEqual(quote)
    } finally {
      await prisma.rental_items.deleteMany({ where: { rentalid: id } })
      await prisma.rentals.deleteMany({
        where: { id: { in: [id, ...foreignIds] } },
      })
      await prisma.quote.deleteMany({
        where: { id: { in: [quoteId, foreignQuoteId] } },
      })
    }
  })
})
