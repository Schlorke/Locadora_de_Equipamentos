import { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { admitRentalCommand } from '../entitlements/command-admission'
import {
  calculateRentalLateFee,
  roundToCents,
} from '@gb-locacoes/domain/locacao'
import type { QuoteConversion } from './conversion'
import { RentalMutationError } from './errors'
import {
  rentalResponseInclude,
  rentalStatusFilter,
  type ManualRentalInput,
  type RentalLifecycle,
} from './lifecycle'
import type { RentalTransaction, TenantTransactionRunner } from './types'

/** Filtros da listagem administrativa, já lidos da URL pelo adaptador HTTP. */
export type AdminRentalFilters = {
  status: string | null
  userId: string | null
  startDate: string | null
  endDate: string | null
  page: number
  limit: number
  includeOrphans: boolean
}

const adminListInclude = {
  users: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  rental_items: {
    include: {
      equipments: {
        select: {
          id: true,
          name: true,
          images: true,
        },
      },
    },
  },
  quote: {
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      status: true, // Incluir status para filtrar no frontend
    },
  },
  payments: {
    select: {
      id: true,
      amount: true,
      status: true,
      method: true,
      paidAt: true,
    },
  },
  contract: {
    select: {
      id: true,
      status: true,
      signedAt: true,
      pdfUrl: true,
    },
  },
} satisfies Prisma.rentalsInclude

const adminDetailInclude = {
  users: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      cnpj: true,
    },
  },
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
} satisfies Prisma.rentalsInclude

const createdRentalInclude = {
  ...rentalResponseInclude,
  contract: {
    select: {
      id: true,
      status: true,
      signedAt: true,
      pdfUrl: true,
    },
  },
} satisfies Prisma.rentalsInclude

/** Operações administrativas de locação da locadora ativa (listagem, detalhe, criação e multa). */
export function createRentalAdministration({
  withTenantTransaction,
  withRentalTransaction,
  convertQuoteToRental,
  createManualRental,
}: {
  withTenantTransaction: TenantTransactionRunner
  withRentalTransaction: RentalTransaction
  convertQuoteToRental: QuoteConversion['convertQuoteToRental']
  createManualRental: RentalLifecycle['createManualRental']
}) {
  async function listAdminRentals(
    context: TenantContext,
    filters: AdminRentalFilters
  ) {
    const { status, userId, startDate, endDate, page, limit, includeOrphans } =
      filters
    const skip = (page - 1) * limit

    // Construir condições de filtro
    const whereConditions: Prisma.rentalsWhereInput = {
      tenantId: context.tenantId,
    }

    // Aplicar filtro de status se fornecido
    if (status) {
      whereConditions.status = rentalStatusFilter(status)
    } else {
      // Se não há filtro de status, excluir locações canceladas por padrão
      whereConditions.status = {
        not: 'CANCELLED',
      }
    }

    // Excluir locações vinculadas a orçamentos rejeitados
    whereConditions.NOT = {
      quote: {
        status: 'REJECTED',
      },
    }

    // Ocultar locações órfãs (sem quoteId) por padrão para evitar pendências
    // criadas antes da vinculação correta do orçamento. Para depuração, usar
    // `?includeOrphans=true`.
    if (!includeOrphans) {
      whereConditions.quoteId = {
        not: null,
      }
    }

    if (userId) whereConditions.userid = userId
    if (startDate || endDate) {
      whereConditions.startdate = {}
      if (startDate) whereConditions.startdate.gte = new Date(startDate)
      if (endDate) whereConditions.startdate.lte = new Date(endDate)
    }

    const where = whereConditions

    const [allRentals, total] = await withTenantTransaction(context, (tx) =>
      Promise.all([
        tx.rentals.findMany({
          where,
          include: adminListInclude,
          orderBy: {
            createdat: 'desc',
          },
          skip,
          take: limit,
        }),
        tx.rentals.count({ where }),
      ])
    )

    // Filtro adicional no código para garantir que locações de orçamentos rejeitados/ou órfãs sejam excluídas
    // Isso serve como fallback caso a query Prisma não funcione corretamente
    const rentals = allRentals.filter((rental) => {
      if (rental.quote?.status === 'REJECTED') return false
      if (!includeOrphans && !rental.quoteId) return false
      return true
    })

    return {
      rentals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  function readAdminRental(context: TenantContext, id: string) {
    return withTenantTransaction(context, (tx) =>
      tx.rentals.findUnique({
        where: { id, tenantId: context.tenantId },
        include: adminDetailInclude,
      })
    )
  }

  /** Com `quoteId`, converte o orçamento (sem boleto); sem ele, cria a locação manual. */
  async function createAdminRental(
    context: TenantContext,
    input: ManualRentalInput & { quoteId?: string }
  ) {
    const converted = input.quoteId
      ? await convertQuoteToRental(context, input.quoteId, {
          generateBoleto: false,
        })
      : null
    return converted
      ? await withTenantTransaction(context, (tx) =>
          tx.rentals.findUniqueOrThrow({
            where: {
              tenantId: context.tenantId,
              id: converted.rentalId,
            },
            include: createdRentalInclude,
          })
        )
      : await createManualRental(context, input)
  }

  /** Calcula a multa por atraso da locação em uso e registra a cobrança uma única vez. */
  function applyRentalLateFee(context: TenantContext, id: string) {
    return withRentalTransaction(context, async (tx) => {
      const rental = await tx.rentals.findUnique({
        where: { id: id, tenantId: context.tenantId },
        include: {
          rental_items: {
            include: {
              equipments: true,
            },
          },
        },
      })

      if (!rental) return { outcome: 'not_found' as const }
      await admitRentalCommand(tx, context, {})

      if (!['ACTIVE', 'OVERDUE', 'PENDING_RETURN'].includes(rental.status))
        throw new RentalMutationError('Locação não está em uso', 409)

      const now = new Date()
      const endDate = new Date(rental.enddate)
      const calculated = calculateRentalLateFee({
        total: rental.total.toString(),
        startDate: new Date(rental.startdate),
        endDate,
        currentDate: now,
      })

      if (!calculated.overdue) return { outcome: 'not_overdue' as const }

      const { daysOverdue } = calculated
      // Multa em centavos (Decimal): o valor gravado é o mesmo que o provedor cobra.
      const lateFeeAmount = new Prisma.Decimal(roundToCents(calculated.lateFee))
      const lateFee = lateFeeAmount.toNumber()

      // Atualizar locação com multa e status
      const updatedRental = await tx.rentals.update({
        where: { id: id, tenantId: context.tenantId },
        data: {
          lateFee: lateFeeAmount,
          status: 'OVERDUE',
        },
      })

      // Criar pagamento para a multa se ainda não existir
      const existingLateFeePayment = await tx.payment.findFirst({
        where: {
          tenantId: context.tenantId,
          rentalId: id,
          type: 'LATE_FEE',
          status: {
            in: ['PENDING', 'OVERDUE'],
          },
        },
      })

      if (!existingLateFeePayment && lateFeeAmount.gt(0)) {
        await tx.payment.create({
          data: {
            tenantId: context.tenantId,
            rentalId: id,
            amount: lateFeeAmount,
            method: 'PIX',
            status: 'OVERDUE',
            type: 'LATE_FEE',
            dueDate: now,
          },
        })
      }

      return {
        outcome: 'applied' as const,
        rental: updatedRental,
        lateFee,
        daysOverdue,
      }
    })
  }

  return {
    listAdminRentals,
    readAdminRental,
    createAdminRental,
    applyRentalLateFee,
  }
}

export type RentalAdministration = ReturnType<typeof createRentalAdministration>
export type RentalLateFeeOutcome = Awaited<
  ReturnType<RentalAdministration['applyRentalLateFee']>
>
