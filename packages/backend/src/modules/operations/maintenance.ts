import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type {
  MaintenanceInput,
  MaintenancePatch,
  MaintenanceCompletion,
  PreventiveMaintenanceInput,
} from '@gb-locacoes/contracts/operations'
import type { Prisma, MaintenanceStatus, MaintenanceType } from '@prisma/client'
import Decimal from 'decimal.js'
import { RentalMutationError } from '../rentals/errors'
import type { OperationsTransaction } from './types'
import { admitOperation } from './admission'
import {
  markEquipmentUnavailableForMaintenance,
  markEquipmentAvailableAfterMaintenance,
  canStartMaintenance,
  checkOverdueMaintenances,
  calculateNextPreventiveMaintenanceDate,
  type PreventiveMaintenanceRules,
} from './maintenance-automation'

export type MaintenanceFilters = {
  equipmentId: string | null
  status: string | null
  type: string | null
  startDate: string | null
  endDate: string | null
}
export function createMaintenanceService({
  withRentalTransaction,
}: {
  withRentalTransaction: OperationsTransaction
}) {
  return {
    listMaintenances(
      principal: TenantContext,
      filters: () => Promise<MaintenanceFilters>
    ) {
      return withRentalTransaction(principal, async (tx) => {
        const { equipmentId, status, type, startDate, endDate } =
          await filters()

        const where: Prisma.MaintenanceWhereInput = {
          tenantId: principal.tenantId,
        }
        if (equipmentId) where.equipmentId = equipmentId
        if (status) where.status = status as MaintenanceStatus
        if (type) where.type = type as MaintenanceType
        if (startDate || endDate) {
          where.scheduledAt = {}
          if (startDate) where.scheduledAt.gte = new Date(startDate)
          if (endDate) where.scheduledAt.lte = new Date(endDate)
        }

        const maintenances = await tx.maintenance.findMany({
          where,
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                images: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            scheduledAt: 'desc',
          },
        })

        return maintenances
      })
    },
    createMaintenance(
      principal: TenantContext,
      input: () => Promise<MaintenanceInput>
    ) {
      return withRentalTransaction(principal, async (tx) => {
        const validatedData = await input()
        await admitOperation(tx, principal, 'maintenance')

        // Verificar se equipamento existe
        const equipment = await tx.equipment.findUnique({
          where: {
            tenantId: principal.tenantId,
            id: validatedData.equipmentId,
          },
        })

        if (!equipment) {
          throw new RentalMutationError('Equipamento não encontrado', 404)
        }

        // Calcular custo total se não fornecido
        let totalCost = validatedData.cost
        if (!totalCost) {
          const labor = validatedData.laborCost || 0
          const parts = validatedData.partsCost || 0
          totalCost = labor + parts
        }

        // Criar manutenção
        const maintenance = await tx.maintenance.create({
          data: {
            tenantId: principal.tenantId,
            equipmentId: validatedData.equipmentId,
            type: validatedData.type,
            scheduledAt: validatedData.scheduledAt,
            cost: totalCost ? new Decimal(totalCost) : null,
            laborCost: validatedData.laborCost
              ? new Decimal(validatedData.laborCost)
              : null,
            partsCost: validatedData.partsCost
              ? new Decimal(validatedData.partsCost)
              : null,
            description: validatedData.description,
            notes: validatedData.notes,
            technician: validatedData.technician,
            status: 'SCHEDULED',
          },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        // Se for manutenção preventiva agendada, marcar equipamento como indisponível
        // (isso pode ser feito via cron job ou quando a manutenção começar)

        return maintenance
      })
    },
    listScheduledMaintenances(
      principal: TenantContext,
      filters: () => Promise<MaintenanceFilters & { includeOverdue: boolean }>
    ) {
      return withRentalTransaction(principal, async (tx) => {
        const {
          equipmentId,
          status,
          type,
          startDate,
          endDate,
          includeOverdue,
        } = await filters()

        const where: Prisma.MaintenanceWhereInput = {
          tenantId: principal.tenantId,
          status: {
            in: ['SCHEDULED', 'IN_PROGRESS'],
          },
        }

        if (equipmentId) where.equipmentId = equipmentId
        if (status) where.status = status as MaintenanceStatus
        if (type) where.type = type as MaintenanceType
        if (startDate || endDate) {
          where.scheduledAt = {}
          if (startDate) where.scheduledAt.gte = new Date(startDate)
          if (endDate) where.scheduledAt.lte = new Date(endDate)
        }

        const maintenances = await tx.maintenance.findMany({
          where,
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                images: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            scheduledAt: 'asc',
          },
        })

        // Buscar manutenções vencidas se solicitado
        let overdueAlerts: Array<{
          id: string
          equipmentId: string
          equipmentName: string
          scheduledAt: Date
          daysOverdue: number
          type: MaintenanceType
        }> = []

        if (includeOverdue) {
          overdueAlerts = await checkOverdueMaintenances(principal, tx)
        }

        return {
          maintenances,
          overdueAlerts,
          overdueCount: overdueAlerts.length,
        }
      })
    },
    schedulePreventiveMaintenance(
      principal: TenantContext,
      input: () => Promise<PreventiveMaintenanceInput>
    ) {
      return withRentalTransaction(principal, async (tx) => {
        const validatedData = await input()
        await admitOperation(tx, principal, 'maintenance')

        // Verificar se equipamento existe
        const equipment = await tx.equipment.findUnique({
          where: {
            tenantId: principal.tenantId,
            id: validatedData.equipmentId,
          },
        })

        if (!equipment) {
          throw new RentalMutationError('Equipamento não encontrado', 404)
        }

        // Calcular próxima data de manutenção
        const scheduledAt = await calculateNextPreventiveMaintenanceDate(
          principal,
          tx,
          validatedData.equipmentId,
          validatedData.rules as PreventiveMaintenanceRules
        )

        if (!scheduledAt) {
          throw new RentalMutationError(
            'Não foi possível calcular data de manutenção',
            400
          )
        }

        // Criar manutenção preventiva
        const maintenance = await tx.maintenance.create({
          data: {
            tenantId: principal.tenantId,
            equipmentId: validatedData.equipmentId,
            type: 'PREVENTIVE',
            scheduledAt,
            description:
              validatedData.description ||
              'Manutenção preventiva agendada automaticamente',
            notes: validatedData.notes,
            technician: validatedData.technician,
            status: 'SCHEDULED',
          },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return maintenance
      })
    },
    updateMaintenance(
      principal: TenantContext,
      id: string,
      input: () => Promise<MaintenancePatch>
    ) {
      return withRentalTransaction(principal, async (tx) => {
        const current = await tx.maintenance.findFirst({
          where: { tenantId: principal.tenantId, id },
        })
        if (!current)
          throw new RentalMutationError('Manutenção não encontrada', 404)
        const validatedData = await input()
        await admitOperation(tx, principal, 'maintenance')

        const updateData: Prisma.MaintenanceUpdateInput = {}
        if (validatedData.status)
          updateData.status = validatedData.status as MaintenanceStatus
        if (validatedData.completedAt)
          updateData.completedAt = validatedData.completedAt
        if (validatedData.cost !== undefined) {
          updateData.cost = new Decimal(validatedData.cost)
          // Recalcular se laborCost ou partsCost não foram fornecidos
          if (!validatedData.laborCost && !validatedData.partsCost) {
            // Manter custo total
          }
        }
        if (validatedData.laborCost !== undefined) {
          updateData.laborCost = new Decimal(validatedData.laborCost)
        }
        if (validatedData.partsCost !== undefined) {
          updateData.partsCost = new Decimal(validatedData.partsCost)
        }
        if (validatedData.description !== undefined) {
          updateData.description = validatedData.description
        }
        if (validatedData.notes !== undefined)
          updateData.notes = validatedData.notes
        if (validatedData.technician !== undefined) {
          updateData.technician = validatedData.technician
        }

        // Se foi completada, atualizar data de conclusão
        if (
          validatedData.status === 'COMPLETED' &&
          !validatedData.completedAt
        ) {
          updateData.completedAt = new Date()
        }

        // Se status está mudando para IN_PROGRESS, validar se pode iniciar
        if (validatedData.status === 'IN_PROGRESS') {
          const maintenance = await tx.maintenance.findUnique({
            where: { tenantId: principal.tenantId, id: id },
            select: { equipmentId: true },
          })

          if (maintenance) {
            const validation = await canStartMaintenance(
              principal,
              tx,
              maintenance.equipmentId
            )
            if (!validation.canStart) {
              throw new RentalMutationError(validation.reason!, 400)
            }
          }
        }

        const maintenance = await tx.maintenance.update({
          where: { tenantId: principal.tenantId, id: id },
          data: updateData,
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        // Atualizar disponibilidade do equipamento baseado no status
        if (validatedData.status === 'IN_PROGRESS') {
          await markEquipmentUnavailableForMaintenance(
            principal,
            tx,
            maintenance.equipment.id
          )
        } else if (validatedData.status === 'COMPLETED') {
          await markEquipmentAvailableAfterMaintenance(
            principal,
            tx,
            maintenance.equipment.id
          )
        }

        return maintenance
      })
    },
    completeMaintenance(
      principal: TenantContext,
      input: () => Promise<{ id: string; data: MaintenanceCompletion }>
    ) {
      return withRentalTransaction(principal, async (tx) => {
        const { id, data: validatedData } = await input()
        await admitOperation(tx, principal, 'maintenance')

        // Buscar manutenção
        const maintenance = await tx.maintenance.findUnique({
          where: { tenantId: principal.tenantId, id: id },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        if (!maintenance) {
          throw new RentalMutationError('Manutenção não encontrada', 404)
        }

        // Calcular custo total se não fornecido
        let totalCost = validatedData.cost
        if (!totalCost) {
          const labor = validatedData.laborCost || 0
          const parts = validatedData.partsCost || 0
          totalCost = labor + parts
        }

        // Atualizar manutenção
        const updateData: {
          status: 'COMPLETED'
          completedAt: Date
          cost?: Decimal
          laborCost?: Decimal
          partsCost?: Decimal
          notes?: string
        } = {
          status: 'COMPLETED',
          completedAt: validatedData.completedAt || new Date(),
        }

        if (totalCost) {
          updateData.cost = new Decimal(totalCost)
        }
        if (validatedData.laborCost !== undefined) {
          updateData.laborCost = new Decimal(validatedData.laborCost)
        }
        if (validatedData.partsCost !== undefined) {
          updateData.partsCost = new Decimal(validatedData.partsCost)
        }
        if (validatedData.notes !== undefined) {
          updateData.notes = validatedData.notes
        }

        // Atualizar manutenção e equipamento em transação
        const updatedMaintenance = await tx.maintenance.update({
          where: { tenantId: principal.tenantId, id: id },
          data: updateData,
          include: { equipment: { select: { id: true, name: true } } },
        })
        if (
          validatedData.hourMeter !== undefined ||
          validatedData.odometer !== undefined
        ) {
          await tx.equipment.update({
            where: {
              tenantId: principal.tenantId,
              id: maintenance.equipmentId,
            },
            data: {
              ...(validatedData.hourMeter !== undefined
                ? { hourMeter: new Decimal(validatedData.hourMeter) }
                : {}),
              ...(validatedData.odometer !== undefined
                ? { odometer: new Decimal(validatedData.odometer) }
                : {}),
            },
          })
        }

        // Marcar equipamento como disponível (se não houver outras manutenções ativas)
        await markEquipmentAvailableAfterMaintenance(
          principal,
          tx,
          maintenance.equipmentId
        )

        return updatedMaintenance
      })
    },
  }
}
export type MaintenanceService = ReturnType<typeof createMaintenanceService>
