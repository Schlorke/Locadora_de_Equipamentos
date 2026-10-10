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
    category: { create: vi.fn() },
  },
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: state.db }),
}))
import { POST as service } from '../../apps/services/api/src/app/api/admin/categories/route'

const principal = {
  tenantId: 'category-tenant',
  userId: 'category-user',
  membershipId: 'category-member',
  role: 'OPERATOR',
}
const payload = {
  name: '  São José  ',
  iconColor: ' #abcdef ',
  bgColor: ' #f0f0f0 ',
  fontColor: ' #123456 ',
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
  state.tx.category.create.mockImplementation(async ({ data }) => ({
    ...data,
    customIcon: data.customIcon === Prisma.JsonNull ? null : data.customIcon,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe.each([['service', service]] as const)(
  '%s administrative category creation',
  (_host, POST) => {
    const request = (body: unknown = payload, raw = false) =>
      new NextRequest(
        'https://app.platform.test/api/admin/categories?tenantId=foreign&userId=foreign&role=ADMIN',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: raw ? String(body) : JSON.stringify(body),
        }
      )
    it('requires EQUIPMENTS/WRITE and keeps normalization in the existing catalog service', async () => {
      const original = request({
        ...payload,
        description: '  Fixture description  ',
        icon: '  hammer  ',
        placement: 'types',
      })
      const response = await POST(original)
      expect(response.status).toBe(201)
      expect(state.permission).toHaveBeenCalledExactlyOnceWith(
        original,
        'EQUIPMENTS',
        'WRITE'
      )
      const body = await response.json()
      expect(body).toMatchObject({
        tenantId: principal.tenantId,
        name: 'São José',
        slug: 'sao-jose',
        description: 'Fixture description',
        icon: 'hammer',
        iconColor: '#abcdef',
        bgColor: '#f0f0f0',
        fontColor: '#123456',
        placement: 'types',
        customIcon: null,
      })
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(body.createdAt).toBe('2026-01-01T00:00:00.000Z')
      expect(body.driver).toBeUndefined()
      expect(response.headers.get('cache-control')).toBeNull()
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
      expect(state.tx.$queryRaw.mock.calls[1]!.slice(1)).toEqual([
        principal.tenantId,
        'São José',
        'sao-jose',
      ])
      expect(state.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        state.tx.category.create.mock.invocationCallOrder[0]!
      )
    })
    it.each([undefined, null, '', false, 0])(
      'falsy icon %s is removed before validation',
      async (icon) => {
        const response = await POST(request({ ...payload, icon }))
        expect(response.status).toBe(201)
        expect((await response.json()).icon).toBeNull()
      }
    )
    it('keeps whitespace-only required strings and backend color defaults', async () => {
      const response = await POST(
        request({
          name: ' ',
          iconColor: ' ',
          bgColor: '\t',
          fontColor: ' ',
          description: ' ',
          icon: ' ',
        })
      )
      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        name: '',
        slug: '',
        description: null,
        icon: null,
        iconColor: '#000000',
        bgColor: '#e0e0e0',
        fontColor: '#000000',
      })
    })
    it.each(['none', 'upload', 'url', 'emoji'])(
      'customIcon source %s is retained and inner extra fields are stripped',
      async (source) => {
        const customIcon = {
          source,
          svgContent: '<svg>fixture</svg>',
          dataUrl: 'fixture-data',
          fileName: 'fixture.svg',
          url: 'https://example.test/icon',
          emoji: null,
          name: ' Fixture icon ',
          extra: true,
        }
        const response = await POST(request({ ...payload, customIcon }))
        expect(response.status).toBe(201)
        const { extra, ...expected } = customIcon
        expect(extra).toBe(true)
        expect((await response.json()).customIcon).toEqual(expected)
      }
    )
    it.each([null, undefined])(
      'absent customIcon %s becomes JSON null',
      async (customIcon) => {
        const response = await POST(request({ ...payload, customIcon }))
        expect(response.status).toBe(201)
        expect((await response.json()).customIcon).toBeNull()
      }
    )
    it.each([400, 401, 403, 404, 409, 503])(
      'forwards permission refusal %s unchanged before malformed JSON',
      async (status) => {
        const denial = Response.json(
          { error: 'fixture denial' },
          {
            status,
            headers: {
              'Cache-Control': 'no-store',
              Vary: 'Cookie',
              'Retry-After': '2',
            },
          }
        )
        state.permission.mockResolvedValueOnce({ ok: false, response: denial })
        expect(await POST(request('{', true))).toBe(denial)
        expect(state.db.$transaction).not.toHaveBeenCalled()
      }
    )
    it.each(['{', '', 'undefined'])(
      'malformed JSON %s is the existing 400',
      async (body) => {
        const response = await POST(request(body, true))
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'JSON inválido' })
        expect(state.db.$transaction).not.toHaveBeenCalled()
      }
    )
    it('null reaches the outer 500 before schema parsing, as in the legacy transport', async () => {
      const response = await POST(request(null))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao criar categoria',
      })
      expect(state.db.$transaction).not.toHaveBeenCalled()
    })
    it.each([
      { value: [] },
      { value: 1 },
      { value: false },
      { value: 'fixture' },
      { value: {} },
      { value: { ...payload, name: '' } },
      { value: { ...payload, iconColor: '' } },
      { value: { ...payload, bgColor: '' } },
      { value: { ...payload, fontColor: '' } },
      { value: { ...payload, description: null } },
      { value: { ...payload, icon: true } },
      { value: { ...payload, placement: 'other' } },
      { value: { ...payload, customIcon: {} } },
      { value: { ...payload, customIcon: { source: 'other' } } },
      { value: { ...payload, tenantId: 'foreign' } },
      { value: { ...payload, id: 'foreign' } },
    ])(
      'invalid/extra DTO %j remains generic 400, without a transaction',
      async ({ value }) => {
        const response = await POST(request(value))
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Dados inválidos' })
        expect(state.db.$transaction).not.toHaveBeenCalled()
        expect(vi.mocked(console.error).mock.calls[0]![0]).toBe(
          '[CATEGORY_ERROR]'
        )
      }
    )
    it('a duplicate name or slug is a domain 409 without creation', async () => {
      state.tx.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'existing' }])
      const response = await POST(request())
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error: 'Categoria já existente' })
      expect(state.tx.category.create).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()
    })
    it.each([400, 404, 409] as const)(
      'a CatalogError %s from permission resolution preserves its envelope',
      async (status) => {
        state.permission.mockRejectedValueOnce(
          new CatalogError('Fixture catalog refusal', status)
        )
        const response = await POST(request())
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual({
          error: 'Fixture catalog refusal',
        })
      }
    )
    it('a real unique-constraint error retains the 409 envelope', async () => {
      state.tx.category.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('private fixture failure', {
          code: 'P2002',
          clientVersion: 'fixture',
        })
      )
      const response = await POST(request())
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error: 'Categoria já existente' })
    })
    it.each(['P2025', 'P2010'])(
      'an Error with provider code %s keeps the existing 400',
      async (code) => {
        state.tx.category.create.mockRejectedValueOnce(
          Object.assign(new Error('private fixture failure'), { code })
        )
        const response = await POST(request())
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Erro ao processar dados da categoria.',
        })
      }
    )
    it.each(['permission', 'transaction', 'lock', 'create'] as const)(
      'untyped failure in %s stays generic 500',
      async (dependency) => {
        const error = new Error('private fixture failure')
        if (dependency === 'permission')
          state.permission.mockRejectedValueOnce(error)
        if (dependency === 'transaction')
          state.db.$transaction.mockRejectedValueOnce(error)
        if (dependency === 'lock')
          state.tx.$executeRaw.mockRejectedValueOnce(error)
        if (dependency === 'create')
          state.tx.category.create.mockRejectedValueOnce(error)
        const response = await POST(request())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao criar categoria',
        })
        expect(console.error).toHaveBeenCalledWith(
          'Error creating category:',
          error
        )
      }
    )
    it.each([null, { status: 'SUSPENDED' }])(
      'revalidates organization status inside the mutation transaction (%s)',
      async (organization) => {
        state.tx.organization.findUnique.mockResolvedValueOnce(organization)
        const response = await POST(request())
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Erro ao processar dados da categoria.',
        })
        expect(state.tx.$executeRaw).not.toHaveBeenCalled()
        expect(state.tx.category.create).not.toHaveBeenCalled()
      }
    )
    it('a plain object claiming P2002 is not treated as an Error', async () => {
      state.tx.category.create.mockRejectedValueOnce({
        code: 'P2002',
        message: 'private fixture',
      })
      const response = await POST(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao criar categoria',
      })
    })
  }
)
