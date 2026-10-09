import type { EquipmentUnitStatus } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { CatalogError } from './errors'
import type { CatalogDependencies, DeferredInput } from './types'

/** Unidade física nova já validada pelo contrato do adaptador HTTP. */
export type UnitCreateInput = {
  equipmentId: string
  uniqueCode: string
  serialNumber?: string
  notes?: string
  hourMeter?: number
  odometer?: number
}

/** Alteração de unidade já validada pelo contrato do adaptador HTTP. */
export type UnitPatch = {
  uniqueCode?: string
  status?: EquipmentUnitStatus
  hourMeter?: number
  odometer?: number
  serialNumber?: string
  notes?: string
}

/** Filtros brutos da listagem (query string). */
export type UnitFilters = {
  equipmentId: string | null
  status: string | null
  search: string | null
}

const unitInclude = {
  equipment: {
    select: { id: true, name: true, category: { select: { name: true } } },
  },
} as const

export function createUnitAdmin({
  withRentalTransaction,
}: CatalogDependencies) {
  return {
    listUnits(context: TenantContext, filters: UnitFilters) {
      return withRentalTransaction(context, (tx) => {
        const { equipmentId, status, search } = filters
        const where: {
          tenantId: string
          equipmentId?: string
          status?: EquipmentUnitStatus
          OR?: Array<{
            uniqueCode?: { contains: string; mode: 'insensitive' }
            serialNumber?: { contains: string; mode: 'insensitive' }
          }>
        } = { tenantId: context.tenantId }
        if (equipmentId) where.equipmentId = equipmentId
        if (status) where.status = status as EquipmentUnitStatus
        if (search) {
          where.OR = [
            { uniqueCode: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
          ]
        }
        return tx.equipmentUnit.findMany({
          where,
          include: unitInclude,
          orderBy: { uniqueCode: 'asc' },
        })
      })
    },

    /** Código único por locadora; o equipamento precisa ser da mesma locadora. */
    createUnit(context: TenantContext, input: UnitCreateInput) {
      return withRentalTransaction(context, async (tx) => {
        const existingUnit = await tx.equipmentUnit.findFirst({
          where: { tenantId: context.tenantId, uniqueCode: input.uniqueCode },
        })
        if (existingUnit) throw new CatalogError('Código único já existe', 400)
        const equipment = await tx.equipment.findUnique({
          where: { id: input.equipmentId, tenantId: context.tenantId },
        })
        if (!equipment)
          throw new CatalogError('Equipamento não encontrado', 404)
        return tx.equipmentUnit.create({
          data: {
            tenantId: context.tenantId,
            equipmentId: input.equipmentId,
            uniqueCode: input.uniqueCode,
            serialNumber: input.serialNumber,
            notes: input.notes,
            hourMeter: input.hourMeter ? input.hourMeter : undefined,
            odometer: input.odometer ? input.odometer : undefined,
            status: 'AVAILABLE',
          },
          include: unitInclude,
        })
      })
    },

    readUnit(context: TenantContext, id: string) {
      return withRentalTransaction(context, async (tx) => {
        const unit = await tx.equipmentUnit.findFirst({
          where: { id, tenantId: context.tenantId },
          include: unitInclude,
        })
        if (!unit) throw new CatalogError('Unidade não encontrada', 404)
        return unit
      })
    },

    /** A posse é verificada antes de o corpo ser lido e validado. */
    updateUnit(
      context: TenantContext,
      id: string,
      readPatch: DeferredInput<UnitPatch>
    ) {
      return withRentalTransaction(context, async (tx) => {
        if (
          !(await tx.equipmentUnit.findFirst({
            where: { id, tenantId: context.tenantId },
            select: { id: true },
          }))
        )
          throw new CatalogError('Registro não encontrado', 404)
        const validatedData = await readPatch()

        if (validatedData.uniqueCode) {
          const existingUnit = await tx.equipmentUnit.findFirst({
            where: {
              tenantId: context.tenantId,
              uniqueCode: validatedData.uniqueCode,
            },
          })
          if (existingUnit && existingUnit.id !== id)
            throw new CatalogError('Código único já existe', 400)
        }

        const updateData: {
          uniqueCode?: string
          status?: EquipmentUnitStatus
          hourMeter?: number
          odometer?: number
          serialNumber?: string | null
          notes?: string | null
        } = {}
        if (validatedData.uniqueCode !== undefined)
          updateData.uniqueCode = validatedData.uniqueCode
        if (validatedData.status !== undefined)
          updateData.status = validatedData.status
        if (validatedData.hourMeter !== undefined)
          updateData.hourMeter = validatedData.hourMeter
        if (validatedData.odometer !== undefined)
          updateData.odometer = validatedData.odometer
        if (validatedData.serialNumber !== undefined)
          updateData.serialNumber = validatedData.serialNumber || null
        if (validatedData.notes !== undefined)
          updateData.notes = validatedData.notes || null

        return tx.equipmentUnit.update({
          where: { id, tenantId: context.tenantId },
          data: updateData,
          include: unitInclude,
        })
      })
    },

    /** Unidades RENTED ou RESERVED não podem ser removidas. */
    deleteUnit(context: TenantContext, id: string) {
      return withRentalTransaction(context, async (tx) => {
        const unit = await tx.equipmentUnit.findFirst({
          where: { id, tenantId: context.tenantId },
        })
        if (!unit) throw new CatalogError('Unidade não encontrada', 404)
        if (unit.status === 'RENTED' || unit.status === 'RESERVED')
          throw new CatalogError('Não é possível deletar unidade em uso', 400)
        await tx.equipmentUnit.delete({
          where: { id, tenantId: context.tenantId },
        })
      })
    },
  }
}
