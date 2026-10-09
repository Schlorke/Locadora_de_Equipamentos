import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  CreateMaintenanceSchema,
  UpdateMaintenanceSchema,
  CompleteMaintenanceSchema,
  SchedulePreventiveSchema,
} from '@gb-locacoes/contracts/operations'
import type { MaintenanceService } from '../modules/operations/maintenance'
import type { AuditReadService } from '../modules/operations/audit-read'

export function createMaintenanceHandlers(service: MaintenanceService) {
  const filters = async (request: Request) => {
    const { searchParams } = new URL(request.url)
    return {
      equipmentId: searchParams.get('equipmentId'),
      status: searchParams.get('status'),
      type: searchParams.get('type'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      includeOverdue: searchParams.get('includeOverdue') === 'true',
    }
  }
  return {
    async listMaintenances(principal: TenantContext, request: Request) {
      return Response.json({
        maintenances: await service.listMaintenances(principal, () =>
          filters(request)
        ),
      })
    },
    async listScheduledMaintenances(
      principal: TenantContext,
      request: Request
    ) {
      return Response.json(
        await service.listScheduledMaintenances(principal, () =>
          filters(request)
        )
      )
    },
    async createMaintenance(principal: TenantContext, request: Request) {
      return Response.json(
        {
          maintenance: await service.createMaintenance(principal, async () =>
            CreateMaintenanceSchema.parse(await request.json())
          ),
        },
        { status: 201 }
      )
    },
    async schedulePreventiveMaintenance(
      principal: TenantContext,
      request: Request
    ) {
      return Response.json(
        {
          maintenance: await service.schedulePreventiveMaintenance(
            principal,
            async () => SchedulePreventiveSchema.parse(await request.json())
          ),
        },
        { status: 201 }
      )
    },
    async updateMaintenance(
      principal: TenantContext,
      request: Request,
      id: string
    ) {
      return Response.json({
        maintenance: await service.updateMaintenance(principal, id, async () =>
          UpdateMaintenanceSchema.parse(await request.json())
        ),
      })
    },
    async completeMaintenance(
      principal: TenantContext,
      request: Request,
      { params }: { params: Promise<{ id: string }> }
    ) {
      return Response.json({
        maintenance: await service.completeMaintenance(principal, async () => {
          const { id } = await params
          return {
            id,
            data: CompleteMaintenanceSchema.parse(await request.json()),
          }
        }),
      })
    },
  }
}
export function createAuditReadHandler({ getAuditLogs }: AuditReadService) {
  return async function readAuditLogs(
    principal: TenantContext,
    request: Request
  ) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const entity = searchParams.get('entity')
    const entityId = searchParams.get('entityId')
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '50')
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      [startDate, endDate].some(
        (value) => value && Number.isNaN(new Date(value).getTime())
      )
    )
      return Response.json({ error: 'Filtros inválidos' }, { status: 400 })
    const offset = (page - 1) * limit

    const { logs, total } = await getAuditLogs(principal, {
      userId: userId || undefined,
      entity: entity || undefined,
      entityId: entityId || undefined,
      action: action || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    })

    return Response.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  }
}
