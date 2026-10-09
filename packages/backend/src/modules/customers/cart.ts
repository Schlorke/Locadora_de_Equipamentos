import type { PrismaClient } from '@prisma/client'
import { buildQuotePricing } from '@gb-locacoes/domain/orcamento'
import { withTenantTransaction, type TenantPrincipal } from '../identity/index'
import { CustomerError } from './errors'

export type CartItemInput = {
  equipmentId: string
  quantity: number
  days: number
}

const MAX_CART_ITEMS = 200
const MAX_QUANTITY = 10_000
const MAX_DAYS = 3650

const cartInclude = {
  items: { include: { equipment: { include: { category: true } } } },
} as const

const positiveInteger = (value: unknown, max: number): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= max

/**
 * Aceita apenas `{ equipmentId, quantity, days }` inteiros e positivos, até 200
 * itens; preços e demais campos enviados pelo cliente são descartados.
 */
function parseCartItems(input: unknown): CartItemInput[] {
  const invalid = () => new CustomerError('Itens inválidos', 400)
  if (!Array.isArray(input) || input.length > MAX_CART_ITEMS) throw invalid()
  return input.map((item: unknown) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item))
      throw invalid()
    const { equipmentId, quantity, days } = item as Record<string, unknown>
    if (
      typeof equipmentId !== 'string' ||
      equipmentId.length < 1 ||
      !positiveInteger(quantity, MAX_QUANTITY) ||
      !positiveInteger(days, MAX_DAYS)
    )
      throw invalid()
    return { equipmentId, quantity, days }
  })
}

function requireCustomer(context: TenantPrincipal) {
  if (context.role !== 'CLIENT')
    throw new CustomerError(
      'Carrinho disponível apenas para clientes da locadora',
      403
    )
}

/**
 * Carrinho do cliente na locadora selecionada. Escritas serializam por
 * locadora/usuário e recalculam preços no servidor a partir do catálogo.
 */
export function createCustomerCartService(prisma: PrismaClient) {
  return {
    async readCustomerCart(context: TenantPrincipal) {
      requireCustomer(context)
      return withTenantTransaction(prisma, context, (tx) =>
        tx.cart.findFirst({
          where: { tenantId: context.tenantId, userId: context.userId },
          include: cartInclude,
        })
      )
    },
    async writeCustomerCart(
      context: TenantPrincipal,
      input: unknown,
      mode: 'replace' | 'merge'
    ) {
      requireCustomer(context)
      const items = parseCartItems(input)
      if (new Set(items.map((item) => item.equipmentId)).size !== items.length)
        throw new CustomerError('Equipamento repetido no carrinho', 400)
      return withTenantTransaction(prisma, context, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId + ':cart:' + context.userId}, 0))`
        const equipment = await tx.equipment.findMany({
          where: {
            tenantId: context.tenantId,
            id: { in: items.map((item) => item.equipmentId) },
          },
        })
        if (equipment.length !== items.length)
          throw new CustomerError(
            'Equipamento não encontrado nesta locadora',
            404
          )
        const authoritative = items.map((item) => {
          const prices = buildQuotePricing(
            equipment.find((row) => row.id === item.equipmentId)!,
            item.days,
            item.quantity
          )
          return {
            ...item,
            tenantId: context.tenantId,
            pricePerDay: prices.pricePerDay,
            finalPrice: prices.total,
          }
        })
        const cart = await tx.cart.upsert({
          where: {
            tenantId_userId: {
              tenantId: context.tenantId,
              userId: context.userId,
            },
          },
          update: {},
          create: { tenantId: context.tenantId, userId: context.userId },
        })
        if (mode === 'replace')
          await tx.cartItem.deleteMany({
            where: { tenantId: context.tenantId, cartId: cart.id },
          })
        for (const item of authoritative)
          await tx.cartItem.upsert({
            where: {
              cartId_equipmentId: {
                cartId: cart.id,
                equipmentId: item.equipmentId,
              },
            },
            update: item,
            create: { ...item, cartId: cart.id },
          })
        return tx.cart.findUniqueOrThrow({
          where: { id: cart.id, tenantId: context.tenantId },
          include: cartInclude,
        })
      })
    },
  }
}

export type CustomerCartService = ReturnType<typeof createCustomerCartService>
