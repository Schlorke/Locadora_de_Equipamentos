import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    equipment: { findMany: vi.fn() },
    cart: { findFirst: vi.fn(), upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
    cartItem: { deleteMany: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import {
  GET as serviceRead,
  POST as serviceSync,
} from '../../apps/services/api/src/app/api/cart/sync/route'
import { POST as serviceMerge } from '../../apps/services/api/src/app/api/cart/merge/route'

const adapters = [['service', serviceRead, serviceSync, serviceMerge]] as const
const principal = {
  tenantId: 'cart-tenant',
  userId: 'cart-client',
  membershipId: 'cart-member',
  role: 'CLIENT',
}
const scope = { tenantId: principal.tenantId, userId: principal.userId }
const item = { equipmentId: 'cart-equipment', quantity: 3, days: 1 }
const include = {
  items: { include: { equipment: { include: { category: true } } } },
}
const cart = { id: 'fixture-cart', ...scope, items: [{ id: 'fixture-item' }] }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://app.platform.test')
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.cart.findFirst.mockResolvedValue(cart)
  state.tx.cart.upsert.mockResolvedValue(cart)
  state.tx.cart.findUniqueOrThrow.mockResolvedValue(cart)
  state.tx.equipment.findMany.mockResolvedValue([
    { id: item.equipmentId, ...scope, pricePerDay: '50.05', dailyDiscount: 10 },
  ])
})
afterEach(() => vi.unstubAllEnvs())

describe.each(adapters)(
  '%s cart HTTP characterization',
  (_host, GET, sync, merge) => {
    const methods = [
      ['GET', GET, 'sync'],
      ['POST', sync, 'sync'],
      ['POST', merge, 'merge'],
    ] as const
    describe.each(methods)('%s /cart/%s', (method, handler, mode) => {
      const request = (body?: string, headers: Record<string, string> = {}) =>
        new NextRequest(`https://app.platform.test/api/cart/${mode}`, {
          method,
          headers,
          ...(method === 'GET'
            ? {}
            : {
                body:
                  body ??
                  JSON.stringify({
                    [mode === 'sync' ? 'items' : 'localCartItems']: [item],
                  }),
              }),
        })
      it.each([400, 401, 403, 404, 409, 503])(
        'returns principal refusal %i unchanged',
        async (status) => {
          const response = Response.json(
            { error: 'refused' },
            { status, headers: { 'Cache-Control': 'private, no-store' } }
          )
          state.principal.mockResolvedValue({ ok: false, response })
          expect(await handler(request('{'))).toBe(response)
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it('catches identity dependency exceptions as the existing generic error', async () => {
        state.principal.mockRejectedValue(new Error('private identity failure'))
        const response = await handler(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error:
            mode === 'sync'
              ? 'Erro ao sincronizar carrinho'
              : 'Erro ao mesclar carrinho',
        })
        expect(state.transaction).not.toHaveBeenCalled()
      })
      it.each(['ADMIN', 'OPERATOR', 'FINANCIAL'])(
        'refuses a %s membership even when global user is ADMIN',
        async (role) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role },
          })
          const response = await handler(request())
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({
            error: 'Carrinho disponível apenas para clientes da locadora',
          })
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it.each(['transaction', 'rls', 'storage'])(
        'keeps the generic %s failure and never leaks private errors',
        async (stage) => {
          const failure = new Error('private storage failure')
          if (stage === 'transaction')
            state.transaction.mockRejectedValue(failure)
          else if (stage === 'rls')
            state.tx.$queryRaw.mockRejectedValue(failure)
          else if (method === 'GET')
            state.tx.cart.findFirst.mockRejectedValue(failure)
          else state.tx.cart.upsert.mockRejectedValue(failure)
          const response = await handler(request())
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error:
              mode === 'sync'
                ? 'Erro ao sincronizar carrinho'
                : 'Erro ao mesclar carrinho',
          })
        }
      )
      if (method === 'GET') {
        it('returns the complete nested cart and isolates the owner inside RLS', async () => {
          const response = await handler(request())
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual(cart)
          expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(scope.tenantId)
          expect(state.tx.cart.findFirst).toHaveBeenCalledWith({
            where: scope,
            include,
          })
          expect(state.tx.$executeRaw).not.toHaveBeenCalled()
          expect(state.tx.cart.upsert).not.toHaveBeenCalled()
        })
        it('returns items:[] without creating a cart when none exists', async () => {
          state.tx.cart.findFirst.mockResolvedValue(null)
          expect(await (await handler(request())).json()).toEqual({ items: [] })
          expect(state.tx.cart.upsert).not.toHaveBeenCalled()
        })
        return
      }
      it.each<Record<string, string>>([
        { Origin: 'https://bravo.platform.test' },
        { Origin: 'null' },
        { 'Sec-Fetch-Site': 'same-site' },
      ])(
        'refuses cross-origin mutation before parsing: %j',
        async (headers) => {
          const response = await handler(request('{', headers))
          expect(response.status).toBe(403)
          expect(response.headers.get('cache-control')).toBe('no-store')
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      const invalid = [
        undefined,
        null,
        {},
        'item',
        [null],
        [[]],
        [{ ...item, equipmentId: '' }],
        [{ ...item, quantity: 0 }],
        [{ ...item, quantity: 10001 }],
        [{ ...item, quantity: 1.5 }],
        [{ ...item, quantity: '1' }],
        [{ ...item, days: 0 }],
        [{ ...item, days: 3651 }],
        [{ ...item, days: 1.5 }],
        Array.from({ length: 201 }, () => item),
      ]
      it.each(invalid.map((value, index) => ({ value, index })))(
        'refuses invalid input #$index before transaction',
        async ({ value }) => {
          const response = await handler(
            request(
              JSON.stringify({
                [mode === 'sync' ? 'items' : 'localCartItems']: value,
              })
            )
          )
          expect(response.status).toBe(400)
          expect(await response.json()).toEqual({ error: 'Itens inválidos' })
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it.each(['{', 'null'])(
        'preserves generic 500 for unreadable body %s',
        async (body) => {
          const response = await handler(request(body))
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error:
              mode === 'sync'
                ? 'Erro ao sincronizar carrinho'
                : 'Erro ao mesclar carrinho',
          })
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it('refuses duplicates before transaction', async () => {
        const response = await handler(
          request(
            JSON.stringify({
              [mode === 'sync' ? 'items' : 'localCartItems']: [item, item],
            })
          )
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Equipamento repetido no carrinho',
        })
        expect(state.transaction).not.toHaveBeenCalled()
      })
      it('refuses equipment outside the tenant before changing its cart', async () => {
        state.tx.equipment.findMany.mockResolvedValue([])
        const response = await handler(request())
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Equipamento não encontrado nesta locadora',
        })
        expect(state.tx.cart.upsert).not.toHaveBeenCalled()
        expect(state.tx.cartItem.deleteMany).not.toHaveBeenCalled()
      })
      it('uses server money, owner and per-user lock; keeps merge distinct from replace', async () => {
        const response = await handler(
          request(
            JSON.stringify({
              tenantId: 'foreign',
              userId: 'foreign',
              [mode === 'sync' ? 'items' : 'localCartItems']: [
                {
                  ...item,
                  cartId: 'foreign',
                  tenantId: 'foreign',
                  pricePerDay: 0.01,
                  finalPrice: 0.01,
                },
              ],
            })
          )
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(
          mode === 'sync'
            ? { message: 'Carrinho sincronizado com sucesso' }
            : cart
        )
        expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(scope.tenantId)
        expect(state.tx.$executeRaw.mock.calls[0]![1]).toBe(
          `${scope.tenantId}:cart:${scope.userId}`
        )
        expect(state.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
          state.tx.equipment.findMany.mock.invocationCallOrder[0]!
        )
        expect(state.tx.equipment.findMany).toHaveBeenCalledWith({
          where: { tenantId: scope.tenantId, id: { in: [item.equipmentId] } },
        })
        expect(state.tx.cart.upsert).toHaveBeenCalledWith({
          where: { tenantId_userId: scope },
          update: {},
          create: scope,
        })
        const data = {
          ...item,
          tenantId: scope.tenantId,
          pricePerDay: 45.045,
          finalPrice: 135.14,
        }
        expect(state.tx.cartItem.upsert).toHaveBeenCalledWith({
          where: {
            cartId_equipmentId: {
              cartId: cart.id,
              equipmentId: item.equipmentId,
            },
          },
          update: data,
          create: { ...data, cartId: cart.id },
        })
        if (mode === 'sync')
          expect(state.tx.cartItem.deleteMany).toHaveBeenCalledWith({
            where: { tenantId: scope.tenantId, cartId: cart.id },
          })
        else expect(state.tx.cartItem.deleteMany).not.toHaveBeenCalled()
        expect(state.tx.cart.findUniqueOrThrow).toHaveBeenCalledWith({
          where: { id: cart.id, tenantId: scope.tenantId },
          include,
        })
      })
      it('accepts empty items under the same lock', async () => {
        state.tx.equipment.findMany.mockResolvedValue([])
        expect(
          (
            await handler(
              request(
                JSON.stringify({
                  [mode === 'sync' ? 'items' : 'localCartItems']: [],
                })
              )
            )
          ).status
        ).toBe(200)
        expect(state.tx.cartItem.upsert).not.toHaveBeenCalled()
        expect(state.tx.$executeRaw).toHaveBeenCalledOnce()
        expect(state.tx.cartItem.deleteMany).toHaveBeenCalledTimes(
          mode === 'sync' ? 1 : 0
        )
      })
    })
  }
)
