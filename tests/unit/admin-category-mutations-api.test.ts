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
    category: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: state.db }),
}))
import * as service from '../../apps/services/api/src/app/api/admin/categories/[id]/route'

const principal = {
  tenantId: 'category-tenant',
  userId: 'category-user',
  membershipId: 'category-member',
  role: 'OPERATOR',
}
const original = {
  id: 'category-id',
  tenantId: principal.tenantId,
  name: 'Original',
  slug: 'original',
  description: 'Original description',
  icon: 'hammer',
  iconColor: '#123456',
  bgColor: '#ffffff',
  fontColor: '#000000',
  placement: 'types',
  customIcon: { source: 'emoji', extra: true },
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
  state.tx.category.findFirst.mockResolvedValue({ id: original.id })
  state.tx.category.update.mockImplementation(async ({ data }) => ({
    ...original,
    ...data,
    ...(data.customIcon === Prisma.JsonNull ? { customIcon: null } : {}),
  }))
  state.tx.category.delete.mockResolvedValue(original)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe.each([['service', service]] as const)(
  '%s administrative category mutations',
  (_host, handlers) => {
    const props = () => ({ params: Promise.resolve({ id: original.id }) })
    const request = (
      method: 'PUT' | 'DELETE',
      body: unknown = {},
      raw = false
    ) =>
      new NextRequest(
        'https://app.platform.test/api/admin/categories/category-id?tenantId=foreign&role=ADMIN',
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: raw ? String(body) : JSON.stringify(body),
        }
      )
    it.each(['PUT', 'DELETE'] as const)(
      '%s delegates the original Request and exact permission before transaction/body',
      async (method) => {
        const incoming = request(method)
        const response = await handlers[method](incoming, props())
        expect(response.status).toBe(200)
        expect(state.permission).toHaveBeenCalledExactlyOnceWith(
          incoming,
          'EQUIPMENTS',
          method === 'PUT' ? 'WRITE' : 'DELETE'
        )
        expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
        expect(state.tx.category.findFirst).toHaveBeenCalledExactlyOnceWith({
          where: { id: original.id, tenantId: principal.tenantId },
          select: { id: true },
        })
        const mutation =
          method === 'PUT' ? state.tx.category.update : state.tx.category.delete
        expect(mutation.mock.calls[0]![0].where).toEqual({
          id: original.id,
          tenantId: principal.tenantId,
        })
        expect(state.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
          mutation.mock.invocationCallOrder[0]!
        )
        expect(response.headers.get('cache-control')).toBeNull()
        expect(response.headers.get('set-cookie')).toBeNull()
      }
    )
    it('PUT retains trim, slug, nullable fields and arbitrary nested JSON', async () => {
      const input = {
        name: '  São José  ',
        description: ' Description ',
        icon: ' Icon ',
        iconColor: ' #aaaaaa ',
        bgColor: ' #bbbbbb ',
        fontColor: ' #cccccc ',
        placement: 'phases',
        customIcon: { source: 'other', extra: true },
        tenantId: 'foreign',
        id: 'foreign',
      }
      const response = await handlers.PUT(request('PUT', input), props())
      expect(await response.json()).toEqual({
        ...original,
        name: 'São José',
        slug: 'sao-jose',
        description: 'Description',
        icon: 'Icon',
        iconColor: '#aaaaaa',
        bgColor: '#bbbbbb',
        fontColor: '#cccccc',
        placement: 'phases',
        customIcon: input.customIcon,
      })
      expect(
        state.tx.category.update.mock.calls[0]![0].data
      ).not.toHaveProperty('tenantId')
      expect(
        state.tx.category.update.mock.calls[0]![0].data
      ).not.toHaveProperty('id')
    })
    it('missing fields preserve existing values, with an empty update object', async () => {
      const response = await handlers.PUT(
        request('PUT', { ignored: true }),
        props()
      )
      expect(await response.json()).toEqual(original)
      expect(state.tx.category.update.mock.calls[0]![0].data).toEqual({})
    })
    it('whitespace name and null/blank optional fields preserve existing normalization/defaults', async () => {
      const response = await handlers.PUT(
        request('PUT', {
          name: ' ',
          description: null,
          icon: '',
          iconColor: null,
          bgColor: ' ',
          fontColor: '',
          placement: 'unknown',
          customIcon: false,
        }),
        props()
      )
      expect(await response.json()).toEqual({
        ...original,
        name: '',
        slug: '',
        description: null,
        icon: null,
        iconColor: '#000000',
        bgColor: '#e0e0e0',
        fontColor: '#000000',
        placement: null,
        customIcon: null,
      })
    })
    it.each([null, '', false, 0])('falsy name %s is ignored', async (name) => {
      const response = await handlers.PUT(request('PUT', { name }), props())
      expect(await response.json()).toEqual(original)
    })
    it.each([[], 42, true, 'fixture'])(
      'non-null scalar/array patch %j is an empty update',
      async (body) => {
        const response = await handlers.PUT(request('PUT', body), props())
        expect(response.status).toBe(200)
        expect(state.tx.category.update.mock.calls[0]![0].data).toEqual({})
      }
    )
    it.each(['PUT', 'DELETE'] as const)(
      '%s missing or foreign ID is a domain 404 before body/mutation',
      async (method) => {
        state.tx.category.findFirst.mockResolvedValueOnce(null)
        const incoming = request(method, '{', true)
        const body = vi.spyOn(incoming, 'json')
        const response = await handlers[method](incoming, props())
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error:
            method === 'PUT'
              ? 'Registro não encontrado'
              : 'Categoria não encontrada',
        })
        expect(body).not.toHaveBeenCalled()
        expect(state.tx.category.update).not.toHaveBeenCalled()
        expect(state.tx.category.delete).not.toHaveBeenCalled()
        expect(console.error).not.toHaveBeenCalled()
      }
    )
    it.each(['PUT', 'DELETE'] as const)(
      '%s forwards the permission refusal before malformed body',
      async (method) => {
        const refusal = new Response(
          JSON.stringify({ error: 'Fixture denied' }),
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        )
        state.permission.mockResolvedValueOnce({ ok: false, response: refusal })
        const incoming = request(method, '{', true)
        const body = vi.spyOn(incoming, 'json')
        expect(await handlers[method](incoming, props())).toBe(refusal)
        expect(body).not.toHaveBeenCalled()
        expect(state.db.$transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['PUT', 'DELETE'] as const)(
      '%s preserves the observed params-before-guard ordering',
      async (method) => {
        let settled = false
        const params = Promise.resolve({ id: original.id }).then((value) => {
          settled = true
          return value
        })
        state.permission.mockImplementationOnce(async () => {
          expect(settled).toBe(true)
          return { ok: false, response: new Response(null, { status: 403 }) }
        })
        expect(
          (await handlers[method](request(method), { params })).status
        ).toBe(403)
      }
    )
    it.each(['PUT', 'DELETE'] as const)(
      '%s rejected params propagates outside the handler catch',
      async (method) => {
        const error = new Error('fixture params rejection')
        await expect(
          handlers[method](request(method), { params: Promise.reject(error) })
        ).rejects.toBe(error)
        expect(state.permission).not.toHaveBeenCalled()
        expect(console.error).not.toHaveBeenCalled()
      }
    )
    it.each([
      ['malformed JSON', '{', true],
      ['null body', null, false],
      ['invalid name', { name: 7 }, false],
      ['invalid color', { iconColor: {} }, false],
    ] as const)(
      'PUT %s stays generic 500 without updating',
      async (_label, body, raw) => {
        const response = await handlers.PUT(request('PUT', body, raw), props())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao atualizar categoria',
        })
        expect(state.tx.category.update).not.toHaveBeenCalled()
      }
    )
    it('DELETE ignores malformed JSON and returns the exact success envelope', async () => {
      const incoming = request('DELETE', '{', true)
      const body = vi.spyOn(incoming, 'json')
      const response = await handlers.DELETE(incoming, props())
      expect(await response.json()).toEqual({ message: 'Categoria excluída' })
      expect(body).not.toHaveBeenCalled()
    })
    it.each(['PUT', 'DELETE'] as const)(
      '%s preserves genuine CatalogError status',
      async (method) => {
        state.permission.mockRejectedValueOnce(
          new CatalogError('Fixture catalog refusal', 409)
        )
        const response = await handlers[method](request(method), props())
        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({
          error: 'Fixture catalog refusal',
        })
      }
    )
    it.each(['PUT', 'DELETE'] as const)(
      '%s inactive organization is generic 500 before lock/mutation',
      async (method) => {
        state.tx.organization.findUnique.mockResolvedValueOnce({
          status: 'SUSPENDED',
        })
        const response = await handlers[method](request(method), props())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error:
            method === 'PUT'
              ? 'Erro ao atualizar categoria'
              : 'Erro ao excluir categoria',
        })
        expect(state.tx.$executeRaw).not.toHaveBeenCalled()
        expect(state.tx.category.update).not.toHaveBeenCalled()
        expect(state.tx.category.delete).not.toHaveBeenCalled()
      }
    )
    it.each(['PUT', 'DELETE'] as const)(
      '%s database errors retain generic 500 without leaking codes',
      async (method) => {
        const mutation =
          method === 'PUT' ? state.tx.category.update : state.tx.category.delete
        mutation.mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('private fixture failure', {
            code: method === 'PUT' ? 'P2002' : 'P2003',
            clientVersion: 'fixture',
          })
        )
        const response = await handlers[method](request(method), props())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error:
            method === 'PUT'
              ? 'Erro ao atualizar categoria'
              : 'Erro ao excluir categoria',
        })
      }
    )
  }
)
