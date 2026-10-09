import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    address: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: state.principal }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: state.transaction } }))
import { POST as legacyPost } from '@/app/api/addresses/route'
import {
  PATCH as legacyPatch,
  DELETE as legacyDelete,
} from '@/app/api/addresses/[id]/route'
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { POST as servicePost } from '../../apps/services/api/src/app/api/addresses/route'
import {
  PATCH as servicePatch,
  DELETE as serviceDelete,
} from '../../apps/services/api/src/app/api/addresses/[id]/route'

const principal = {
  tenantId: 'fixture-tenant',
  userId: 'fixture-user',
  membershipId: 'fixture-member',
  role: 'CLIENT' as const,
}
const scope = { tenantId: principal.tenantId, userId: principal.userId }
const input = {
  street: 'Fixture street',
  number: '1',
  neighborhood: 'Fixture neighborhood',
  city: 'Fixture city',
  state: 'SP',
  zipCode: '01001000',
}
const row = {
  id: 'fixture-address',
  ...scope,
  ...input,
  complement: null,
  isPrimary: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
}
const params = () => ({ params: Promise.resolve({ id: row.id }) })
const adapters = [
  ['legacy', legacyPost, legacyPatch, legacyDelete],
  ['service', servicePost, servicePatch, serviceDelete],
] as const
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://app.platform.test')
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.address.count.mockResolvedValue(1)
  state.tx.address.create.mockImplementation(async ({ data }) => ({
    ...row,
    ...data,
  }))
  state.tx.address.findFirst.mockResolvedValue(row)
  state.tx.address.findFirstOrThrow.mockResolvedValue(row)
  state.tx.address.updateMany.mockResolvedValue({ count: 1 })
  state.tx.address.deleteMany.mockResolvedValue({ count: 1 })
})
afterEach(() => vi.unstubAllEnvs())

describe.each(adapters)(
  '%s address mutation characterization',
  (_host, POST, PATCH, DELETE) => {
    describe.each(['POST', 'PATCH', 'DELETE'] as const)('%s', (method) => {
      const request = (
        body: unknown = method === 'POST' ? input : { city: 'Updated' },
        headers: Record<string, string> = {}
      ) =>
        new NextRequest(
          `https://app.platform.test/api/addresses${method === 'POST' ? '' : '/' + row.id}`,
          {
            method,
            headers,
            ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
          }
        )
      const invoke = (req = request(), context = params()) =>
        method === 'POST'
          ? POST(req)
          : method === 'PATCH'
            ? PATCH(req, context)
            : DELETE(req, context)
      it.each([400, 401, 403, 404, 409, 503])(
        'propagates principal refusal %i before parsing or storage',
        async (status) => {
          const refusal = Response.json(
            { error: 'fixture-refused' },
            { status, headers: { 'Cache-Control': 'no-store' } }
          )
          state.principal.mockResolvedValue({ ok: false, response: refusal })
          expect(await invoke(request(null))).toBe(refusal)
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it('keeps principal dependency exceptions outside the business catch', async () => {
        const failure = new Error('private-principal-failure')
        state.principal.mockRejectedValue(failure)
        await expect(invoke()).rejects.toBe(failure)
        expect(state.transaction).not.toHaveBeenCalled()
      })
      it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
        'retains owner/RLS/lock for membership role %s',
        async (role) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role },
          })
          const response = await invoke()
          expect(response.status).toBe(method === 'POST' ? 201 : 200)
          expect(state.tx.$queryRaw.mock.calls[0]?.[1]).toBe(principal.tenantId)
          expect(state.tx.$executeRaw.mock.calls[0]?.[1]).toBe(
            `${principal.tenantId}:addresses:${principal.userId}`
          )
          if (method === 'POST')
            expect(state.tx.address.create).toHaveBeenCalledExactlyOnceWith({
              data: { ...input, ...scope, isPrimary: false },
            })
          else
            expect(state.tx.address.findFirst).toHaveBeenCalledWith({
              where: { ...scope, id: row.id },
            })
          expect(response.headers.get('cache-control')).toBeNull()
          expect(response.headers.get('set-cookie')).toBeNull()
        }
      )
      it.each<Record<string, string>>([
        { Origin: 'https://bravo.platform.test' },
        { Origin: 'null' },
        { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'same-site' },
        { 'Sec-Fetch-Site': 'cross-site' },
      ])(
        'refuses cross-origin browser input %j before storage',
        async (headers) => {
          const response = await invoke(request(null, headers))
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({
            error: 'Origem não permitida',
          })
          expect(response.headers.get('cache-control')).toBe('no-store')
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it.each<Record<string, string>>([
        {},
        {
          Origin: 'https://app.platform.test',
          'Sec-Fetch-Site': 'same-origin',
        },
        { 'Sec-Fetch-Site': 'none' },
      ])('accepts native or matching browser headers %j', async (headers) => {
        expect((await invoke(request(undefined, headers))).status).toBe(
          method === 'POST' ? 201 : 200
        )
      })
      it.each(['transaction', 'rls', 'lock', 'storage'])(
        'sanitizes failure at %s',
        async (stage) => {
          const failure = new Error('private-storage-detail')
          if (stage === 'transaction')
            state.transaction.mockRejectedValue(failure)
          if (stage === 'rls') state.tx.$queryRaw.mockRejectedValue(failure)
          if (stage === 'lock') state.tx.$executeRaw.mockRejectedValue(failure)
          if (stage === 'storage')
            (method === 'POST'
              ? state.tx.address.create
              : state.tx.address.findFirst
            ).mockRejectedValue(failure)
          const response = await invoke()
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            error:
              method === 'POST'
                ? 'Erro ao criar endereço'
                : 'Não foi possível alterar o endereço',
          })
          if (stage !== 'storage') {
            expect(state.tx.address.create).not.toHaveBeenCalled()
            expect(state.tx.address.updateMany).not.toHaveBeenCalled()
            expect(state.tx.address.deleteMany).not.toHaveBeenCalled()
          }
        }
      )
    })

    describe.each(['POST', 'PATCH'] as const)('%s payload', (method) => {
      const call = (body: string) => {
        const req = new NextRequest('https://app.platform.test/api/addresses', {
          method,
          body,
        })
        return method === 'POST' ? POST(req) : PATCH(req, params())
      }
      it.each([
        '{',
        '',
        'null',
        '[]',
        '"string"',
        JSON.stringify({ ...input, street: '' }),
        JSON.stringify({ ...input, zipCode: 'bad' }),
        JSON.stringify({ ...input, isPrimary: 'true' }),
      ])('rejects invalid input %s before RLS/lock', async (body) => {
        const response = await call(body)
        expect(response.status).toBe(400)
        const parsed = await response.json()
        expect(parsed.error).toBe('Dados inválidos')
        expect(parsed.details.length).toBeGreaterThan(0)
        expect(state.transaction).not.toHaveBeenCalled()
      })
      it('trims fields, uppercases state, and strips ownership/relations', async () => {
        const req = new NextRequest(
          'https://app.platform.test/api/addresses?tenantId=foreign&userId=foreign',
          {
            method,
            body: JSON.stringify({
              ...input,
              street: ' Fixture street ',
              state: 'sp',
              complement: null,
              tenantId: 'foreign',
              userId: 'foreign',
              user: { connect: { id: 'foreign' } },
              id: 'foreign',
              createdAt: '2000-01-01',
            }),
          }
        )
        const response =
          method === 'POST' ? await POST(req) : await PATCH(req, params())
        expect(response.status).toBe(method === 'POST' ? 201 : 200)
        if (method === 'POST')
          expect(state.tx.address.create).toHaveBeenCalledWith({
            data: { ...input, complement: null, ...scope, isPrimary: false },
          })
        else
          expect(state.tx.address.updateMany).toHaveBeenCalledExactlyOnceWith({
            where: { ...scope, id: row.id },
            data: { ...input, complement: null },
          })
      })
    })
    it.each([undefined, false, true])(
      'first address is primary regardless of input %s',
      async (isPrimary) => {
        state.tx.address.count.mockResolvedValue(0)
        const response = await POST(
          new NextRequest('https://app.platform.test/api/addresses', {
            method: 'POST',
            body: JSON.stringify({ ...input, isPrimary }),
          })
        )
        expect(response.status).toBe(201)
        expect(state.tx.address.count).toHaveBeenCalledExactlyOnceWith({
          where: scope,
        })
        expect(state.tx.address.updateMany).toHaveBeenCalledExactlyOnceWith({
          where: { ...scope, isPrimary: true },
          data: { isPrimary: false },
        })
        expect((await response.json()).address.isPrimary).toBe(true)
      }
    )
    it('creating a new chosen primary demotes only the current owner and tenant', async () => {
      await POST(
        new NextRequest('https://app.platform.test/api/addresses', {
          method: 'POST',
          body: JSON.stringify({ ...input, isPrimary: true }),
        })
      )
      expect(state.tx.address.updateMany).toHaveBeenCalledExactlyOnceWith({
        where: { ...scope, isPrimary: true },
        data: { isPrimary: false },
      })
    })
    it.each(['{}', '{"unknown":"stripped"}', '{"isPrimary":false}'])(
      'preserves accepted empty/false PATCH %s without promoting another row',
      async (body) => {
        const response = await PATCH(
          new NextRequest('https://app.platform.test/api/addresses', {
            method: 'PATCH',
            body,
          }),
          params()
        )
        expect(response.status).toBe(200)
        expect(state.tx.address.updateMany).toHaveBeenCalledExactlyOnceWith({
          where: { ...scope, id: row.id },
          data: body.includes('isPrimary') ? { isPrimary: false } : {},
        })
      }
    )
    it('PATCH primary excludes its own id when demoting others', async () => {
      await PATCH(
        new NextRequest('https://app.platform.test/api/addresses', {
          method: 'PATCH',
          body: '{"isPrimary":true}',
        }),
        params()
      )
      expect(state.tx.address.updateMany.mock.calls).toEqual([
        [
          {
            where: { ...scope, id: { not: row.id }, isPrimary: true },
            data: { isPrimary: false },
          },
        ],
        [{ where: { ...scope, id: row.id }, data: { isPrimary: true } }],
      ])
    })
    it.each(['PATCH', 'DELETE'] as const)(
      '%s hides a missing/foreign address with the same 404',
      async (method) => {
        state.tx.address.findFirst.mockResolvedValue(null)
        const req = new NextRequest(
          'https://app.platform.test/api/addresses/foreign',
          { method, ...(method === 'PATCH' ? { body: '{}' } : {}) }
        )
        const response =
          method === 'PATCH'
            ? await PATCH(req, params())
            : await DELETE(req, params())
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Endereço não encontrado',
        })
        expect(state.tx.address.updateMany).not.toHaveBeenCalled()
        expect(state.tx.address.deleteMany).not.toHaveBeenCalled()
      }
    )
    it('deleting the primary promotes the oldest remaining row with deterministic id tie-break', async () => {
      state.tx.address.findFirst
        .mockResolvedValueOnce({ ...row, isPrimary: true })
        .mockResolvedValueOnce({ ...row, id: 'next-row' })
      const response = await DELETE(
        new NextRequest('https://app.platform.test/api/addresses/a', {
          method: 'DELETE',
          body: '{ignored-invalid',
        }),
        params()
      )
      expect(await response.json()).toEqual({
        message: 'Endereço removido com sucesso',
      })
      expect(state.tx.address.deleteMany).toHaveBeenCalledExactlyOnceWith({
        where: { ...scope, id: row.id },
      })
      expect(state.tx.address.findFirst).toHaveBeenLastCalledWith({
        where: scope,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
      expect(state.tx.address.updateMany).toHaveBeenCalledExactlyOnceWith({
        where: { ...scope, id: 'next-row' },
        data: { isPrimary: true },
      })
    })
    it('deleting the last primary does not create a replacement', async () => {
      state.tx.address.findFirst
        .mockResolvedValueOnce({ ...row, isPrimary: true })
        .mockResolvedValueOnce(null)
      expect(
        (
          await DELETE(
            new NextRequest('https://app.platform.test/api/addresses/a', {
              method: 'DELETE',
            }),
            params()
          )
        ).status
      ).toBe(200)
      expect(state.tx.address.updateMany).not.toHaveBeenCalled()
    })
  }
)
