import type { Prisma } from '@prisma/client'
import type { TenantPrincipal } from '../identity/index'
import { admitRentalCommand } from '../entitlements/command-admission'
import { rentalStatusFilter } from './lifecycle'
import type { TenantTransactionRunner } from './types'

const clientListInclude = {
  rental_items: {
    include: {
      equipments: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  payments: {
    orderBy: {
      dueDate: 'asc',
    },
  },
  deliveries: {
    orderBy: {
      scheduledAt: 'asc',
    },
  },
  quote: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.rentalsInclude

const clientDetailInclude = {
  rental_items: {
    include: {
      equipments: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    // Incluir priceperday para permitir recálculo se necessário
  },
  payments: {
    orderBy: {
      dueDate: 'asc',
    },
  },
  deliveries: {
    orderBy: {
      scheduledAt: 'asc',
    },
  },
  quote: {
    include: {
      items: {
        include: {
          equipment: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  contract: {
    select: {
      id: true,

      status: true,
      signedAt: true,
    },
  },
} satisfies Prisma.rentalsInclude

/** Portal do cliente: só as locações do próprio usuário na locadora ativa. */
export function createClientRentalPortal({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  function listClientRentals(
    principal: TenantPrincipal,
    status: string | null
  ) {
    return withTenantTransaction(principal, async (tx) => {
      const where: {
        tenantId: string
        userid: string
        status?: Prisma.rentalsWhereInput['status']
        clientDeletedAt: null
      } = {
        tenantId: principal.tenantId,
        clientDeletedAt: null,
        userid: principal.userId,
      }
      if (status) where.status = rentalStatusFilter(status)

      const allRentals = await tx.rentals.findMany({
        where,
        include: clientListInclude,
        orderBy: {
          createdat: 'desc',
        },
      })

      // Excluir soft delete: locações marcadas como excluídas pelo cliente
      return allRentals.filter((r) => r.clientDeletedAt == null)
    })
  }

  /** `null` quando a locação não é do cliente ou foi removida do histórico dele. */
  function readClientRental(principal: TenantPrincipal, id: string) {
    return withTenantTransaction(principal, async (tx) => {
      const rental = await tx.rentals.findFirst({
        where: {
          tenantId: principal.tenantId,
          id: id,
          userid: principal.userId, // Garantir que é do cliente logado
        },
        include: clientDetailInclude,
      })
      return !rental || rental.clientDeletedAt != null ? null : rental
    })
  }

  /** Soft delete pelo cliente (não afeta o painel admin); `false` quando não é dele. */
  function hideClientRental(principal: TenantPrincipal, id: string) {
    return withTenantTransaction(principal, async (tx) => {
      // Verificar se a locação pertence ao cliente logado
      const rental = await tx.rentals.findFirst({
        where: {
          tenantId: principal.tenantId,
          id: id,
          userid: principal.userId,
        },
      })

      if (!rental) return false
      await admitRentalCommand(tx, principal, {})

      await tx.rentals.update({
        where: {
          tenantId: principal.tenantId,
          userid: principal.userId,
          id: id,
        },
        data: { clientDeletedAt: new Date() },
      })
      return true
    })
  }

  return { listClientRentals, readClientRental, hideClientRental }
}

export type ClientRentalPortal = ReturnType<typeof createClientRentalPortal>
