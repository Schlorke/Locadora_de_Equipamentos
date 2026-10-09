// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api'
import {
  switchCartScope,
  useCartStore,
} from '../../packages/frontend/src/features/carrinho/model/carrinho'
import { useCartSync } from '../../packages/frontend/src/features/carrinho/model/sincronizar'
import { namedParityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const user = context.identity.users[0]!
const scope = JSON.stringify([context.alfa.slug, user.id])
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': context.alfa.slug,
  'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
  'x-platform-client-ip': context.directory.ips[59]!,
}
let jar = ''
const saved: {
  carts: Awaited<ReturnType<typeof prisma.cart.findMany>>
  items: Awaited<ReturnType<typeof prisma.cartItem.findMany>>
} = { carts: [], items: [] }
beforeAll(async () => {
  jar = await signInParityUser(context, edge, 0)
  saved.carts = await prisma.cart.findMany({ where: { userId: user.id } })
  saved.items = await prisma.cartItem.findMany({
    where: { cartId: { in: saved.carts.map((cart) => cart.id) } },
  })
})
afterEach(async () => {
  cleanup()
  await switchCartScope(null)
  localStorage.clear()
  await prisma.cart.deleteMany({ where: { userId: user.id } })
})
afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    await tx.cart.deleteMany({ where: { userId: user.id } })
    await tx.cart.createMany({ data: saved.carts })
    await tx.cartItem.createMany({ data: saved.items })
  })
  await prisma.$disconnect()
  await pool.end()
})

describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'compartilhado' })
)('consumidor do carrinho — %s', (_name, baseUrl) => {
  it('retoma mesclagem efetivada com resposta perdida e respeita remoção persistida no aparelho', async () => {
    await client().request('/api/cart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { equipmentId: context.alfa.equipmentIds[1]!, quantity: 1, days: 7 },
        ],
      }),
    })
    await switchCartScope(scope)
    useCartStore.getState().addItem({
      equipmentId: context.alfa.equipmentIds[0]!,
      equipmentName: 'Equipamento salvo',
      pricePerDay: 100,
      quantity: 1,
      days: 7,
    })
    const lossy = createHttpClient({
      baseUrl,
      getHeaders: () => ({
        ...edge,
        Cookie: jar,
        Origin: edge['x-platform-origin'],
      }),
      fetcher: async (input, init) => {
        const response = await fetch(input, init)
        if (input.endsWith('/api/cart/merge')) {
          expect(response.status).toBe(200)
          await response.arrayBuffer()
          throw new Error('Resposta local descartada após gravação real')
        }
        return response
      },
    })
    const first = renderHook(() => useCartSync({ scope, client: lossy }))
    await waitFor(() => expect(first.result.current.error).not.toBeNull(), {
      timeout: 5000,
    })
    expect((await read()).items).toHaveLength(2)
    act(() => useCartStore.getState().removeItem(context.alfa.equipmentIds[0]!))
    first.unmount()
    await switchCartScope(null)
    await switchCartScope(scope)
    const http = client(),
      next = renderHook(() => useCartSync({ scope, client: http }))
    await waitFor(() => expect(next.result.current.isReady).toBe(true), {
      timeout: 5000,
    })
    expect(next.result.current.error).toBeNull()
    await waitFor(
      () => expect(useCartStore.getState().remotePending).toBe(false),
      { timeout: 5000 }
    )
    expect((await read()).items.map((item) => item.equipmentId)).toEqual([
      context.alfa.equipmentIds[1]!,
    ])
  })

  function client() {
    return createHttpClient({
      baseUrl,
      getHeaders: () => ({
        ...edge,
        Cookie: jar,
        Origin: edge['x-platform-origin'],
      }),
    })
  }
  async function read() {
    return client().request<{
      items: Array<{
        equipmentId: string
        quantity: number
        finalPrice: string
      }>
    }>('/api/cart/sync')
  }

  it('hook real mescla, calcula e persiste alterações/remoções com cookies e RLS do host', async () => {
    await prisma.cart.deleteMany({ where: { userId: user.id } })
    const foreign = await prisma.cart.create({
      data: { tenantId: context.bravo.id, userId: user.id },
    })
    await client().request('/api/cart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { equipmentId: context.alfa.equipmentIds[1]!, quantity: 1, days: 7 },
        ],
      }),
    })
    await switchCartScope(scope)
    useCartStore.getState().addItem({
      equipmentId: context.alfa.equipmentIds[0]!,
      equipmentName: 'Equipamento salvo',
      pricePerDay: 0,
      quantity: 3,
      days: 7,
    })
    const http = client()
    const view = renderHook(() => useCartSync({ scope, client: http }))
    await waitFor(() => expect(view.result.current.isReady).toBe(true), {
      timeout: 5000,
    })
    expect(view.result.current.error).toBeNull()
    const initial = await read()
    expect(initial.items).toHaveLength(2)
    expect(useCartStore.getState().getTotalPrice()).toBe(
      initial.items.reduce((sum, item) => sum + Number(item.finalPrice), 0)
    )
    act(() =>
      useCartStore
        .getState()
        .updateItemQuantity(context.alfa.equipmentIds[0]!, 5)
    )
    await waitFor(
      () => expect(useCartStore.getState().remotePending).toBe(false),
      { timeout: 5000 }
    )
    expect(
      (await read()).items.find(
        (item) => item.equipmentId === context.alfa.equipmentIds[0]
      )!.quantity
    ).toBe(5)
    act(() => useCartStore.getState().clearCart())
    await waitFor(
      () => expect(useCartStore.getState().remotePending).toBe(false),
      { timeout: 5000 }
    )
    expect((await read()).items).toEqual([])
    expect(
      await prisma.cart.findUnique({ where: { id: foreign.id } })
    ).toMatchObject({ tenantId: context.bravo.id, userId: user.id })
  })

  it('reabertura de remoção pendente substitui em vez de mesclar e não restaura o item apagado', async () => {
    await client().request('/api/cart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { equipmentId: context.alfa.equipmentIds[0]!, quantity: 1, days: 7 },
        ],
      }),
    })
    await switchCartScope(scope)
    useCartStore.getState().acceptServerItems([], true)
    await switchCartScope(null)
    await switchCartScope(scope)
    const http = client()
    const view = renderHook(() => useCartSync({ scope, client: http }))
    await waitFor(() => expect(view.result.current.isReady).toBe(true), {
      timeout: 5000,
    })
    expect(view.result.current.error).toBeNull()
    expect((await read()).items).toEqual([])
    expect(useCartStore.getState()).toMatchObject({
      items: [],
      remotePending: false,
    })
  })
})
