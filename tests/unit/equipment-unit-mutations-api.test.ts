import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { CatalogError } from '@gb-locacoes/backend/catalog'

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  db: { $transaction: vi.fn() },
  tx: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    organization: { findUnique: vi.fn() },
    equipmentUnit: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
import * as legacy from '@/app/api/admin/equipment-units/[id]/route'
import * as service from '../../apps/services/api/src/app/api/admin/equipment-units/[id]/route'

const principal = {
  tenantId: 'unit-tenant',
  userId: 'unit-user',
  membershipId: 'unit-member',
  role: 'OPERATOR',
}
const unit = {
  id: 'owned-unit',
  tenantId: principal.tenantId,
  equipmentId: 'owned-equipment',
  uniqueCode: 'Original',
  status: 'AVAILABLE',
  hourMeter: new Prisma.Decimal('12.5'),
  odometer: new Prisma.Decimal('45.67'),
  serialNumber: 'Serial',
  notes: 'Notes',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  equipment: {
    id: 'owned-equipment',
    name: 'Fixture',
    category: { name: 'Category' },
  },
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
  state.tx.equipmentUnit.findFirst.mockImplementation(async ({ where }) =>
    where.id ? unit : null
  )
  state.tx.equipmentUnit.update.mockImplementation(async ({ data }) => ({
    ...unit,
    ...data,
    hourMeter:
      data.hourMeter === undefined
        ? unit.hourMeter
        : new Prisma.Decimal(data.hourMeter),
    odometer:
      data.odometer === undefined
        ? unit.odometer
        : new Prisma.Decimal(data.odometer),
  }))
  state.tx.equipmentUnit.delete.mockResolvedValue(unit)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s unit mutations', (_name, handlers) => {
  const params = () => ({ params: Promise.resolve({ id: unit.id }) })
  const request = (method: string, body: unknown = {}, raw = false) =>
    new NextRequest(
      `https://app.platform.test/api/admin/equipment-units/${unit.id}?tenantId=foreign&role=ADMIN`,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: raw ? String(body) : JSON.stringify(body),
      }
    )
  const noEffect = () => {
    expect(state.tx.equipmentUnit.update).not.toHaveBeenCalled()
    expect(state.tx.equipmentUnit.delete).not.toHaveBeenCalled()
  }
  it('PATCH confirms ownership under lock before parsing and applies only validated fields with full DTO', async () => {
    const incoming = request('PATCH', {
      uniqueCode: ' New Code ',
      status: 'MAINTENANCE',
      hourMeter: 0,
      odometer: 1.234,
      serialNumber: '',
      notes: '',
      equipmentId: 'foreign',
      tenantId: 'foreign',
      id: 'foreign',
      extra: true,
    })
    const body = vi.spyOn(incoming, 'json')
    const response = await handlers.PATCH(incoming, params())
    expect(response.status).toBe(200)
    expect(state.permission).toHaveBeenCalledExactlyOnceWith(
      incoming,
      'EQUIPMENTS',
      'WRITE'
    )
    expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
    expect(state.tx.equipmentUnit.findFirst.mock.calls[0]![0]).toEqual({
      where: { id: unit.id, tenantId: principal.tenantId },
      select: { id: true },
    })
    expect(
      state.tx.equipmentUnit.findFirst.mock.invocationCallOrder[0]
    ).toBeLessThan(body.mock.invocationCallOrder[0]!)
    expect(state.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      state.tx.equipmentUnit.findFirst.mock.invocationCallOrder[0]!
    )
    const write = state.tx.equipmentUnit.update.mock.calls[0]![0]
    expect(write).toEqual({
      where: { id: unit.id, tenantId: principal.tenantId },
      data: {
        uniqueCode: ' New Code ',
        status: 'MAINTENANCE',
        hourMeter: 0,
        odometer: 1.234,
        serialNumber: null,
        notes: null,
      },
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
    expect(await response.json()).toEqual(
      JSON.parse(
        JSON.stringify({
          ...unit,
          ...write.data,
          hourMeter: '0',
          odometer: '1.234',
        })
      )
    )
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it.each([{}, { unknown: true, equipmentId: 'foreign', tenantId: 'foreign' }])(
    'empty/extra-only patch %j is a no-op',
    async (body) => {
      const response = await handlers.PATCH(request('PATCH', body), params())
      expect(response.status).toBe(200)
      expect(state.tx.equipmentUnit.update.mock.calls[0]![0].data).toEqual({})
      expect(state.tx.equipmentUnit.findFirst).toHaveBeenCalledTimes(1)
      expect(await response.json()).toEqual(JSON.parse(JSON.stringify(unit)))
    }
  )
  it('partial patch preserves omitted fields and whitespace texts', async () => {
    expect(
      (
        await handlers.PATCH(
          request('PATCH', { notes: ' ', serialNumber: ' S ' }),
          params()
        )
      ).status
    ).toBe(200)
    expect(state.tx.equipmentUnit.update.mock.calls[0]![0].data).toEqual({
      notes: ' ',
      serialNumber: ' S ',
    })
  })
  it.each(['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'RETIRED'])(
    'PATCH accepts lifecycle status %s without new stock rules',
    async (status) => {
      const response = await handlers.PATCH(
        request('PATCH', { status }),
        params()
      )
      expect(response.status).toBe(200)
      expect((await response.json()).status).toBe(status)
      expect(state.tx.equipmentUnit.update.mock.calls[0]![0].data).toEqual({
        status,
      })
    }
  )
  it.each([
    null,
    [],
    false,
    'input',
    { uniqueCode: '' },
    { status: 'UNKNOWN' },
    { hourMeter: -1 },
    { odometer: '1' },
    { serialNumber: null },
    { notes: null },
  ])(
    'invalid PATCH %j keeps genuine Zod details and no effect',
    async (body) => {
      const response = await handlers.PATCH(request('PATCH', body), params())
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        error: 'Dados inválidos',
        details: [
          expect.objectContaining({
            code: expect.any(String),
            path: expect.any(Array),
            message: expect.any(String),
          }),
        ],
      })
      noEffect()
    }
  )
  it.each(['{', '', 'undefined'])(
    'malformed PATCH %s remains generic 500 after ownership',
    async (body) => {
      const response = await handlers.PATCH(
        request('PATCH', body, true),
        params()
      )
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao atualizar unidade',
      })
      expect(state.tx.equipmentUnit.findFirst).toHaveBeenCalledTimes(1)
      noEffect()
    }
  )
  it('duplicate code is scoped and stops before UPDATE', async () => {
    state.tx.equipmentUnit.findFirst
      .mockResolvedValueOnce({ id: unit.id })
      .mockResolvedValueOnce({ id: 'other-unit' })
    const response = await handlers.PATCH(
      request('PATCH', { uniqueCode: 'Taken' }),
      params()
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Código único já existe' })
    expect(state.tx.equipmentUnit.findFirst.mock.calls[1]![0]).toEqual({
      where: { tenantId: principal.tenantId, uniqueCode: 'Taken' },
    })
    noEffect()
  })
  it('unchanged own code is accepted', async () => {
    state.tx.equipmentUnit.findFirst.mockResolvedValue(unit)
    expect(
      (
        await handlers.PATCH(
          request('PATCH', { uniqueCode: unit.uniqueCode }),
          params()
        )
      ).status
    ).toBe(200)
    expect(state.tx.equipmentUnit.update).toHaveBeenCalledTimes(1)
  })
  it.each(['AVAILABLE', 'MAINTENANCE', 'RETIRED'])(
    'DELETE accepts %s, scoped, without reading body',
    async (status) => {
      state.tx.equipmentUnit.findFirst.mockResolvedValue({ ...unit, status })
      const incoming = request('DELETE', '{', true)
      const body = vi.spyOn(incoming, 'json')
      const response = await handlers.DELETE(incoming, params())
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        message: 'Unidade deletada com sucesso',
      })
      expect(state.permission).toHaveBeenCalledExactlyOnceWith(
        incoming,
        'EQUIPMENTS',
        'DELETE'
      )
      expect(state.tx.equipmentUnit.findFirst).toHaveBeenCalledExactlyOnceWith({
        where: { id: unit.id, tenantId: principal.tenantId },
      })
      expect(state.tx.equipmentUnit.delete).toHaveBeenCalledExactlyOnceWith({
        where: { id: unit.id, tenantId: principal.tenantId },
      })
      expect(body).not.toHaveBeenCalled()
    }
  )
  it.each(['RENTED', 'RESERVED'])(
    'DELETE refuses %s with domain 400',
    async (status) => {
      state.tx.equipmentUnit.findFirst.mockResolvedValue({ ...unit, status })
      const response = await handlers.DELETE(request('DELETE'), params())
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Não é possível deletar unidade em uso',
      })
      noEffect()
    }
  )
  describe.each(['PATCH', 'DELETE'] as const)(
    '%s refusal/fault order',
    (method) => {
      const generic =
        method === 'PATCH'
          ? 'Erro ao atualizar unidade'
          : 'Erro ao deletar unidade'
      it.each([400, 401, 403, 404, 409, 503])(
        'guard refusal %s precedes params and body',
        async (status) => {
          const response = new Response(
            JSON.stringify({ error: 'Fixture refusal' }),
            { status, headers: { 'Cache-Control': 'no-store' } }
          )
          state.permission.mockResolvedValue({ ok: false, response })
          const incoming = request(method, '{', true)
          const body = vi.spyOn(incoming, 'json')
          const awaitParams = vi.fn()
          const lazy = {
            params: { then: awaitParams } as unknown as Promise<{
              id: string
            }>,
          }
          expect(await handlers[method](incoming, lazy)).toBe(response)
          expect(awaitParams).not.toHaveBeenCalled()
          expect(body).not.toHaveBeenCalled()
          expect(state.db.$transaction).not.toHaveBeenCalled()
        }
      )
      it('missing/foreign unit is 404 before malformed body', async () => {
        state.tx.equipmentUnit.findFirst.mockResolvedValue(null)
        const incoming = request(method, '{', true)
        const body = vi.spyOn(incoming, 'json')
        const response = await handlers[method](incoming, params())
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error:
            method === 'PATCH'
              ? 'Registro não encontrado'
              : 'Unidade não encontrada',
        })
        expect(body).not.toHaveBeenCalled()
        noEffect()
      })
      it('CatalogError retains its status/message', async () => {
        state.tx.equipmentUnit.findFirst.mockRejectedValue(
          new CatalogError('Fixture domain', 409)
        )
        const response = await handlers[method](request(method), params())
        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'Fixture domain' })
      })
      it('params rejection is generic 500 after guard but before transaction', async () => {
        const response = await handlers[method](request(method), {
          params: Promise.reject(new Error('Private params')),
        })
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: generic })
        expect(state.permission).toHaveBeenCalledTimes(1)
        expect(state.db.$transaction).not.toHaveBeenCalled()
      })
      it('organization recheck prevents lock/write', async () => {
        state.tx.organization.findUnique.mockResolvedValue({
          status: 'SUSPENDED',
        })
        const response = await handlers[method](request(method), params())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: generic })
        expect(state.tx.$executeRaw).not.toHaveBeenCalled()
        noEffect()
      })
      it.each(['permission', 'transaction', 'lock', 'ownership', 'write'])(
        'private %s failure stays generic 500',
        async (stage) => {
          const error = new Error('Private failure detail')
          if (stage === 'permission') state.permission.mockRejectedValue(error)
          if (stage === 'transaction')
            state.db.$transaction.mockRejectedValue(error)
          if (stage === 'lock') state.tx.$executeRaw.mockRejectedValue(error)
          if (stage === 'ownership')
            state.tx.equipmentUnit.findFirst.mockRejectedValue(error)
          if (stage === 'write')
            state.tx.equipmentUnit[
              method === 'PATCH' ? 'update' : 'delete'
            ].mockRejectedValue(error)
          const response = await handlers[method](
            request(method, { notes: 'Changed' }),
            params()
          )
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({ error: generic })
          expect(console.error).toHaveBeenCalled()
        }
      )
    }
  )
})
