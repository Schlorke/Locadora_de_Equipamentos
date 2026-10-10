import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { z } from 'zod'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: { $queryRaw: vi.fn(), driver: { create: vi.fn() } },
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { POST as service } from '../../apps/services/api/src/app/api/admin/drivers/route'

const principal = {
  tenantId: 'driver-tenant',
  userId: 'driver-user',
  membershipId: 'driver-member',
  role: 'ADMIN',
}
const payload = { name: '  Driver  ', phone: '(11) 90000-0000' }
beforeEach(() => {
  vi.resetAllMocks()
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.$queryRaw.mockResolvedValue([])
  let sequence = 0
  state.tx.driver.create.mockImplementation(async ({ data }) => ({
    id: `driver-${++sequence}`,
    cnh: null,
    cnhCategory: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ),
  }))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe.each([['service', service]] as const)(
  '%s driver creation characterization',
  (_host, POST) => {
    const request = (body: unknown = payload, raw = false) =>
      new NextRequest(
        'https://api.platform.test/api/admin/drivers?tenantSlug=other&status=INACTIVE',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: raw ? String(body) : JSON.stringify(body),
        }
      )
    it.each([undefined, 'ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const)(
      'creates in the principal scope, preserving raw values and status %s',
      async (status) => {
        const response = await POST(
          request({
            ...payload,
            cnh: '  ABC-123  ',
            cnhCategory: ' B ',
            status,
          })
        )
        expect(response.status).toBe(201)
        expect(await response.json()).toEqual({
          driver: {
            id: 'driver-1',
            tenantId: principal.tenantId,
            ...payload,
            cnh: '  ABC-123  ',
            cnhCategory: ' B ',
            status: status ?? 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        })
        expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
        expect(state.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
          state.tx.driver.create.mock.invocationCallOrder[0]!
        )
        expect(state.transaction.mock.calls[0]![1]).toEqual({
          timeout: 15_000,
          maxWait: 15_000,
        })
        expect(response.headers.get('cache-control')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
      }
    )
    it('strips mass-assignment keys and leaves absent optional values to the database', async () => {
      const response = await POST(
        request({
          ...payload,
          tenantId: 'foreign',
          id: 'forged',
          role: 'ADMIN',
          createdAt: 'forged',
          extra: true,
        })
      )
      expect(response.status).toBe(201)
      expect(state.tx.driver.create).toHaveBeenCalledWith({
        data: {
          tenantId: principal.tenantId,
          ...payload,
          cnh: undefined,
          cnhCategory: undefined,
          status: 'ACTIVE',
        },
      })
      expect((await response.json()).driver.cnh).toBeNull()
    })
    it('preserves whitespace-only names/phones and empty optional strings', async () => {
      const response = await POST(
        request({ name: ' ', phone: '\t', cnh: '', cnhCategory: '' })
      )
      expect(response.status).toBe(201)
      expect((await response.json()).driver).toMatchObject({
        name: ' ',
        phone: '\t',
        cnh: '',
        cnhCategory: '',
      })
    })
    it('preserves non-idempotent creation for repeated requests', async () => {
      const first = await POST(request())
      const second = await POST(request())
      expect(first.status).toBe(201)
      expect(second.status).toBe(201)
      expect((await first.json()).driver.id).not.toBe(
        (await second.json()).driver.id
      )
      expect(state.tx.driver.create).toHaveBeenCalledTimes(2)
    })
    it.each(['CLIENT', 'OPERATOR', 'FINANCIAL'])(
      'denies %s before parsing an invalid body or touching the database',
      async (role) => {
        state.principal.mockResolvedValueOnce({
          ok: true,
          principal: { ...principal, role },
        })
        const response = await POST(request('{', true))
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({ error: 'Forbidden' })
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each([400, 401, 403, 404, 409, 503])(
      'forwards the %s principal refusal and all headers unchanged',
      async (status) => {
        const refusal = Response.json(
          { error: 'fixture refusal' },
          {
            status,
            headers: {
              'Cache-Control': 'private, no-store',
              Vary: 'Cookie, Host',
              'Retry-After': '3',
            },
          }
        )
        state.principal.mockResolvedValueOnce({ ok: false, response: refusal })
        expect(await POST(request('{', true))).toBe(refusal)
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each([
      { value: null },
      { value: [] },
      { value: 'driver' },
      { value: 0 },
      { value: {} },
      { value: { ...payload, name: '' } },
      { value: { ...payload, phone: '' } },
      { value: { ...payload, name: 1 } },
      { value: { ...payload, phone: null } },
      { value: { ...payload, cnh: null } },
      { value: { ...payload, cnhCategory: 1 } },
      { value: { ...payload, status: 'AVAILABLE' } },
      { value: { ...payload, status: null } },
    ])('invalid DTO %j is a 400, without a transaction', async ({ value }) => {
      const response = await POST(request(value))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('Validation error')
      expect(body.details.length).toBeGreaterThan(0)
      expect(
        body.details.every(
          (issue: { code: string; path: unknown[]; message: string }) =>
            issue.code && Array.isArray(issue.path) && issue.message
        )
      ).toBe(true)
      expect(state.transaction).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()
    })
    it('keeps required-field error paths and Portuguese messages', async () => {
      const response = await POST(request({ name: '', phone: '' }))
      expect(await response.json()).toEqual({
        error: 'Validation error',
        details: [
          {
            origin: 'string',
            code: 'too_small',
            minimum: 1,
            inclusive: true,
            path: ['name'],
            message: 'Nome é obrigatório',
          },
          {
            origin: 'string',
            code: 'too_small',
            minimum: 1,
            inclusive: true,
            path: ['phone'],
            message: 'Telefone é obrigatório',
          },
        ],
      })
    })
    it.each(['{', '', 'undefined'])(
      'malformed JSON %s retains the generic 500',
      async (raw) => {
        const response = await POST(request(raw, true))
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Internal server error',
        })
        expect(console.error).toHaveBeenCalledWith('Tenant operation failed')
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['principal', 'transaction'] as const)(
      'a genuine ZodError from %s remains a validation response',
      async (dependency) => {
        const error = new z.ZodError([
          { code: 'custom', path: ['fixture'], message: 'fixture validation' },
        ])
        state[dependency].mockRejectedValueOnce(error)
        const response = await POST(request())
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Validation error',
          details: error.issues,
        })
      }
    )
    it.each(['principal', 'transaction'] as const)(
      'a forged ZodError from %s is generic and does not expose details',
      async (dependency) => {
        state[dependency].mockRejectedValueOnce({
          name: 'ZodError',
          issues: [{ message: 'private detail' }],
        })
        const response = await POST(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Internal server error',
        })
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
          'Tenant operation failed'
        )
      }
    )
    it('a tenant-context failure prevents creation and remains generic', async () => {
      state.tx.$queryRaw.mockRejectedValueOnce(
        new Error('private fixture database failure')
      )
      const response = await POST(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
      expect(state.tx.driver.create).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Tenant operation failed'
      )
    })
  }
)
