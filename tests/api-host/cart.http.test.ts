import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { PrismaClient, type Cart, type CartItem } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { namedParityTargets, parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const users = context.identity.users.map((row) => row.id)
const user = users[0]!
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[58]!,
}
const tenantEdge = (slug = context.alfa.slug) => ({
  ...edge,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
const a = { 'x-tenant-id': context.alfa.id }
const cartIds = Array.from({ length: 4 }, () => randomUUID())
const jars: string[] = []
const include = {
  items: { include: { equipment: { include: { category: true } } } },
} as const
const json = (value: unknown) => JSON.parse(JSON.stringify(value))
const line = (index = 0, quantity = 2, days = 3) => ({
  equipmentId: context.alfa.equipmentIds[index]!,
  quantity,
  days,
})
type Operation = 'read' | 'replace' | 'merge'
type Options = {
  jar?: string
  headers?: Record<string, string>
  body?: string
  query?: string
}
type Snapshot = { carts: Cart[]; items: CartItem[] }
async function snapshot(): Promise<Snapshot> {
  const carts = await prisma.cart.findMany({
    where: { userId: { in: users } },
    orderBy: { id: 'asc' },
  })
  const items = await prisma.cartItem.findMany({
    where: { cartId: { in: carts.map((row) => row.id) } },
    orderBy: { id: 'asc' },
  })
  return { carts, items }
}
async function restore(rows: Snapshot) {
  await prisma.$transaction(async (tx) => {
    await tx.cart.deleteMany({ where: { userId: { in: users } } })
    await tx.cart.createMany({ data: rows.carts })
    await tx.cartItem.createMany({ data: rows.items })
  })
}
async function request(
  origin: string,
  operation: Operation,
  options: Options = {}
) {
  const headers = new Headers({
    Cookie: options.jar ?? jars[0]!,
    ...a,
    ...options.headers,
  })
  if (headers.get('x-tenant-id') === '') headers.delete('x-tenant-id')
  const response = await fetch(
    `${origin}/api/cart/${operation === 'merge' ? 'merge' : 'sync'}${options.query ?? ''}`,
    {
      method: operation === 'read' ? 'GET' : 'POST',
      headers,
      ...(operation === 'read'
        ? {}
        : {
            body:
              options.body ??
              JSON.stringify({
                [operation === 'merge' ? 'localCartItems' : 'items']: [line()],
              }),
          }),
    }
  )
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
    cookie: response.headers.get('set-cookie'),
    vary: response.headers.get('vary'),
  }
}
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
/** Cabeçalhos esperados de uma resposta do carrinho, pela camada que a produz (onda 135, B2). */
function cartHeaders(body: unknown) {
  const error = (body as { error?: string } | null)?.error
  return {
    cache:
      error === 'Locadora não encontrada' || error === 'Origem não permitida'
        ? 'no-store'
        : null,
    vary: frameworkVary,
  }
}
/** Cada host da rodada contra a recusa explícita esperada (nenhum host serve de gabarito do outro). */
async function refused(
  operation: Operation,
  status: number,
  options: Options,
  body: unknown
) {
  const before = await snapshot()
  let last: Awaited<ReturnType<typeof request>> | undefined
  for (const origin of parityTargets(context)) {
    const result = await request(origin, operation, options)
    expect(result).toEqual({
      status,
      body,
      ...cartHeaders(body),
      cookie: null,
    })
    expect(await snapshot()).toEqual(before)
    last = result
  }
  return last!
}
// cartInclude has no orderBy in either host. Compare every persisted field,
// including ids/timestamps, without treating a query plan's row order as API.
function orderedCart<T extends { items: Array<{ equipmentId: string }> }>(
  body: T
) {
  return {
    ...body,
    items: [...body.items].sort((left, right) =>
      left.equipmentId.localeCompare(right.equipmentId)
    ),
  }
}
async function success(
  operation: Operation,
  submitted: ReturnType<typeof line>[] = [line()],
  options: Options = {},
  tenant = context.alfa.id,
  owner = user,
  expectedRate = 17.25
) {
  const before = await snapshot()
  const expectedIds =
    operation === 'replace'
      ? submitted.map((row) => row.equipmentId)
      : [
          ...new Set([
            ...before.items
              .filter((row) =>
                before.carts.some(
                  (cart) =>
                    cart.id === row.cartId &&
                    cart.tenantId === tenant &&
                    cart.userId === owner
                )
              )
              .map((row) => row.equipmentId),
            ...submitted.map((row) => row.equipmentId),
          ]),
        ]
  try {
    for (const origin of parityTargets(context)) {
      await restore(before)
      const started = Date.now()
      const result = await request(origin, operation, {
        ...options,
        body:
          options.body ??
          JSON.stringify({
            [operation === 'merge' ? 'localCartItems' : 'items']: submitted,
          }),
      })
      expect(result.status).toBe(200)
      expect(result.cookie).toBeNull()
      expect({ cache: result.cache, vary: result.vary }).toEqual(
        cartHeaders(result.body)
      )
      const after = await snapshot()
      const owned = after.carts.filter(
        (row) => row.tenantId === tenant && row.userId === owner
      )
      expect(owned).toHaveLength(1)
      const saved = owned[0]!
      expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.carts.find((row) => row.id === saved.id)?.updatedAt.getTime() ??
          started
      )
      const current = after.items.filter((row) => row.cartId === saved.id)
      expect(current.map((row) => row.equipmentId).sort()).toEqual(
        expectedIds.sort()
      )
      expect(current.every((row) => row.tenantId === tenant)).toBe(true)
      for (const submittedItem of submitted) {
        const stored = current.find(
          (row) => row.equipmentId === submittedItem.equipmentId
        )!
        expect(stored.quantity).toBe(submittedItem.quantity)
        expect(stored.days).toBe(submittedItem.days)
        expect(stored.pricePerDay.toString()).toBe(String(expectedRate))
        expect(stored.finalPrice?.toString()).toBe(
          String(expectedRate * submittedItem.days * submittedItem.quantity)
        )
      }
      if (operation === 'merge')
        for (const untouched of before.items.filter(
          (row) =>
            row.cartId === saved.id &&
            !submitted.some((item) => item.equipmentId === row.equipmentId)
        ))
          expect(current.find((row) => row.id === untouched.id)).toEqual(
            untouched
          )
      const untouchedIds = before.carts
        .filter((row) => row.tenantId !== tenant || row.userId !== owner)
        .map((row) => row.id)
      expect(
        after.carts.filter((row) => untouchedIds.includes(row.id))
      ).toEqual(before.carts.filter((row) => untouchedIds.includes(row.id)))
      expect(
        after.items.filter((row) => untouchedIds.includes(row.cartId))
      ).toEqual(before.items.filter((row) => untouchedIds.includes(row.cartId)))
      if (operation === 'merge') {
        expect(orderedCart(result.body)).toEqual(
          orderedCart(
            json(
              await prisma.cart.findUniqueOrThrow({
                where: { id: saved.id },
                include,
              })
            )
          )
        )
      } else {
        expect(result.body).toEqual({
          message: 'Carrinho sincronizado com sucesso',
        })
      }
    }
  } finally {
    await restore(before)
  }
}
beforeAll(async () => {
  for (let index = 0; index < 2; index++)
    jars.push(await signInParityUser(context, edge, index))
  for (const [index, tenantId, userId, equipment] of [
    [0, context.alfa.id, user, context.alfa.equipmentIds],
    [1, context.bravo.id, user, context.bravo.equipmentIds],
    [2, context.alfa.id, users[1]!, context.alfa.equipmentIds],
    [3, null, user, [context.unassignedEquipment]],
  ] as const) {
    const id = cartIds[index]!
    await prisma.cart.create({
      data: {
        id,
        tenantId,
        userId,
        createdAt: new Date('2030-01-01'),
        updatedAt: new Date('2030-01-01'),
      },
    })
    for (const equipmentId of equipment.slice(0, 2))
      await prisma.cartItem.create({
        data: {
          id: randomUUID(),
          cartId: id,
          tenantId,
          equipmentId,
          quantity: 1,
          days: 1,
          pricePerDay: '999.99',
          finalPrice: '999.99',
        },
      })
  }
})
afterAll(async () => {
  await prisma.cart.deleteMany({ where: { userId: { in: users } } })
  await prisma.$disconnect()
  await pool.end()
})

describe(`${context.identity.mode} — cart HTTP parity`, () => {
  describe.each(['read', 'replace', 'merge'] as const)('%s', (operation) => {
    it('refuses absent identity before body or storage', async () => {
      await refused(
        operation,
        401,
        { jar: '', body: '{' },
        { error: 'Authentication required' }
      )
    })
    it('refuses forged identity', async () => {
      await refused(
        operation,
        401,
        {
          jar: 'next-auth.session-token=forged; __Host-locadora.session_token=forged',
        },
        { error: 'Authentication required' }
      )
    })
    it('requires explicit selection on the app host', async () => {
      await refused(
        operation,
        409,
        { headers: { ...edge, 'x-tenant-id': '' } },
        { error: 'Select an organization' }
      )
    })
    it('does not treat global ADMIN as a tenant membership', async () => {
      await refused(
        operation,
        403,
        { jar: jars[1]!, headers: a },
        { error: 'Organization access denied' }
      )
    })
    it.each(['ADMIN', 'OPERATOR', 'FINANCIAL'] as const)(
      'rejects membership role %s',
      async (role) => {
        const row = await prisma.membership.findUniqueOrThrow({
          where: {
            tenantId_userId: { tenantId: context.alfa.id, userId: user },
          },
        })
        try {
          await prisma.membership.update({
            where: { id: row.id },
            data: { role },
          })
          await refused(
            operation,
            403,
            {},
            { error: 'Carrinho disponível apenas para clientes da locadora' }
          )
        } finally {
          await prisma.membership.update({
            where: { id: row.id },
            data: { role: row.role },
          })
        }
      }
    )
    it.each(['REVOKED', 'SUSPENDED'] as const)(
      'revalidates %s membership per request',
      async (status) => {
        const row = await prisma.membership.findUniqueOrThrow({
          where: {
            tenantId_userId: { tenantId: context.alfa.id, userId: user },
          },
        })
        try {
          await prisma.membership.update({
            where: { id: row.id },
            data: { status },
          })
          await refused(
            operation,
            403,
            {},
            { error: 'Organization access denied' }
          )
        } finally {
          await prisma.membership.update({
            where: { id: row.id },
            data: { status: row.status },
          })
        }
      }
    )
    it('ignores forged edge and refuses tenant conflict', async () => {
      await refused(
        operation,
        400,
        { headers: { ...tenantEdge(), 'x-tenant-id': context.bravo.id } },
        { error: 'Conflicting tenant selection' }
      )
      await refused(
        operation,
        409,
        {
          headers: {
            ...tenantEdge(),
            'x-platform-edge-auth': 'forged',
            'x-tenant-id': '',
          },
        },
        { error: 'Select an organization' }
      )
    })
    it('hides suspended or nonexistent tenant hosts identically', async () => {
      // A mesma resposta neutra para a locadora suspensa e para a inexistente.
      for (const slug of [context.suspended, 'missing-cart-tenant'])
        await refused(
          operation,
          404,
          { headers: { ...tenantEdge(slug), 'x-tenant-id': '' } },
          { error: 'Locadora não encontrada' }
        )
    })
    it('preserves a database read failure as the endpoint generic error', async () => {
      const role = new URL(context.runtimeUrl).searchParams
        .get('options')!
        .replace('-c role=', '')
      await alterSharedAcl(pool, `REVOKE SELECT ON carts FROM ${role}`)
      try {
        await refused(
          operation,
          500,
          {},
          {
            error:
              operation === 'merge'
                ? 'Erro ao mesclar carrinho'
                : 'Erro ao sincronizar carrinho',
          }
        )
      } finally {
        await alterSharedAcl(pool, `GRANT SELECT ON carts TO ${role}`)
      }
    })
    if (operation === 'read') return
    it.each<Record<string, string>>([
      { Origin: 'https://bravo.platform.test' },
      { Origin: 'null' },
      { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'same-site' },
    ])('rejects cross-origin before malformed body: %j', async (headers) => {
      const result = await refused(
        operation,
        403,
        { body: '{', headers: { ...edge, ...headers } },
        { error: 'Origem não permitida' }
      )
      expect(result.cache).toBe('no-store')
    })
    it('central CSRF still precedes missing authentication', async () => {
      await refused(
        operation,
        403,
        {
          jar: '',
          body: '{',
          headers: { ...edge, Origin: 'https://bravo.platform.test' },
        },
        { error: 'Origem não permitida' }
      )
    })
    const invalid = [
      null,
      {},
      'equipment',
      [null],
      [{ ...line(), quantity: 0 }],
      [{ ...line(), quantity: 10001 }],
      [{ ...line(), days: 3651 }],
      [{ ...line(), days: 1.5 }],
      [{ ...line(), quantity: '1' }],
      Array.from({ length: 201 }, () => line()),
    ]
    it.each(invalid.map((value, index) => ({ value, index })))(
      'returns 400 for invalid payload #$index without effects',
      async ({ value }) => {
        await refused(
          operation,
          400,
          {
            body: JSON.stringify({
              [operation === 'merge' ? 'localCartItems' : 'items']: value,
            }),
          },
          { error: 'Itens inválidos' }
        )
      }
    )
    it.each(['{', 'null'])(
      'keeps existing 500 contract for body %s',
      async (body) => {
        await refused(
          operation,
          500,
          { body },
          {
            error:
              operation === 'merge'
                ? 'Erro ao mesclar carrinho'
                : 'Erro ao sincronizar carrinho',
          }
        )
      }
    )
    it('keeps distinct body keys and refuses a missing item array', async () => {
      await refused(
        operation,
        400,
        {
          body: JSON.stringify({
            [operation === 'merge' ? 'items' : 'localCartItems']: [line()],
          }),
        },
        { error: 'Itens inválidos' }
      )
    })
    it('refuses repeated equipment without replacing the old cart', async () => {
      await refused(
        operation,
        400,
        {
          body: JSON.stringify({
            [operation === 'merge' ? 'localCartItems' : 'items']: [
              line(),
              line(),
            ],
          }),
        },
        { error: 'Equipamento repetido no carrinho' }
      )
    })
    it.each([
      { label: 'foreign-tenant', id: context.bravo.equipmentIds[0]! },
      { label: 'quarantined', id: context.unassignedEquipment },
      { label: 'absent', id: randomUUID() },
    ])('refuses $label equipment', async ({ id }) => {
      await refused(
        operation,
        404,
        {
          body: JSON.stringify({
            [operation === 'merge' ? 'localCartItems' : 'items']: [
              { ...line(), equipmentId: id },
            ],
          }),
        },
        { error: 'Equipamento não encontrado nesta locadora' }
      )
    })
    it('writes from the native transport with server money and exact owner', async () => {
      await success(operation)
    })
    it('writes from the exact app origin', async () => {
      await success(operation, [line()], {
        headers: {
          ...edge,
          Origin: 'https://app.platform.test',
          'Sec-Fetch-Site': 'same-origin',
        },
      })
    })
    it('writes on the tenant host without redundant selection', async () => {
      await success(operation, [line()], {
        headers: {
          ...tenantEdge(),
          'x-tenant-id': '',
          Origin: `https://${context.alfa.slug}.platform.test`,
        },
      })
    })
    it('ignores forged price, ownership and relation fields', async () => {
      await success(operation, [line()], {
        body: JSON.stringify({
          tenantId: context.bravo.id,
          userId: users[1],
          cartId: cartIds[1],
          [operation === 'merge' ? 'localCartItems' : 'items']: [
            {
              ...line(),
              tenantId: context.bravo.id,
              cartId: cartIds[1],
              pricePerDay: '0.01',
              finalPrice: '0.01',
              id: 'forged',
            },
          ],
        }),
      })
    })
    it('retains replace/merge distinction for empty arrays', async () => {
      await success(operation, [])
    })
    it('creates an empty first cart for a valid CLIENT without adopting quarantine', async () => {
      const before = await snapshot()
      try {
        await prisma.cart.delete({ where: { id: cartIds[0]! } })
        await success(operation, [])
      } finally {
        await restore(before)
      }
    })
    it('accepts the quantity/day limits and recalculates money', async () => {
      // The fixture's monthly period uses the base daily rate (12.50), while
      // its daily direct value (17.25) applies only below the next period.
      await success(
        operation,
        [line(0, 10000, 3650)],
        {},
        context.alfa.id,
        user,
        12.5
      )
    })
    it('creates the cart for a different tenant only after CLIENT membership validation', async () => {
      const membership = await prisma.membership.findUniqueOrThrow({
        where: {
          tenantId_userId: { tenantId: context.bravo.id, userId: user },
        },
      })
      try {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { role: 'CLIENT' },
        })
        await success(
          operation,
          [{ ...line(), equipmentId: context.bravo.equipmentIds[0]! }],
          { headers: { 'x-tenant-id': context.bravo.id } },
          context.bravo.id
        )
      } finally {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { role: membership.role },
        })
      }
    })
  })
  it('GET returns the complete persisted cart without recalculating or exposing another owner', async () => {
    const before = await snapshot()
    const expected = json(
      await prisma.cart.findUniqueOrThrow({
        where: { id: cartIds[0]! },
        include,
      })
    )
    for (const origin of parityTargets(context)) {
      const service = await request(origin, 'read')
      expect({ ...service, body: orderedCart(service.body) }).toEqual({
        status: 200,
        body: orderedCart(expected),
        ...cartHeaders(expected),
        cookie: null,
      })
      expect(
        service.body.items.every((item: any) => item.pricePerDay === '999.99')
      ).toBe(true)
    }
    expect(await snapshot()).toEqual(before)
  })
  it('GET empty returns items:[] without creating or adopting another cart', async () => {
    const before = await snapshot()
    try {
      await prisma.cart.delete({ where: { id: cartIds[0]! } })
      const without = await snapshot()
      for (const origin of parityTargets(context))
        expect(await request(origin, 'read')).toMatchObject({
          status: 200,
          body: { items: [] },
        })
      expect(await snapshot()).toEqual(without)
    } finally {
      await restore(before)
    }
  })
  it.each([
    {
      label: 'half-cent discount',
      days: 1,
      quantity: 3,
      dailyDirectValue: null,
      dailyUseDirectValue: false,
      dailyDiscount: 10,
      weeklyDirectValue: null,
      weeklyUseDirectValue: false,
      rate: 45.045,
      total: '135.14',
    },
    {
      label: 'weekly direct proportional day',
      days: 8,
      quantity: 2,
      dailyDirectValue: null,
      dailyUseDirectValue: false,
      dailyDiscount: 0,
      weeklyDirectValue: '400',
      weeklyUseDirectValue: true,
      rate: 400 / 7,
      total: '914.29',
    },
    {
      label: 'zero direct value',
      days: 8,
      quantity: 3,
      dailyDirectValue: null,
      dailyUseDirectValue: false,
      dailyDiscount: 0,
      weeklyDirectValue: '0',
      weeklyUseDirectValue: true,
      rate: 0,
      total: '0',
    },
  ])(
    'keeps exact server pricing for $label in both operations',
    async (pricing) => {
      const id = context.alfa.equipmentIds[0]!
      const original = await prisma.equipment.findUniqueOrThrow({
        where: { id },
      })
      const before = await snapshot()
      const fields = {
        pricePerDay: '50.05',
        dailyDirectValue: pricing.dailyDirectValue,
        dailyUseDirectValue: pricing.dailyUseDirectValue,
        dailyDiscount: pricing.dailyDiscount,
        weeklyDirectValue: pricing.weeklyDirectValue,
        weeklyUseDirectValue: pricing.weeklyUseDirectValue,
      }
      try {
        await prisma.equipment.update({ where: { id }, data: fields })
        for (const operation of ['replace', 'merge'] as const) {
          for (const origin of parityTargets(context)) {
            await restore(before)
            const result = await request(origin, operation, {
              body: JSON.stringify({
                [operation === 'merge' ? 'localCartItems' : 'items']: [
                  {
                    equipmentId: id,
                    quantity: pricing.quantity,
                    days: pricing.days,
                    finalPrice: '0.01',
                  },
                ],
              }),
            })
            expect(result.status).toBe(200)
            const item = await prisma.cartItem.findUniqueOrThrow({
              where: {
                cartId_equipmentId: { cartId: cartIds[0]!, equipmentId: id },
              },
            })
            expect(item.pricePerDay.toNumber()).toBeCloseTo(pricing.rate, 10)
            expect(item.finalPrice?.toString()).toBe(pricing.total)
            expect(
              operation === 'merge' ? orderedCart(result.body) : result.body
            ).toEqual(
              operation === 'merge'
                ? orderedCart(
                    json(
                      await prisma.cart.findUniqueOrThrow({
                        where: { id: cartIds[0]! },
                        include,
                      })
                    )
                  )
                : { message: 'Carrinho sincronizado com sucesso' }
            )
          }
        }
      } finally {
        await restore(before)
        await prisma.equipment.update({
          where: { id },
          data: {
            pricePerDay: original.pricePerDay,
            dailyDirectValue: original.dailyDirectValue,
            dailyUseDirectValue: original.dailyUseDirectValue,
            dailyDiscount: original.dailyDiscount,
            weeklyDirectValue: original.weeklyDirectValue,
            weeklyUseDirectValue: original.weeklyUseDirectValue,
          },
        })
      }
    }
  )
  it.each(['replace', 'merge'] as const)(
    '%s rolls back prior deletes/updates if a later item write fails',
    async (operation) => {
      const trigger = `api_cart_fail_${randomUUID().replaceAll('-', '').slice(0, 12)}`
      await pool.query(
        `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.quantity = 24 THEN RAISE EXCEPTION 'fixture item failure' USING ERRCODE = '42501'; END IF; RETURN NEW; END $$`
      )
      try {
        await pool.query(
          `CREATE TRIGGER ${trigger} AFTER INSERT OR UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION ${trigger}()`
        )
        await refused(
          operation,
          500,
          {
            body: JSON.stringify({
              [operation === 'merge' ? 'localCartItems' : 'items']: [
                line(0, 5),
                line(1, 24),
              ],
            }),
          },
          {
            error:
              operation === 'merge'
                ? 'Erro ao mesclar carrinho'
                : 'Erro ao sincronizar carrinho',
          }
        )
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON cart_items`)
        await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`)
      }
    }
  )
  it('concurrent merges through both hosts retain all requested distinct items', async () => {
    const before = await snapshot()
    try {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          request(rotatingTarget(context, index), 'merge', {
            body: JSON.stringify({ localCartItems: [line(index, index + 2)] }),
          })
        )
      )
      expect(results.every((row) => row.status === 200)).toBe(true)
      const after = await snapshot()
      const items = after.items.filter((row) => row.cartId === cartIds[0]!)
      expect(items).toHaveLength(6)
      for (let index = 0; index < 6; index++)
        expect(
          items.find(
            (row) => row.equipmentId === context.alfa.equipmentIds[index]
          )
        ).toMatchObject({
          quantity: index + 2,
          days: 3,
          tenantId: context.alfa.id,
        })
      expect(after.carts).toEqual(before.carts)
      expect(after.items.filter((row) => row.cartId !== cartIds[0])).toEqual(
        before.items.filter((row) => row.cartId !== cartIds[0])
      )
    } finally {
      await restore(before)
    }
  })
  it.each(namedParityTargets(context, { legacy: 'legacy', api: 'api' }))(
    '%s actually waits for the shared per-user PostgreSQL lock',
    async (_host, origin) => {
      const before = await snapshot()
      const connection = await pool.connect()
      const lock = `${context.alfa.id}:cart:${user}`
      let pending: Promise<Awaited<ReturnType<typeof request>>> | undefined
      try {
        await connection.query('BEGIN')
        await connection.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [lock]
        )
        pending = request(origin, 'merge')
        const deadline = Date.now() + 3000
        let waiting = false
        while (Date.now() < deadline) {
          const rows = await pool.query(
            "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND classid=((hashtextextended($1,0)>>32)&4294967295)::oid AND objid=(hashtextextended($1,0)&4294967295)::oid",
            [lock]
          )
          if (rows.rowCount) {
            waiting = true
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
        expect(waiting).toBe(true)
        expect(await snapshot()).toEqual(before)
        await connection.query('COMMIT')
        expect((await pending).status).toBe(200)
      } finally {
        await connection.query('ROLLBACK')
        connection.release()
        if (pending) await pending
        await restore(before)
      }
    }
  )
  it('enforces RLS and tenant composite FKs independently of HTTP predicates', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl })
    const connection = await runtime.connect()
    const before = await snapshot()
    try {
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      const visible = await connection.query('SELECT id FROM carts ORDER BY id')
      expect(visible.rows.map((row) => row.id).sort()).toEqual(
        [cartIds[0], cartIds[2]].sort()
      )
      for (const id of [cartIds[1], cartIds[3]]) {
        expect(
          (
            await connection.query(
              'UPDATE carts SET "updatedAt"=now() WHERE id=$1 RETURNING id',
              [id]
            )
          ).rowCount
        ).toBe(0)
        expect(
          (
            await connection.query(
              'DELETE FROM carts WHERE id=$1 RETURNING id',
              [id]
            )
          ).rowCount
        ).toBe(0)
      }
      await connection.query('ROLLBACK')
      for (const [tenant, cart, equipment, code] of [
        [context.bravo.id, cartIds[1], context.bravo.equipmentIds[0], '42501'],
        [context.alfa.id, cartIds[1], context.alfa.equipmentIds[0], '23503'],
        [context.alfa.id, cartIds[0], context.bravo.equipmentIds[0], '23503'],
      ]) {
        await connection.query('BEGIN')
        await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
          context.alfa.id,
        ])
        await expect(
          connection.query(
            'INSERT INTO cart_items (id,"tenantId","cartId","equipmentId",quantity,days,"pricePerDay","createdAt") VALUES ($1,$2,$3,$4,1,1,1,now())',
            [randomUUID(), tenant, cart, equipment]
          )
        ).rejects.toMatchObject({ code })
        await connection.query('ROLLBACK')
      }
      expect(await snapshot()).toEqual(before)
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
      await runtime.end()
    }
  })
  it('retains automatic OPTIONS/HEAD and 405 behavior', async () => {
    for (const endpoint of ['sync', 'merge']) {
      for (const method of [
        'OPTIONS',
        'PUT',
        ...(endpoint === 'sync' ? ['HEAD'] : ['GET']),
      ]) {
        for (const origin of parityTargets(context)) {
          const response = await fetch(`${origin}/api/cart/${endpoint}`, {
            method,
            headers: { Cookie: jars[0]!, ...a },
          })
          expect({
            status: response.status,
            allow: response.headers.get('allow'),
            body: await response.text(),
          }).toEqual({
            status: method === 'OPTIONS' ? 204 : method === 'HEAD' ? 200 : 405,
            allow:
              method === 'OPTIONS'
                ? endpoint === 'sync'
                  ? 'GET, HEAD, OPTIONS, POST'
                  : 'OPTIONS, POST'
                : null,
            body: '',
          })
        }
      }
    }
  })
})
