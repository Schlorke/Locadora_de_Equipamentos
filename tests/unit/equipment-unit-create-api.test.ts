import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { CatalogError } from '@gb-locacoes/backend/catalog'

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  db: { $transaction: vi.fn() },
  tx: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    organization: { findUnique: vi.fn() },
    equipment: { findUnique: vi.fn() },
    equipmentUnit: { findFirst: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@/lib/prisma', () => ({ prisma: state.db }))
vi.mock('@/lib/tenant', async () => {
  const { withTenantTransaction } =
    await import('@gb-locacoes/backend/identity')
  return {
    withTenantTransaction: (
      context: { tenantId: string },
      operation: Parameters<typeof withTenantTransaction>[2]
    ) => withTenantTransaction(state.db as never, context, operation),
  }
})
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: state.db }),
}))
import { POST as legacy } from '@/app/api/admin/equipment-units/route'
import { POST as service } from '../../apps/services/api/src/app/api/admin/equipment-units/route'

const principal = {
  tenantId: 'unit-tenant',
  userId: 'unit-user',
  membershipId: 'unit-member',
  role: 'OPERATOR',
}
const input = {
  equipmentId: 'owned-equipment',
  uniqueCode: '  UNIT Code  ',
  serialNumber: ' Serial ',
  notes: ' Notes ',
  hourMeter: 12.345,
  odometer: 45.67,
}
const equipment = {
  id: input.equipmentId,
  name: 'Fixture equipment',
  category: { name: 'Fixture category' },
}
beforeEach(() => {
  vi.resetAllMocks()
  state.permission.mockResolvedValue({ ok: true, principal })
  state.db.$transaction.mockImplementation(async (operation) =>
    operation(state.tx)
  )
  state.tx.$queryRaw.mockResolvedValue([])
  state.tx.$executeRaw.mockResolvedValue(0)
  state.tx.organization.findUnique.mockResolvedValue({ status: 'ACTIVE' })
  state.tx.equipmentUnit.findFirst.mockResolvedValue(null)
  state.tx.equipment.findUnique.mockResolvedValue(equipment)
  state.tx.equipmentUnit.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: 'fixture-unit',
    serialNumber: data.serialNumber ?? null,
    notes: data.notes ?? null,
    hourMeter:
      data.hourMeter === undefined ? null : new Prisma.Decimal(data.hourMeter),
    odometer:
      data.odometer === undefined ? null : new Prisma.Decimal(data.odometer),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    equipment,
  }))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s equipment unit creation', (_host, POST) => {
  const request = (body: unknown = input, raw = false) =>
    new NextRequest(
      'https://app.platform.test/api/admin/equipment-units?tenantId=foreign&role=ADMIN',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw ? String(body) : JSON.stringify(body),
      }
    )
  it('delegates Request and WRITE, then scoped code/equipment queries and creation under the same lock', async () => {
    const incoming = request({
      ...input,
      id: 'foreign',
      tenantId: 'foreign',
      status: 'RENTED',
      extra: true,
    })
    const response = await POST(incoming)
    expect(response.status).toBe(201)
    expect(state.permission).toHaveBeenCalledExactlyOnceWith(
      incoming,
      'EQUIPMENTS',
      'WRITE'
    )
    expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
    expect(state.tx.equipmentUnit.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { tenantId: principal.tenantId, uniqueCode: input.uniqueCode },
    })
    expect(state.tx.equipment.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id: input.equipmentId, tenantId: principal.tenantId },
    })
    expect(state.tx.equipmentUnit.create.mock.calls[0]![0]).toEqual({
      data: { tenantId: principal.tenantId, ...input, status: 'AVAILABLE' },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
          },
        },
      },
    })
    expect(state.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      state.tx.equipmentUnit.create.mock.invocationCallOrder[0]!
    )
    expect(await response.json()).toEqual({
      tenantId: principal.tenantId,
      ...input,
      hourMeter: '12.345',
      odometer: '45.67',
      id: 'fixture-unit',
      status: 'AVAILABLE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      equipment,
    })
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it.each([undefined, 0])(
    'omitted/zero meters (%s) stay undefined in insert and null in DTO',
    async (meter) => {
      const response = await POST(
        request({
          equipmentId: input.equipmentId,
          uniqueCode: ' ',
          hourMeter: meter,
          odometer: meter,
        })
      )
      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        uniqueCode: ' ',
        hourMeter: null,
        odometer: null,
        serialNumber: null,
        notes: null,
      })
      expect(
        state.tx.equipmentUnit.create.mock.calls[0]![0].data
      ).toMatchObject({ hourMeter: undefined, odometer: undefined })
    }
  )
  it.each([400, 401, 403, 404, 409, 503])(
    'forwards principal refusal %s before malformed JSON/transaction',
    async (status) => {
      const refusal = new Response(
        JSON.stringify({ error: 'Fixture denied' }),
        { status, headers: { 'Cache-Control': 'no-store' } }
      )
      state.permission.mockResolvedValueOnce({ ok: false, response: refusal })
      const incoming = request('{', true)
      const body = vi.spyOn(incoming, 'json')
      expect(await POST(incoming)).toBe(refusal)
      expect(body).not.toHaveBeenCalled()
      expect(state.db.$transaction).not.toHaveBeenCalled()
    }
  )
  it.each([
    null,
    [],
    false,
    'fixture',
    {},
    { ...input, uniqueCode: '' },
    { ...input, equipmentId: null },
    { ...input, hourMeter: -1 },
    { ...input, odometer: -1 },
    { ...input, hourMeter: '1' },
    { ...input, serialNumber: null },
    { ...input, notes: null },
  ])(
    'invalid schema %j returns genuine Zod issues before transaction',
    async (value) => {
      const response = await POST(request(value))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(Object.keys(body)).toEqual(['error', 'details'])
      expect(body.error).toBe('Dados inválidos')
      expect(body.details.length).toBeGreaterThan(0)
      expect(body.details[0]).toMatchObject({
        code: expect.any(String),
        path: expect.any(Array),
        message: expect.any(String),
      })
      expect(state.db.$transaction).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()
    }
  )
  it('a duplicate owned code is 400 before equipment lookup/creation', async () => {
    state.tx.equipmentUnit.findFirst.mockResolvedValueOnce({
      id: 'existing-unit',
    })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Código único já existe' })
    expect(state.tx.equipment.findUnique).not.toHaveBeenCalled()
    expect(state.tx.equipmentUnit.create).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
  it.each(['foreign-equipment', ''])(
    'missing or foreign equipment %s is a domain 404',
    async (id) => {
      state.tx.equipment.findUnique.mockResolvedValueOnce(null)
      const response = await POST(request({ ...input, equipmentId: id }))
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Equipamento não encontrado',
      })
      expect(state.tx.equipmentUnit.create).not.toHaveBeenCalled()
    }
  )
  it.each(['{', '', 'undefined'])(
    'malformed JSON %s keeps generic 500',
    async (body) => {
      const response = await POST(request(body, true))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao criar unidade',
      })
      expect(state.db.$transaction).not.toHaveBeenCalled()
    }
  )
  it('preserves CatalogError and recognizes the actual ZodError class', async () => {
    state.permission.mockRejectedValueOnce(
      new CatalogError('Fixture catalog failure', 409)
    )
    const catalog = await POST(request())
    expect(catalog.status).toBe(409)
    expect(await catalog.json()).toEqual({ error: 'Fixture catalog failure' })
    const invalid = z.string().safeParse(null)
    if (invalid.success) throw new Error('Invalid test fixture')
    state.permission.mockRejectedValueOnce(invalid.error)
    const validation = await POST(request())
    expect(validation.status).toBe(400)
    expect(await validation.json()).toEqual({
      error: 'Dados inválidos',
      details: invalid.error.issues,
    })
  })
  it('revalidates ACTIVE inside the mutation transaction before lock', async () => {
    state.tx.organization.findUnique.mockResolvedValueOnce({
      status: 'SUSPENDED',
    })
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Erro ao criar unidade' })
    expect(state.tx.$executeRaw).not.toHaveBeenCalled()
    expect(state.tx.equipmentUnit.create).not.toHaveBeenCalled()
  })
  it.each([
    'permission',
    'transaction',
    'lock',
    'code',
    'equipment',
    'create',
  ] as const)('untyped failure in %s stays generic 500', async (dependency) => {
    const error = new Error('private fixture failure')
    if (dependency === 'permission')
      state.permission.mockRejectedValueOnce(error)
    if (dependency === 'transaction')
      state.db.$transaction.mockRejectedValueOnce(error)
    if (dependency === 'lock') state.tx.$executeRaw.mockRejectedValueOnce(error)
    if (dependency === 'code')
      state.tx.equipmentUnit.findFirst.mockRejectedValueOnce(error)
    if (dependency === 'equipment')
      state.tx.equipment.findUnique.mockRejectedValueOnce(error)
    if (dependency === 'create')
      state.tx.equipmentUnit.create.mockRejectedValueOnce(error)
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Erro ao criar unidade',
    })
    expect(console.error).toHaveBeenCalledWith('Erro ao criar unidade:', error)
  })
  it('a raw P2002 is still generic 500 rather than a new duplicate envelope', async () => {
    state.tx.equipmentUnit.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('private duplicate', {
        code: 'P2002',
        clientVersion: 'fixture',
      })
    )
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Erro ao criar unidade' })
  })
})
