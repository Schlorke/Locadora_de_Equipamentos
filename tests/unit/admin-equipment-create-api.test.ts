import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'
import { Prisma } from '@prisma/client'

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  create: vi.fn(),
  check: vi.fn(),
  limiter: vi.fn(),
}))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@/lib/catalog', async () => {
  const { CatalogError } = await import('@gb-locacoes/backend/catalog')
  return {
    CatalogError,
    createEquipment: state.create,
    listEquipments: vi.fn(),
  }
})
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: state.check,
  adminApiRateLimit: state.limiter,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  createEquipment: state.create,
  listEquipments: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: state.check,
  adminApiRateLimit: state.limiter,
}))
import { POST as legacy } from '@/app/api/admin/equipments/route'
import { POST as service } from '../../apps/services/api/src/app/api/admin/equipments/route'

const principal = {
  tenantId: 'fixture-tenant',
  userId: 'fixture-user',
  membershipId: 'fixture-membership',
  role: 'OPERATOR',
}
const input = {
  name: ' Equipment ',
  description: ' Description ',
  pricePerDay: '12.5suffix',
  categoryId: 'category',
  images: [' image ', '', null],
  maxStock: 0,
  extra: true,
  tenantId: 'forged',
}
const dto = {
  id: 'equipment',
  tenantId: principal.tenantId,
  name: 'Equipment',
  pricePerDay: 12.5,
  dailyDirectValue: '1.25',
  available: false,
  isAvailable: false,
  maxStock: 0,
  category: { id: 'category' },
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  state.check.mockReturnValue({ allowed: true, remaining: 199, resetTime: 0 })
  state.permission.mockResolvedValue({ ok: true, principal })
  state.create.mockResolvedValue(dto)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s equipment creation transport', (_name, POST) => {
  const request = (body: unknown = input, raw = false) =>
    new NextRequest(
      'https://app.platform.test/api/admin/equipments?tenantId=forged&role=ADMIN',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw ? String(body) : JSON.stringify(body),
      }
    )
  it('orders limiter, WRITE, parsing and shared use case; passes raw JSON and complete DTO', async () => {
    const incoming = request()
    const body = vi.spyOn(incoming, 'json')
    const response = await POST(incoming)
    expect(response.status).toBe(201)
    expect(state.check).toHaveBeenCalledExactlyOnceWith(incoming, state.limiter)
    expect(state.permission).toHaveBeenCalledExactlyOnceWith(
      incoming,
      'EQUIPMENTS',
      'WRITE'
    )
    expect(state.create).toHaveBeenCalledExactlyOnceWith(principal, input)
    expect(state.check.mock.invocationCallOrder[0]).toBeLessThan(
      state.permission.mock.invocationCallOrder[0]!
    )
    expect(state.permission.mock.invocationCallOrder[0]).toBeLessThan(
      body.mock.invocationCallOrder[0]!
    )
    expect(body.mock.invocationCallOrder[0]).toBeLessThan(
      state.create.mock.invocationCallOrder[0]!
    )
    expect(await response.json()).toEqual(dto)
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('rate-limit refusal forwards headers/response before authorization or malformed body', async () => {
    const refusal = new Response('{"error":"Rate limit exceeded"}', {
      status: 429,
      headers: { 'Retry-After': '30', 'X-RateLimit-Limit': '200' },
    })
    state.check.mockReturnValue({ allowed: false, response: refusal })
    const incoming = request('{', true)
    const body = vi.spyOn(incoming, 'json')
    expect(await POST(incoming)).toBe(refusal)
    expect(state.permission).not.toHaveBeenCalled()
    expect(body).not.toHaveBeenCalled()
    expect(state.create).not.toHaveBeenCalled()
  })
  it.each([400, 401, 403, 404, 409, 503])(
    'principal refusal %s still consumes limiter and precedes parsing',
    async (status) => {
      const refusal = new Response('{"error":"Fixture refusal"}', {
        status,
        headers: { 'Cache-Control': 'no-store' },
      })
      state.permission.mockResolvedValue({ ok: false, response: refusal })
      const incoming = request('{', true)
      const body = vi.spyOn(incoming, 'json')
      expect(await POST(incoming)).toBe(refusal)
      expect(state.check).toHaveBeenCalledTimes(1)
      expect(body).not.toHaveBeenCalled()
      expect(state.create).not.toHaveBeenCalled()
    }
  )
  it.each([400, 404, 409] as const)(
    'CatalogError retains status %s and message',
    async (status) => {
      state.create.mockRejectedValue(new CatalogError('Fixture domain', status))
      const response = await POST(request())
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error: 'Fixture domain' })
      expect(console.error).not.toHaveBeenCalled()
    }
  )
  it.each(['{', '', 'undefined'])(
    'malformed JSON %s keeps production 500 and does not call create',
    async (body) => {
      const response = await POST(request(body, true))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro interno do servidor ao criar equipamento.',
      })
      expect(state.create).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    }
  )
  describe.each(['production', 'development'] as const)(
    '%s error envelope',
    (environment) => {
      beforeEach(() => vi.stubEnv('NODE_ENV', environment))
      it.each(['P2002', 'P2009', 'fixture-code'])(
        'Error with code %s remains 400',
        async (code) => {
          const error = Object.assign(new Error('Private fixture error'), {
            code,
          })
          state.create.mockRejectedValue(error)
          const response = await POST(request())
          expect(response.status).toBe(400)
          expect(await response.json()).toEqual({
            error: 'Erro ao processar dados do equipamento.',
            ...(environment === 'development'
              ? { details: `Prisma Error ${code}: Private fixture error` }
              : {}),
          })
        }
      )
      it('genuine Prisma error follows the same code branch', async () => {
        state.create.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Private constraint', {
            code: 'P2002',
            clientVersion: 'fixture',
          })
        )
        const response = await POST(request())
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Erro ao processar dados do equipamento.',
          ...(environment === 'development'
            ? { details: 'Prisma Error P2002: Private constraint' }
            : {}),
        })
      })
      it.each(['limiter', 'permission', 'create'])(
        'ordinary %s error stays generic 500',
        async (stage) => {
          const error = new Error('Private ordinary error')
          if (stage === 'limiter')
            state.check.mockImplementation(() => {
              throw error
            })
          if (stage === 'permission') state.permission.mockRejectedValue(error)
          if (stage === 'create') state.create.mockRejectedValue(error)
          const response = await POST(request())
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error: 'Erro interno do servidor ao criar equipamento.',
            ...(environment === 'development'
              ? { details: 'Private ordinary error' }
              : {}),
          })
        }
      )
      it.each(['private value', { code: 'P2002' }])(
        'non-Error rejection %j does not enter code branch',
        async (error) => {
          state.create.mockRejectedValue(error)
          const response = await POST(request())
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error: 'Erro interno do servidor ao criar equipamento.',
            ...(environment === 'development'
              ? { details: String(error) }
              : {}),
          })
        }
      )
    }
  )
})
