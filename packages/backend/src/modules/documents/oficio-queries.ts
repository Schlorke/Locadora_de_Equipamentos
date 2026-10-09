import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantTransactionRunner } from '../rentals/index'
export function createOficioQueries({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function readOficioQuote(context: TenantContext, id: string) {
    const quote = await withTenantTransaction(context, (prisma) =>
      prisma.quote.findUnique({
        where: { id, tenantId: context.tenantId },
        include: {
          items: {
            include: {
              equipment: { include: { category: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          adjustments: {
            include: { createdByUser: true },
            orderBy: { createdAt: 'asc' },
          },
          payments: {
            orderBy: { dueDate: 'asc' },
          },
          user: {
            include: { addresses: { where: { tenantId: context.tenantId } } },
          },
        },
      })
    )
    return quote
  }
  async function readOficioPayment(context: TenantContext, id: string) {
    const record = await withTenantTransaction(context, (prisma) =>
      prisma.payment.findUnique({
        where: { id, tenantId: context.tenantId },
        include: {
          quote: {
            include: {
              items: {
                include: {
                  equipment: { include: { category: true } },
                },
                orderBy: { createdAt: 'asc' },
              },
              adjustments: {
                include: { createdByUser: true },
                orderBy: { createdAt: 'asc' },
              },
              user: {
                include: {
                  addresses: { where: { tenantId: context.tenantId } },
                },
              },
            },
          },
          rental: {
            include: {
              quote: {
                include: {
                  items: {
                    include: {
                      equipment: { include: { category: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                  },
                  adjustments: {
                    include: { createdByUser: true },
                    orderBy: { createdAt: 'asc' },
                  },
                  user: {
                    include: {
                      addresses: { where: { tenantId: context.tenantId } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    )
    return record
  }
  return { readOficioQuote, readOficioPayment }
}
