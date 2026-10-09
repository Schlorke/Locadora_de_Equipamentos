import type { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { CatalogError } from './errors'
import type { CatalogDependencies } from './types'
import {
  createEquipmentAdmission,
  EquipmentAdmissionError,
} from '../entitlements/equipment-admission'

/** Corpo JSON legado de criação/edição; as regras abaixo o validam. */
export type EquipmentBody = Record<string, unknown>

/** Parâmetros brutos da listagem administrativa (query string). */
export type EquipmentListQuery = {
  page: string | null
  limit: string | null
  search: string | null
  categoryId: string | null
  isAvailable: string | null
}

const adminInclude = {
  category: true,
  _count: { select: { quoteItems: true, rental_items: true } },
} as const

type Money = { toString(): string }

/** Resposta de detalhe/edição: Decimal como number e contagem legada. */
function toEquipmentDetail<
  T extends {
    pricePerDay: Money
    available: boolean
    _count: { quoteItems: number }
  },
>(equipment: T) {
  return {
    ...equipment,
    pricePerDay: Number(equipment.pricePerDay),
    isAvailable: equipment.available, // Mapear available para isAvailable
    _count: {
      quoteItems: equipment._count.quoteItems,
      reviews: 0, // Campo não implementado ainda, usar 0 como padrão
    },
  }
}

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100)

export function createEquipmentAdmin({
  withRentalTransaction,
}: CatalogDependencies) {
  const admitEquipment = createEquipmentAdmission()
  return {
    listEquipments(context: TenantContext, query: EquipmentListQuery) {
      return withRentalTransaction(context, async (tx) => {
        const page = Number.parseInt(query.page || '1')
        const limit = Number.parseInt(query.limit || '100')
        const { search, categoryId, isAvailable: isAvailableParam } = query

        if (isNaN(page) || page < 1)
          throw new CatalogError("Parâmetro 'page' inválido.", 400)
        if (isNaN(limit) || limit < 1)
          throw new CatalogError("Parâmetro 'limit' inválido.", 400)

        const skip = (page - 1) * limit
        const where: {
          tenantId: string
          OR?: Array<{
            name?: { contains: string; mode: 'insensitive' }
            description?: { contains: string; mode: 'insensitive' }
          }>
          categoryId?: string
          available?: boolean
        } = { tenantId: context.tenantId }

        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        }
        if (categoryId && categoryId !== 'all') {
          where.categoryId = categoryId
        }
        if (
          isAvailableParam !== null &&
          isAvailableParam !== undefined &&
          isAvailableParam !== 'all'
        ) {
          where.available = isAvailableParam === 'true'
        }

        const equipments = await tx.equipment.findMany({
          where,
          skip,
          take: limit,
          include: adminInclude,
          orderBy: { createdAt: 'desc' },
        })
        const equipmentsFormatted = equipments.map((equip) => ({
          ...equip,
          pricePerDay: Number(equip.pricePerDay), // Converter Decimal para number
          isAvailable: equip.available,
        }))
        const totalItems = await tx.equipment.count({ where })
        const totalPages = Math.ceil(totalItems / limit)

        return {
          equipments: equipmentsFormatted,
          pagination: { page, limit, totalItems, totalPages },
        }
      })
    },

    createEquipment(context: TenantContext, body: EquipmentBody) {
      return withRentalTransaction(context, async (tx) => {
        const {
          name,
          description,
          pricePerDay,
          categoryId,
          images,
          isAvailable,
          maxStock,
          dailyDiscount,
          weeklyDiscount,
          biweeklyDiscount,
          monthlyDiscount,
          popularPeriod,
          // Direct value pricing configurations
          dailyDirectValue,
          weeklyDirectValue,
          biweeklyDirectValue,
          monthlyDirectValue,
          // Pricing method control (percentage or direct value)
          dailyUseDirectValue,
          weeklyUseDirectValue,
          biweeklyUseDirectValue,
          monthlyUseDirectValue,
          // Períodos de locação oferecidos
          dailyRentalEnabled,
          weeklyRentalEnabled,
          biweeklyRentalEnabled,
          monthlyRentalEnabled,
        } = body

        if (!name || typeof name !== 'string' || name.trim() === '')
          throw new CatalogError('Nome do equipamento é obrigatório.', 400)
        if (
          !description ||
          typeof description !== 'string' ||
          description.trim() === ''
        )
          throw new CatalogError('Descrição do equipamento é obrigatória.', 400)
        if (!categoryId || typeof categoryId !== 'string')
          throw new CatalogError('ID da categoria é obrigatório.', 400)
        if (pricePerDay === undefined || pricePerDay === null)
          throw new CatalogError('Preço por dia é obrigatório.', 400)

        const parsedPrice = Number.parseFloat(String(pricePerDay))
        if (isNaN(parsedPrice) || parsedPrice < 0)
          throw new CatalogError(
            'Preço por dia inválido. Deve ser um número positivo.',
            400
          )

        const categoryExists = await tx.category.findUnique({
          where: { id: categoryId, tenantId: context.tenantId },
        })
        if (!categoryExists)
          throw new CatalogError('Categoria não encontrada.', 404)

        try {
          await admitEquipment(tx, context)
        } catch (error) {
          if (error instanceof EquipmentAdmissionError)
            throw new CatalogError(error.message, error.status, error.body)
          throw error
        }
        const equipment = await tx.equipment.create({
          data: {
            tenantId: context.tenantId,
            name: name.trim(),
            description: description.trim(),
            pricePerDay: parsedPrice,
            categoryId,
            images: Array.isArray(images)
              ? images.filter(
                  (img): img is string =>
                    typeof img === 'string' && img.trim() !== ''
                )
              : [],
            available: typeof isAvailable === 'boolean' ? isAvailable : true,
            // Inventory management
            maxStock: typeof maxStock === 'number' ? maxStock : 1,
            // Rental period configurations
            dailyDiscount:
              typeof dailyDiscount === 'number'
                ? clampPercent(dailyDiscount)
                : 0,
            weeklyDiscount:
              typeof weeklyDiscount === 'number'
                ? clampPercent(weeklyDiscount)
                : 0,
            biweeklyDiscount:
              typeof biweeklyDiscount === 'number'
                ? clampPercent(biweeklyDiscount)
                : 0,
            monthlyDiscount:
              typeof monthlyDiscount === 'number'
                ? clampPercent(monthlyDiscount)
                : 0,
            popularPeriod:
              typeof popularPeriod === 'string' ? popularPeriod : 'weekly',
            // Direct value pricing configurations
            dailyDirectValue:
              typeof dailyDirectValue === 'number' ? dailyDirectValue : 0,
            weeklyDirectValue:
              typeof weeklyDirectValue === 'number' ? weeklyDirectValue : 0,
            biweeklyDirectValue:
              typeof biweeklyDirectValue === 'number' ? biweeklyDirectValue : 0,
            monthlyDirectValue:
              typeof monthlyDirectValue === 'number' ? monthlyDirectValue : 0,
            // Pricing method control (percentage or direct value)
            dailyUseDirectValue:
              typeof dailyUseDirectValue === 'boolean'
                ? dailyUseDirectValue
                : false,
            weeklyUseDirectValue:
              typeof weeklyUseDirectValue === 'boolean'
                ? weeklyUseDirectValue
                : false,
            biweeklyUseDirectValue:
              typeof biweeklyUseDirectValue === 'boolean'
                ? biweeklyUseDirectValue
                : false,
            monthlyUseDirectValue:
              typeof monthlyUseDirectValue === 'boolean'
                ? monthlyUseDirectValue
                : false,
            // Períodos de locação oferecidos (default true)
            dailyRentalEnabled:
              typeof dailyRentalEnabled === 'boolean'
                ? dailyRentalEnabled
                : true,
            weeklyRentalEnabled:
              typeof weeklyRentalEnabled === 'boolean'
                ? weeklyRentalEnabled
                : true,
            biweeklyRentalEnabled:
              typeof biweeklyRentalEnabled === 'boolean'
                ? biweeklyRentalEnabled
                : true,
            monthlyRentalEnabled:
              typeof monthlyRentalEnabled === 'boolean'
                ? monthlyRentalEnabled
                : true,
          },
          include: { category: true },
        })

        // Converter Decimal para number para compatibilidade com o frontend
        return {
          ...equipment,
          pricePerDay: Number(equipment.pricePerDay),
          isAvailable: equipment.available,
        }
      })
    },

    readEquipment(context: TenantContext, id: string) {
      return withRentalTransaction(context, async (tx) => {
        const equipment = await tx.equipment.findUnique({
          where: { id, tenantId: context.tenantId },
          include: adminInclude,
        })
        if (!equipment)
          throw new CatalogError('Equipamento não encontrado', 404)
        return toEquipmentDetail(equipment)
      })
    },

    /** Validação do corpo, depois categoria da locadora, depois posse. */
    updateEquipment(context: TenantContext, id: string, body: EquipmentBody) {
      return withRentalTransaction(context, async (tx) => {
        const {
          name,
          description,
          specifications,
          pricePerDay,
          categoryId,
          images,
          isAvailable,
          maxStock,
          dailyDiscount,
          weeklyDiscount,
          biweeklyDiscount,
          monthlyDiscount,
          popularPeriod,
          // Direct value pricing configurations
          dailyDirectValue,
          weeklyDirectValue,
          biweeklyDirectValue,
          monthlyDirectValue,
          // Pricing method control (percentage or direct value)
          dailyUseDirectValue,
          weeklyUseDirectValue,
          biweeklyUseDirectValue,
          monthlyUseDirectValue,
          // Períodos de locação oferecidos
          dailyRentalEnabled,
          weeklyRentalEnabled,
          biweeklyRentalEnabled,
          monthlyRentalEnabled,
          partsLossHistory,
          partsLossCount,
        } = body

        if (!name || typeof name !== 'string')
          throw new CatalogError(
            'Nome é obrigatório e deve ser uma string',
            400
          )
        if (!description || typeof description !== 'string')
          throw new CatalogError(
            'Descrição é obrigatória e deve ser uma string',
            400
          )
        if (!pricePerDay || isNaN(parseFloat(String(pricePerDay))))
          throw new CatalogError(
            'Preço por dia é obrigatório e deve ser um número válido',
            400
          )
        if (!categoryId || typeof categoryId !== 'string')
          throw new CatalogError('ID da categoria é obrigatório', 400)

        // UncheckedUpdateInput (categoryId direto em vez de category: { connect })
        // evita problemas de validação do Prisma com driver adapter
        const updateData: Prisma.EquipmentUncheckedUpdateInput = {
          name,
          description,
          pricePerDay: parseFloat(String(pricePerDay)),
          categoryId,
        }

        if (specifications !== undefined) {
          updateData.specifications = (specifications ||
            {}) as Prisma.InputJsonValue
        }
        if (images !== undefined) {
          if (Array.isArray(images)) {
            updateData.images = images as string[]
          } else {
            console.warn('Images não é um array:', images)
            updateData.images = []
          }
        }
        if (isAvailable !== undefined) {
          updateData.available = Boolean(isAvailable)
        }

        // Inventory management
        if (maxStock !== undefined) {
          const maxStockNum = parseInt(String(maxStock))
          if (!isNaN(maxStockNum) && maxStockNum > 0) {
            updateData.maxStock = maxStockNum
          }
        }

        // Rental period configurations
        const discount = (value: unknown) => {
          if (value === undefined) return undefined
          const parsed = parseInt(String(value))
          return isNaN(parsed) ? undefined : clampPercent(parsed)
        }
        const daily = discount(dailyDiscount)
        if (daily !== undefined) updateData.dailyDiscount = daily
        const weekly = discount(weeklyDiscount)
        if (weekly !== undefined) updateData.weeklyDiscount = weekly
        const biweekly = discount(biweeklyDiscount)
        if (biweekly !== undefined) updateData.biweeklyDiscount = biweekly
        const monthly = discount(monthlyDiscount)
        if (monthly !== undefined) updateData.monthlyDiscount = monthly

        if (popularPeriod !== undefined) {
          const validPeriods = ['daily', 'weekly', 'biweekly', 'monthly']
          if (
            typeof popularPeriod === 'string' &&
            validPeriods.includes(popularPeriod)
          ) {
            updateData.popularPeriod = popularPeriod
          }
        }

        // Direct value pricing configurations — plain numbers (Prisma accepts number for Decimal)
        const directValue = (value: unknown) => {
          if (value === undefined) return undefined
          const num = parseFloat(String(value))
          return !isNaN(num) && num >= 0 ? num : undefined
        }
        const dailyDirect = directValue(dailyDirectValue)
        if (dailyDirect !== undefined) updateData.dailyDirectValue = dailyDirect
        const weeklyDirect = directValue(weeklyDirectValue)
        if (weeklyDirect !== undefined)
          updateData.weeklyDirectValue = weeklyDirect
        const biweeklyDirect = directValue(biweeklyDirectValue)
        if (biweeklyDirect !== undefined)
          updateData.biweeklyDirectValue = biweeklyDirect
        const monthlyDirect = directValue(monthlyDirectValue)
        if (monthlyDirect !== undefined)
          updateData.monthlyDirectValue = monthlyDirect

        // Pricing method control (percentage or direct value)
        if (dailyUseDirectValue !== undefined)
          updateData.dailyUseDirectValue = Boolean(dailyUseDirectValue)
        if (weeklyUseDirectValue !== undefined)
          updateData.weeklyUseDirectValue = Boolean(weeklyUseDirectValue)
        if (biweeklyUseDirectValue !== undefined)
          updateData.biweeklyUseDirectValue = Boolean(biweeklyUseDirectValue)
        if (monthlyUseDirectValue !== undefined)
          updateData.monthlyUseDirectValue = Boolean(monthlyUseDirectValue)

        // Períodos de locação oferecidos (ativar/desativar orçamento por período)
        if (dailyRentalEnabled !== undefined)
          updateData.dailyRentalEnabled = Boolean(dailyRentalEnabled)
        if (weeklyRentalEnabled !== undefined)
          updateData.weeklyRentalEnabled = Boolean(weeklyRentalEnabled)
        if (biweeklyRentalEnabled !== undefined)
          updateData.biweeklyRentalEnabled = Boolean(biweeklyRentalEnabled)
        if (monthlyRentalEnabled !== undefined)
          updateData.monthlyRentalEnabled = Boolean(monthlyRentalEnabled)

        // Parts loss tracking
        if (partsLossHistory !== undefined) {
          updateData.partsLossHistory =
            partsLossHistory as Prisma.InputJsonValue
        }
        if (partsLossCount !== undefined) {
          const partsLossCountNum = parseInt(String(partsLossCount))
          if (!isNaN(partsLossCountNum) && partsLossCountNum >= 0) {
            updateData.partsLossCount = partsLossCountNum
          }
        }

        if (
          !(await tx.category.findFirst({
            where: { id: categoryId, tenantId: context.tenantId },
            select: { id: true },
          }))
        )
          throw new CatalogError('Categoria não encontrada', 404)
        const existingEquipment = await tx.equipment.findUnique({
          where: { id, tenantId: context.tenantId },
        })
        if (!existingEquipment)
          throw new CatalogError('Equipamento não encontrado', 404)

        const equipment = await tx.equipment.update({
          where: { id, tenantId: context.tenantId },
          data: updateData,
          include: adminInclude,
        })
        return toEquipmentDetail(equipment)
      })
    },

    deleteEquipment(context: TenantContext, id: string) {
      return withRentalTransaction(context, async (tx) => {
        const equipment = await tx.equipment.findUnique({
          where: { id, tenantId: context.tenantId },
          select: { images: true },
        })
        if (!equipment)
          throw new CatalogError('Equipamento não encontrado', 404)
        await tx.equipment.delete({ where: { id, tenantId: context.tenantId } })
      })
    },
  }
}
