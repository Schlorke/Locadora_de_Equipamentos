/**
 * Caracterização HTTP do catálogo (público e administrativo).
 * Os handlers reais rodam sobre um Prisma simulado: cada teste fixa status,
 * corpo, headers, precedência de erros e os predicados de locadora enviados ao
 * banco, para que a extração para @gb-locacoes/backend/catalog não altere o
 * contrato.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE, PUBLIC_ORGANIZATION_SELECT } from '../helpers/public-site'
import { NextRequest } from 'next/server'
import Decimal from 'decimal.js'
import { Prisma } from '@prisma/client'

const mocked = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })
  return {
    tx: {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      organization: model(),
      permission: model(),
      category: model(),
      equipment: model(),
      equipmentUnit: model(),
      setting: model(),
    },
    transaction: vi.fn(),
    publicOrganization: vi.fn(),
    principal: vi.fn(),
    rateLimit: vi.fn(),
  }
})
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({
    prisma: {
      $transaction: mocked.transaction,
      organization: { findUnique: mocked.publicOrganization },
    },
  }),
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: mocked.rateLimit,
  adminApiRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  getServerSession: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocked.principal,
}))
import * as serviceRoute0 from '../../apps/services/api/src/app/api/categories/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/equipments/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/equipamentos/search/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/settings/public/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/categories/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/categories/[id]/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/equipments/route'
import * as serviceRoute7 from '../../apps/services/api/src/app/api/admin/equipments/[id]/route'
import * as serviceRoute8 from '../../apps/services/api/src/app/api/admin/equipment-units/route'
import * as serviceRoute9 from '../../apps/services/api/src/app/api/admin/equipment-units/[id]/route'

const HOSTS = [
  [
    'service',
    {
      publicCategories: serviceRoute0.GET,
      publicEquipments: serviceRoute1.GET,
      searchEquipments: serviceRoute2.GET,
      publicSettings: serviceRoute3.GET,
      listCategories: serviceRoute4.GET,
      createCategory: serviceRoute4.POST,
      updateCategory: serviceRoute5.PUT,
      deleteCategory: serviceRoute5.DELETE,
      listEquipments: serviceRoute6.GET,
      createEquipment: serviceRoute6.POST,
      readEquipment: serviceRoute7.GET,
      updateEquipment: serviceRoute7.PUT,
      deleteEquipment: serviceRoute7.DELETE,
      listUnits: serviceRoute8.GET,
      createUnit: serviceRoute8.POST,
      readUnit: serviceRoute9.GET,
      updateUnit: serviceRoute9.PATCH,
      deleteUnit: serviceRoute9.DELETE,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      publicCategories,
      publicEquipments,
      searchEquipments,
      publicSettings,
      listCategories,
      createCategory,
      updateCategory,
      deleteCategory,
      listEquipments,
      createEquipment,
      readEquipment,
      updateEquipment,
      deleteEquipment,
      listUnits,
      createUnit,
      readUnit,
      updateUnit,
      deleteUnit,
    }
  ) => {
    const tenantId = 'tenant-A'
    const principal = (role: string) => ({
      tenantId,
      userId: 'user-A',
      membershipId: 'member-A',
      role,
    })
    const origin = 'https://app.example.test'
    const get = (path: string) => new NextRequest(origin + path)
    const send = (method: string, path: string, body?: unknown) =>
      new NextRequest(origin + path, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(body === undefined
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      })
    const params = (id: string) => ({ params: Promise.resolve({ id }) })
    const created = new Date('2030-01-01T00:00:00.000Z')
    const cacheHeader = 'public, max-age=60, stale-while-revalidate=300'
    const prismaError = (code: string, message = 'prisma failure') =>
      Object.assign(new Error(message), { code })
    const tx = mocked.tx
    const tenantSet = () => tx.$queryRaw.mock.calls.map((call) => call[1])
    const rentalLocks = () =>
      tx.$executeRaw.mock.calls.filter((call) =>
        (call[0] as readonly string[]).join('?').includes('rental-mutations')
      )
    const isCategoryNameQuery = (sql: readonly string[]) =>
      sql.join('?').includes('FROM categories')
    const categoryNameQueries = () =>
      tx.$queryRaw.mock.calls.filter((call) =>
        isCategoryNameQuery(call[0] as readonly string[])
      )
    /** Linhas devolvidas pela busca de nome/slug duplicado da categoria. */
    const existingCategories = (rows: { id: string }[]) =>
      tx.$queryRaw.mockImplementation(async (sql: readonly string[]) =>
        isCategoryNameQuery(sql) ? rows : []
      )

    /** Toda transação administrativa passa pelo lock de mutação da locadora. */
    function expectRentalLock() {
      const locks = rentalLocks()
      expect(locks.length).toBeGreaterThan(0)
      expect(locks).toHaveLength(mocked.transaction.mock.calls.length)
      for (const lock of locks) expect(lock[1]).toBe(tenantId)
      expect(new Set(tenantSet())).toEqual(new Set([tenantId]))
      expect(tx.organization.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
        select: { status: true },
      })
      expect(
        tx.organization.findUnique.mock.invocationCallOrder[0]
      ).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0]!)
    }

    beforeEach(() => {
      vi.resetAllMocks()
      mocked.transaction.mockImplementation(async (operation) => operation(tx))
      mocked.principal.mockResolvedValue({
        ok: true,
        principal: principal('ADMIN'),
      })
      mocked.rateLimit.mockReturnValue({ allowed: true })
      mocked.publicOrganization.mockResolvedValue({
        id: tenantId,
        status: 'ACTIVE',
        ...LIVE_SITE,
      })
      tx.organization.findUnique.mockResolvedValue({ status: 'ACTIVE' })
    })

    afterEach(() => vi.unstubAllEnvs())

    describe('public catalog adapters', () => {
      const tenantRequired = { error: 'Selecione uma locadora' }
      const notFound = { error: 'Locadora não encontrada' }
      it.each([
        ['categories', publicCategories, '/api/categories'],
        ['equipments', publicEquipments, '/api/equipments'],
        ['search', searchEquipments, '/api/equipamentos/search'],
      ] as const)(
        '%s requires a public tenant slug and never falls back to a default locadora',
        async (_name, handler, path) => {
          for (const query of ['', '?tenantSlug=', '?tenantSlug=%20%20']) {
            const response = await handler(get(path + query))
            expect(response.status).toBe(409)
            expect(await response.json()).toEqual(tenantRequired)
          }
          mocked.publicOrganization.mockResolvedValueOnce(null)
          const unknown = await handler(get(path + '?tenantSlug=unknown&q=be'))
          expect(unknown.status).toBe(404)
          expect(await unknown.json()).toEqual(notFound)
          mocked.publicOrganization.mockResolvedValueOnce({
            id: tenantId,
            status: 'SUSPENDED',
          })
          expect(
            (await handler(get(path + '?tenantSlug=suspended'))).status
          ).toBe(404)
          expect(
            (await handler(get(path + '?tenantSlug=Bad_Slug'))).status
          ).toBe(404)
          expect(
            (await handler(get(path + '?tenantSlug=%20tenant-a'))).status
          ).toBe(404)
          expect(mocked.publicOrganization).toHaveBeenCalledTimes(2)
          expect(mocked.transaction).not.toHaveBeenCalled()
        }
      )

      it('lists categories of the resolved tenant with the public cache header', async () => {
        const rows = [
          { id: 'cat-A', name: 'Andaimes', _count: { equipments: 2 } },
          { id: 'cat-B', name: 'Betoneiras', _count: { equipments: 0 } },
        ]
        tx.category.findMany.mockResolvedValue(rows)
        const response = await publicCategories(
          get('/api/categories?tenantSlug=tenant-a')
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe(cacheHeader)
        expect(await response.text()).toBe(JSON.stringify(rows))
        expect(mocked.publicOrganization).toHaveBeenCalledWith({
          where: { slug: 'tenant-a' },
          select: PUBLIC_ORGANIZATION_SELECT,
        })
        expect(tenantSet()).toEqual([tenantId])
        expect(tx.$executeRaw).not.toHaveBeenCalled()
        expect(tx.category.findMany).toHaveBeenCalledWith({
          where: { tenantId },
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            iconColor: true,
            bgColor: true,
            fontColor: true,
            slug: true,
            placement: true,
            customIcon: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { equipments: true } },
          },
          orderBy: { name: 'asc' },
        })
      })

      it('maps public equipment rows exactly, preserving zero stock and Decimal conversion', async () => {
        const category = {
          id: 'cat-A',
          name: 'Andaimes',
          description: 'hidden',
          icon: 'Box',
          iconColor: '#111111',
          bgColor: '#222222',
          fontColor: '#333333',
          slug: 'andaimes',
          customIcon: { source: 'emoji', emoji: 'x' },
          tenantId,
          createdAt: created,
          updatedAt: created,
        }
        tx.equipment.findMany.mockResolvedValue([
          {
            id: 'eq-A',
            tenantId,
            name: 'Betoneira',
            description: 'Descrição',
            pricePerDay: new Decimal('150.50'),
            images: ['a.jpg', 'b.jpg'],
            available: false,
            categoryId: 'cat-A',
            specifications: { secret: true },
            createdAt: created,
            updatedAt: created,
            maxStock: 0,
            dailyDiscount: 5,
            weeklyDiscount: null,
            biweeklyDiscount: 0,
            monthlyDiscount: 20,
            popularPeriod: null,
            dailyDirectValue: new Decimal('10.25'),
            weeklyDirectValue: null,
            biweeklyDirectValue: new Decimal(0),
            monthlyDirectValue: new Decimal('99.9'),
            dailyUseDirectValue: true,
            weeklyUseDirectValue: false,
            biweeklyUseDirectValue: false,
            monthlyUseDirectValue: true,
            category,
          },
          {
            id: 'eq-B',
            tenantId,
            name: 'Andaime',
            description: null,
            pricePerDay: new Decimal('7'),
            images: [],
            available: true,
            categoryId: 'cat-A',
            createdAt: created,
            updatedAt: created,
            maxStock: null,
            dailyDiscount: null,
            weeklyDiscount: null,
            biweeklyDiscount: null,
            monthlyDiscount: null,
            popularPeriod: 'monthly',
            dailyDirectValue: null,
            weeklyDirectValue: null,
            biweeklyDirectValue: null,
            monthlyDirectValue: null,
            dailyUseDirectValue: false,
            weeklyUseDirectValue: false,
            biweeklyUseDirectValue: false,
            monthlyUseDirectValue: false,
            category: null,
          },
        ])
        const response = await publicEquipments(
          get('/api/equipments?tenantSlug=tenant-a')
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe(cacheHeader)
        expect(await response.text()).toBe(
          JSON.stringify([
            {
              id: 'eq-A',
              name: 'Betoneira',
              description: 'Descrição',
              pricePerDay: 150.5,
              imageUrl: 'a.jpg',
              images: ['a.jpg', 'b.jpg'],
              isAvailable: false,
              category: {
                id: 'cat-A',
                name: 'Andaimes',
                icon: 'Box',
                iconColor: '#111111',
                bgColor: '#222222',
                fontColor: '#333333',
                customIcon: { source: 'emoji', emoji: 'x' },
              },
              reviews: [],
              dailyDiscount: 5,
              weeklyDiscount: 0,
              biweeklyDiscount: 0,
              monthlyDiscount: 20,
              popularPeriod: 'weekly',
              maxStock: 0,
              dailyDirectValue: 10.25,
              weeklyDirectValue: 0,
              biweeklyDirectValue: 0,
              monthlyDirectValue: 99.9,
              dailyUseDirectValue: true,
              weeklyUseDirectValue: false,
              biweeklyUseDirectValue: false,
              monthlyUseDirectValue: true,
            },
            {
              id: 'eq-B',
              name: 'Andaime',
              description: null,
              pricePerDay: 7,
              imageUrl: null,
              images: [],
              isAvailable: true,
              category: null,
              reviews: [],
              dailyDiscount: 0,
              weeklyDiscount: 0,
              biweeklyDiscount: 0,
              monthlyDiscount: 0,
              popularPeriod: 'monthly',
              maxStock: 1,
              dailyDirectValue: 0,
              weeklyDirectValue: 0,
              biweeklyDirectValue: 0,
              monthlyDirectValue: 0,
              dailyUseDirectValue: false,
              weeklyUseDirectValue: false,
              biweeklyUseDirectValue: false,
              monthlyUseDirectValue: false,
            },
          ])
        )
        expect(tenantSet()).toEqual([tenantId])
        expect(tx.equipment.findMany).toHaveBeenCalledWith({
          where: { tenantId },
          include: { category: true },
          orderBy: { createdAt: 'desc' },
        })
      })

      it('searches only available equipment of the tenant and short-circuits short queries', async () => {
        for (const q of ['', '&q=', '&q=a', '&q=%20a%20']) {
          const response = await searchEquipments(
            get('/api/equipamentos/search?tenantSlug=tenant-a' + q)
          )
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual([])
        }
        expect(mocked.transaction).not.toHaveBeenCalled()
        const rows = [{ id: 'eq-A', name: 'Betoneira', pricePerDay: '10' }]
        tx.equipment.findMany.mockResolvedValue(rows)
        const response = await searchEquipments(
          get('/api/equipamentos/search?tenantSlug=tenant-a&q=%20be%20')
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBeNull()
        expect(await response.json()).toEqual(rows)
        expect(tenantSet()).toEqual([tenantId])
        expect(tx.equipment.findMany).toHaveBeenCalledWith({
          where: {
            tenantId,
            OR: [
              { name: { contains: ' be ', mode: 'insensitive' } },
              { description: { contains: ' be ', mode: 'insensitive' } },
            ],
            available: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            pricePerDay: true,
            category: { select: { name: true } },
            images: true,
          },
          take: 8,
          orderBy: { name: 'asc' },
        })
      })

      it('keeps public settings codes, trims the slug and returns only public fields', async () => {
        for (const query of ['', '?tenantSlug=', '?tenantSlug=%20']) {
          const response = await publicSettings(
            get('/api/settings/public' + query)
          )
          expect(response.status).toBe(409)
          expect(await response.json()).toEqual({
            error: 'Selecione uma locadora',
            code: 'TENANT_REQUIRED',
          })
        }
        mocked.publicOrganization.mockResolvedValueOnce(null)
        const unknown = await publicSettings(
          get('/api/settings/public?tenantSlug=unknown')
        )
        expect(unknown.status).toBe(404)
        expect(await unknown.json()).toEqual({
          error: 'Locadora não encontrada',
        })
        tx.setting.findFirst.mockResolvedValueOnce(null)
        const missing = await publicSettings(
          get('/api/settings/public?tenantSlug=%20tenant-a%20')
        )
        expect(missing.status).toBe(409)
        expect(await missing.json()).toEqual({
          error: 'Configurações públicas indisponíveis nesta locadora',
          code: 'SETTINGS_NOT_CONFIGURED',
        })
        expect(mocked.publicOrganization).toHaveBeenLastCalledWith({
          where: { slug: 'tenant-a' },
          select: PUBLIC_ORGANIZATION_SELECT,
        })
        const settings = {
          contactEmail: 'alfa@example.test',
          socialLinks: null,
        }
        // Achado 147: o horário das configurações e a identificação legal da organização entram na leitura pública; o
        // documento cru e o horário fora do formato não saem.
        tx.setting.findFirst.mockResolvedValueOnce({
          ...settings,
          businessHours: {
            monday: { open: '08:00', close: '18:00', closed: false },
            tuesday: { open: 'oito', close: '18:00' },
          },
        })
        tx.organization.findUnique.mockResolvedValueOnce({
          legalName: 'Alfa Equipamentos Ltda',
          documentNormalized: '11222333000181',
          document: null,
        })
        const response = await publicSettings(
          get('/api/settings/public?tenantSlug=tenant-a')
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBeNull()
        const body = await response.json()
        expect(body).toEqual({
          ...settings,
          businessHours: {
            monday: { closed: false, open: '08:00', close: '18:00' },
          },
          legalIdentity: {
            legalName: 'Alfa Equipamentos Ltda',
            cnpj: '11.222.333/0001-81',
          },
          // Onda 134: conteúdo institucional (vazio sem dado) e nenhum texto legal publicado.
          siteContent: {},
          legalDocuments: { terms: false, privacy: false, returnPolicy: false },
          // Onda 135 (A4): SEO da vitrine, aditivo; sem valor gravado sai null.
          seoTitle: null,
          seoDescription: null,
        })
        expect(JSON.stringify(body)).not.toContain('11222333000181')
        expect(tx.setting.findFirst).toHaveBeenLastCalledWith({
          where: { tenantId },
          select: {
            companyPhone: true,
            whatsappNumber: true,
            contactEmail: true,
            companyAddress: true,
            companyIconUrl: true,
            marketingEmail: true,
            aboutUsText: true,
            socialLinks: true,
            heroCarousel: true,
            waveAnimation: true,
            businessHours: true,
            siteContent: true,
            termsPublishedAt: true,
            privacyPublishedAt: true,
            returnPolicyPublishedAt: true,
            seoTitle: true,
            seoDescription: true,
          },
        })
        expect(tx.organization.findUnique).toHaveBeenLastCalledWith({
          where: { id: tenantId },
          select: { legalName: true, documentNormalized: true, document: true },
        })
      })

      it.each([
        [
          'categories',
          publicCategories,
          '/api/categories?tenantSlug=tenant-a',
          () => tx.category.findMany,
          { error: 'Erro ao buscar categorias' },
        ],
        [
          'equipments',
          publicEquipments,
          '/api/equipments?tenantSlug=tenant-a',
          () => tx.equipment.findMany,
          { error: 'Erro ao buscar equipamentos' },
        ],
        [
          'search',
          searchEquipments,
          '/api/equipamentos/search?tenantSlug=tenant-a&q=be',
          () => tx.equipment.findMany,
          { error: 'Erro interno do servidor' },
        ],
        [
          'settings',
          publicSettings,
          '/api/settings/public?tenantSlug=tenant-a',
          () => tx.setting.findFirst,
          { error: 'Não foi possível carregar as configurações públicas' },
        ],
      ] as const)(
        '%s hides storage failures behind its 500 envelope',
        async (_name, handler, path, query, body) => {
          vi.spyOn(console, 'error').mockImplementation(() => undefined)
          query().mockRejectedValue(new Error('database down'))
          const response = await handler(get(path))
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual(body)
          mocked.publicOrganization.mockRejectedValue(new Error('lookup down'))
          const lookup = await handler(get(path))
          expect(lookup.status).toBe(500)
          expect(await lookup.json()).toEqual(body)
        }
      )
    })

    describe('admin catalog authorization', () => {
      const handlers = [
        ['GET categories', () => listCategories(get('/c')), 'READ'],
        [
          'POST categories',
          () => createCategory(send('POST', '/c', {})),
          'WRITE',
        ],
        [
          'PUT category',
          () => updateCategory(send('PUT', '/c', {}), params('c')),
          'WRITE',
        ],
        [
          'DELETE category',
          () => deleteCategory(send('DELETE', '/c'), params('c')),
          'DELETE',
        ],
        ['GET equipments', () => listEquipments(get('/e')), 'READ'],
        [
          'POST equipments',
          () => createEquipment(send('POST', '/e', {})),
          'WRITE',
        ],
        ['GET equipment', () => readEquipment(get('/e'), params('e')), 'READ'],
        [
          'PUT equipment',
          () => updateEquipment(send('PUT', '/e', {}), params('e')),
          'WRITE',
        ],
        [
          'DELETE equipment',
          () => deleteEquipment(send('DELETE', '/e'), params('e')),
          'DELETE',
        ],
        ['GET units', () => listUnits(get('/u')), 'READ'],
        ['POST units', () => createUnit(send('POST', '/u', {})), 'WRITE'],
        ['GET unit', () => readUnit(get('/u'), params('u')), 'READ'],
        [
          'PATCH unit',
          () => updateUnit(send('PATCH', '/u', {}), params('u')),
          'WRITE',
        ],
        [
          'DELETE unit',
          () => deleteUnit(send('DELETE', '/u'), params('u')),
          'DELETE',
        ],
      ] as const

      it.each(handlers)(
        '%s propagates a denied principal before opening a transaction',
        async (_name, call) => {
          mocked.principal.mockResolvedValue({
            ok: false,
            response: Response.json({ error: 'Denied' }, { status: 401 }),
          })
          const response = await call()
          expect(response.status).toBe(401)
          expect(await response.json()).toEqual({ error: 'Denied' })
          expect(mocked.transaction).not.toHaveBeenCalled()
        }
      )

      it.each(handlers)(
        '%s refuses CLIENT memberships',
        async (_name, call) => {
          mocked.principal.mockResolvedValue({
            ok: true,
            principal: principal('CLIENT'),
          })
          const response = await call()
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({
            error: 'Acesso administrativo não permitido',
          })
          expect(mocked.transaction).not.toHaveBeenCalled()
        }
      )

      it.each(handlers)(
        '%s checks the tenant permission module/action for operators',
        async (_name, call, action) => {
          mocked.principal.mockResolvedValue({
            ok: true,
            principal: principal('OPERATOR'),
          })
          tx.permission.findFirst.mockResolvedValue(null)
          const response = await call()
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({
            error: 'Permissão insuficiente nesta locadora',
          })
          expect(tx.permission.findFirst).toHaveBeenCalledWith({
            where: { tenantId, role: 'OPERATOR', module: 'EQUIPMENTS', action },
            select: { id: true },
          })
          expect(rentalLocks()).toHaveLength(0)
        }
      )

      it('lets an operator with permission through to the locked catalog transaction', async () => {
        mocked.principal.mockResolvedValue({
          ok: true,
          principal: principal('OPERATOR'),
        })
        tx.permission.findFirst.mockResolvedValue({ id: 'permission-A' })
        tx.category.findMany.mockResolvedValue([])
        expect((await listCategories(get('/c'))).status).toBe(200)
        expect(mocked.transaction).toHaveBeenCalledTimes(2)
        expect(rentalLocks()).toHaveLength(1)
        expect(
          tx.permission.findFirst.mock.invocationCallOrder[0]
        ).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0]!)
      })

      it('returns the rate-limit response untouched for equipment list and creation', async () => {
        const limited = Response.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': '30' } }
        )
        mocked.rateLimit.mockReturnValue({ allowed: false, response: limited })
        expect(await listEquipments(get('/e'))).toBe(limited)
        expect(await createEquipment(send('POST', '/e', {}))).toBe(limited)
        expect(mocked.principal).not.toHaveBeenCalled()
      })
    })

    describe('admin categories', () => {
      const valid = {
        name: '  Nova Categória  ',
        description: '  Descrição  ',
        icon: '',
        iconColor: ' #111111 ',
        bgColor: '#ffffff',
        fontColor: '#000000',
        placement: 'types',
      }
      it('lists tenant categories with equipment counts inside the rental lock', async () => {
        const rows = [{ id: 'cat-A', _count: { equipments: 1 } }]
        tx.category.findMany.mockResolvedValue(rows)
        const response = await listCategories(get('/api/admin/categories'))
        expect(response.status).toBe(200)
        expect(await response.text()).toBe(JSON.stringify(rows))
        expectRentalLock()
        expect(tx.category.findMany).toHaveBeenCalledWith({
          where: { tenantId },
          include: { _count: { select: { equipments: true } } },
          orderBy: { createdAt: 'desc' },
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.category.findMany.mockRejectedValue(new Error('down'))
        const failed = await listCategories(get('/api/admin/categories'))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao buscar categorias',
        })
      })

      it('creates with derived slug, trimmed fields and JsonNull icon', async () => {
        existingCategories([])
        tx.category.create.mockImplementation(async ({ data }) => ({
          ...data,
          customIcon: null,
          createdAt: created,
        }))
        const response = await createCategory(send('POST', '/c', valid))
        expect(response.status).toBe(201)
        expectRentalLock()
        const [nameQuery, ...more] = categoryNameQueries()
        expect(more).toHaveLength(0)
        const [sql, ...values] = nameQuery!
        // Comparação exata sem caixa, parametrizada; nunca ILIKE (curingas).
        expect((sql as readonly string[]).join('?').replace(/\s+/g, ' ')).toBe(
          ' SELECT id FROM categories WHERE "tenantId" = ? AND (lower(name) = lower(?) OR slug = ?) LIMIT 1'
        )
        expect(values).toEqual([tenantId, 'Nova Categória', 'nova-categoria'])
        expect(tx.category.findFirst).not.toHaveBeenCalled()
        const data = tx.category.create.mock.calls[0]![0].data
        expect(data).toEqual({
          tenantId,
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          name: 'Nova Categória',
          description: 'Descrição',
          icon: null,
          iconColor: '#111111',
          bgColor: '#ffffff',
          fontColor: '#000000',
          slug: 'nova-categoria',
          placement: 'types',
          customIcon: Prisma.JsonNull,
        })
        expect(await response.json()).toEqual({
          ...data,
          customIcon: null,
          createdAt: created.toISOString(),
        })
        const customIcon = { source: 'emoji', emoji: 'x' }
        await createCategory(
          send('POST', '/c', { ...valid, icon: ' Box ', customIcon })
        )
        expect(tx.category.create.mock.calls[1]![0].data).toMatchObject({
          icon: 'Box',
          customIcon,
        })
      })

      it.each([
        ['malformed JSON', '{', 400, { error: 'JSON inválido' }],
        ['JSON null', 'null', 500, { error: 'Erro ao criar categoria' }],
        ['missing colors', { name: 'X' }, 400, { error: 'Dados inválidos' }],
        [
          'unknown field',
          { ...valid, tenantId: 'tenant-B' },
          400,
          { error: 'Dados inválidos' },
        ],
        [
          'invalid placement',
          { ...valid, placement: 'other' },
          400,
          { error: 'Dados inválidos' },
        ],
      ] as const)(
        'rejects %s before touching categories',
        async (_name, body, status, expected) => {
          vi.spyOn(console, 'error').mockImplementation(() => undefined)
          const response = await createCategory(send('POST', '/c', body))
          expect(response.status).toBe(status)
          expect(await response.json()).toEqual(expected)
          expect(categoryNameQueries()).toHaveLength(0)
          expect(tx.category.create).not.toHaveBeenCalled()
        }
      )

      it('maps duplicates and database failures to the legacy envelopes', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        existingCategories([{ id: 'cat-A' }])
        const duplicate = await createCategory(send('POST', '/c', valid))
        expect(duplicate.status).toBe(409)
        expect(await duplicate.json()).toEqual({
          error: 'Categoria já existente',
        })
        expect(tx.category.create).not.toHaveBeenCalled()
        for (const [error, status, body] of [
          [prismaError('P2002'), 409, { error: 'Categoria já existente' }],
          [
            prismaError('P2003'),
            400,
            { error: 'Erro ao processar dados da categoria.' },
          ],
          [new Error('boom'), 500, { error: 'Erro ao criar categoria' }],
        ] as const) {
          existingCategories([])
          tx.category.create.mockRejectedValueOnce(error)
          const response = await createCategory(send('POST', '/c', valid))
          expect(response.status).toBe(status)
          expect(await response.json()).toEqual(body)
        }
      })

      it('checks ownership before reading the update body', async () => {
        tx.category.findFirst.mockResolvedValue(null)
        const response = await updateCategory(
          send('PUT', '/c', '{'),
          params('cat-B')
        )
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Registro não encontrado',
        })
        expect(tx.category.findFirst).toHaveBeenCalledWith({
          where: { id: 'cat-B', tenantId },
          select: { id: true },
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.category.findFirst.mockResolvedValue({ id: 'cat-A' })
        const malformed = await updateCategory(
          send('PUT', '/c', '{'),
          params('cat-A')
        )
        expect(malformed.status).toBe(500)
        expect(await malformed.json()).toEqual({
          error: 'Erro ao atualizar categoria',
        })
        expect(tx.category.update).not.toHaveBeenCalled()
      })

      it('applies partial updates with the legacy defaults', async () => {
        tx.category.findFirst.mockResolvedValue({ id: 'cat-A' })
        tx.category.update.mockImplementation(async ({ data }) => ({
          id: 'cat-A',
          ...data,
        }))
        const response = await updateCategory(
          send('PUT', '/c', {
            name: ' Novo Nome ',
            description: '',
            icon: null,
            iconColor: '',
            fontColor: ' #333333 ',
            placement: 'other',
            customIcon: null,
            tenantId: 'tenant-B',
          }),
          params('cat-A')
        )
        expect(response.status).toBe(200)
        expectRentalLock()
        const data = {
          name: 'Novo Nome',
          slug: 'novo-nome',
          description: null,
          icon: null,
          iconColor: '#000000',
          fontColor: '#333333',
          placement: null,
          customIcon: Prisma.JsonNull,
        }
        expect(tx.category.update).toHaveBeenCalledWith({
          where: { id: 'cat-A', tenantId },
          data,
        })
        expect(await response.json()).toEqual({
          id: 'cat-A',
          ...data,
          customIcon: {},
        })
        await updateCategory(
          send('PUT', '/c', {
            bgColor: '',
            placement: 'phases',
            customIcon: { emoji: 'y' },
          }),
          params('cat-A')
        )
        expect(tx.category.update.mock.calls[1]![0].data).toEqual({
          bgColor: '#e0e0e0',
          placement: 'phases',
          customIcon: { emoji: 'y' },
        })
        await updateCategory(send('PUT', '/c', {}), params('cat-A'))
        expect(tx.category.update.mock.calls[2]![0].data).toEqual({})
      })

      it('deletes only an owned category', async () => {
        tx.category.findFirst.mockResolvedValueOnce(null)
        const missing = await deleteCategory(
          send('DELETE', '/c'),
          params('cat-B')
        )
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Categoria não encontrada',
        })
        expect(tx.category.delete).not.toHaveBeenCalled()
        tx.category.findFirst.mockResolvedValue({ id: 'cat-A' })
        const response = await deleteCategory(
          send('DELETE', '/c'),
          params('cat-A')
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ message: 'Categoria excluída' })
        expect(tx.category.delete).toHaveBeenCalledWith({
          where: { id: 'cat-A', tenantId },
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.category.delete.mockRejectedValue(prismaError('P2003'))
        const failed = await deleteCategory(
          send('DELETE', '/c'),
          params('cat-A')
        )
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao excluir categoria',
        })
      })
    })

    describe('admin equipments', () => {
      const include = {
        category: true,
        _count: { select: { quoteItems: true, rental_items: true } },
      }
      const row = {
        id: 'eq-A',
        tenantId,
        name: 'Betoneira',
        description: 'Desc',
        pricePerDay: new Decimal('12.5'),
        available: false,
        images: [],
        category: { id: 'cat-A' },
        _count: { quoteItems: 3, rental_items: 4 },
      }

      it('paginates and filters the tenant list with the legacy response shape', async () => {
        tx.equipment.findMany.mockResolvedValue([row])
        tx.equipment.count.mockResolvedValue(11)
        const response = await listEquipments(get('/e'))
        expect(response.status).toBe(200)
        expectRentalLock()
        expect(tx.equipment.findMany).toHaveBeenCalledWith({
          where: { tenantId },
          skip: 0,
          take: 100,
          include,
          orderBy: { createdAt: 'desc' },
        })
        expect(tx.equipment.count).toHaveBeenCalledWith({ where: { tenantId } })
        expect(await response.text()).toBe(
          JSON.stringify({
            equipments: [{ ...row, pricePerDay: 12.5, isAvailable: false }],
            pagination: { page: 1, limit: 100, totalItems: 11, totalPages: 1 },
          })
        )
        await listEquipments(
          get(
            '/e?page=2.9&limit=5&search=bet&categoryId=cat-A&isAvailable=false'
          )
        )
        const where = {
          tenantId,
          OR: [
            { name: { contains: 'bet', mode: 'insensitive' } },
            { description: { contains: 'bet', mode: 'insensitive' } },
          ],
          categoryId: 'cat-A',
          available: false,
        }
        expect(tx.equipment.findMany).toHaveBeenLastCalledWith({
          where,
          skip: 5,
          take: 5,
          include,
          orderBy: { createdAt: 'desc' },
        })
        expect(tx.equipment.count).toHaveBeenLastCalledWith({ where })
        const last = await listEquipments(
          get('/e?page=3&limit=5&categoryId=all&isAvailable=all')
        )
        expect(tx.equipment.findMany.mock.lastCall![0].where).toEqual({
          tenantId,
        })
        expect((await last.json()).pagination).toEqual({
          page: 3,
          limit: 5,
          totalItems: 11,
          totalPages: 3,
        })
        await listEquipments(get('/e?isAvailable=yes'))
        expect(tx.equipment.findMany.mock.lastCall![0].where).toEqual({
          tenantId,
          available: false,
        })
        await listEquipments(get('/e?isAvailable=true'))
        expect(tx.equipment.findMany.mock.lastCall![0].where).toEqual({
          tenantId,
          available: true,
        })
      })

      it.each([
        ['?page=abc', "Parâmetro 'page' inválido."],
        ['?page=0', "Parâmetro 'page' inválido."],
        ['?limit=0', "Parâmetro 'limit' inválido."],
        ['?limit=x', "Parâmetro 'limit' inválido."],
      ])('rejects %s', async (query, error) => {
        const response = await listEquipments(get('/e' + query))
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error })
        expect(tx.equipment.findMany).not.toHaveBeenCalled()
      })

      it('hides list failures without development details', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipment.findMany.mockRejectedValue(prismaError('P1001'))
        const response = await listEquipments(get('/e'))
        expect(response.status).toBe(500)
        expect(await response.text()).toBe(
          JSON.stringify({
            error: 'Erro interno do servidor ao buscar equipamentos.',
          })
        )
      })

      const createBody = {
        name: '  Betoneira  ',
        description: '  Descrição  ',
        pricePerDay: '12.50',
        categoryId: 'cat-A',
        images: ['a.jpg', '', '  ', 3, 'b.jpg'],
        isAvailable: false,
        maxStock: 0,
        dailyDiscount: -5,
        weeklyDiscount: 150,
        biweeklyDiscount: 10,
        monthlyDiscount: '20',
        popularPeriod: 'monthly',
        dailyDirectValue: 1.5,
        weeklyDirectValue: '2',
        biweeklyDirectValue: 0,
        monthlyDirectValue: 4,
        dailyUseDirectValue: true,
        weeklyUseDirectValue: 'true',
        biweeklyUseDirectValue: false,
        monthlyUseDirectValue: true,
        dailyRentalEnabled: false,
        weeklyRentalEnabled: 'no',
        biweeklyRentalEnabled: true,
        monthlyRentalEnabled: false,
        tenantId: 'tenant-B',
        specifications: { ignored: true },
      }

      it('creates equipment with the legacy sanitization and defaults', async () => {
        tx.category.findUnique.mockResolvedValue({ id: 'cat-A' })
        tx.equipment.create.mockImplementation(async ({ data }) => ({
          id: 'eq-new',
          ...data,
          pricePerDay: new Decimal(data.pricePerDay),
          category: { id: 'cat-A' },
        }))
        const response = await createEquipment(send('POST', '/e', createBody))
        expect(response.status).toBe(201)
        expectRentalLock()
        expect(tx.category.findUnique).toHaveBeenCalledWith({
          where: { id: 'cat-A', tenantId },
        })
        const data = {
          tenantId,
          name: 'Betoneira',
          description: 'Descrição',
          pricePerDay: 12.5,
          categoryId: 'cat-A',
          images: ['a.jpg', 'b.jpg'],
          available: false,
          maxStock: 0,
          dailyDiscount: 0,
          weeklyDiscount: 100,
          biweeklyDiscount: 10,
          monthlyDiscount: 0,
          popularPeriod: 'monthly',
          dailyDirectValue: 1.5,
          weeklyDirectValue: 0,
          biweeklyDirectValue: 0,
          monthlyDirectValue: 4,
          dailyUseDirectValue: true,
          weeklyUseDirectValue: false,
          biweeklyUseDirectValue: false,
          monthlyUseDirectValue: true,
          dailyRentalEnabled: false,
          weeklyRentalEnabled: true,
          biweeklyRentalEnabled: true,
          monthlyRentalEnabled: false,
        }
        expect(tx.equipment.create).toHaveBeenCalledWith({
          data,
          include: { category: true },
        })
        expect(await response.text()).toBe(
          JSON.stringify({
            id: 'eq-new',
            ...data,
            pricePerDay: 12.5,
            category: { id: 'cat-A' },
            isAvailable: false,
          })
        )
        await createEquipment(
          send('POST', '/e', {
            name: 'X',
            description: 'Y',
            pricePerDay: 0,
            categoryId: 'cat-A',
          })
        )
        expect(tx.equipment.create.mock.lastCall![0].data).toEqual({
          tenantId,
          name: 'X',
          description: 'Y',
          pricePerDay: 0,
          categoryId: 'cat-A',
          images: [],
          available: true,
          maxStock: 1,
          dailyDiscount: 0,
          weeklyDiscount: 0,
          biweeklyDiscount: 0,
          monthlyDiscount: 0,
          popularPeriod: 'weekly',
          dailyDirectValue: 0,
          weeklyDirectValue: 0,
          biweeklyDirectValue: 0,
          monthlyDirectValue: 0,
          dailyUseDirectValue: false,
          weeklyUseDirectValue: false,
          biweeklyUseDirectValue: false,
          monthlyUseDirectValue: false,
          dailyRentalEnabled: true,
          weeklyRentalEnabled: true,
          biweeklyRentalEnabled: true,
          monthlyRentalEnabled: true,
        })
      })

      it.each([
        [
          { ...createBody, name: '   ' },
          400,
          'Nome do equipamento é obrigatório.',
        ],
        [{ ...createBody, name: 5 }, 400, 'Nome do equipamento é obrigatório.'],
        [
          { ...createBody, description: '' },
          400,
          'Descrição do equipamento é obrigatória.',
        ],
        [
          { ...createBody, categoryId: 7 },
          400,
          'ID da categoria é obrigatório.',
        ],
        [
          { ...createBody, pricePerDay: null },
          400,
          'Preço por dia é obrigatório.',
        ],
        [
          { ...createBody, pricePerDay: 'abc' },
          400,
          'Preço por dia inválido. Deve ser um número positivo.',
        ],
        [
          { ...createBody, pricePerDay: -1 },
          400,
          'Preço por dia inválido. Deve ser um número positivo.',
        ],
      ])('rejects invalid creation %#', async (body, status, error) => {
        const response = await createEquipment(send('POST', '/e', body))
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual({ error })
        expect(tx.category.findUnique).not.toHaveBeenCalled()
      })

      it('refuses a category of another tenant and maps creation failures', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.category.findUnique.mockResolvedValue(null)
        const missing = await createEquipment(send('POST', '/e', createBody))
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Categoria não encontrada.',
        })
        expect(tx.equipment.create).not.toHaveBeenCalled()
        tx.category.findUnique.mockResolvedValue({ id: 'cat-A' })
        tx.equipment.create.mockRejectedValueOnce(prismaError('P2003'))
        const prisma = await createEquipment(send('POST', '/e', createBody))
        expect(prisma.status).toBe(400)
        expect(await prisma.text()).toBe(
          JSON.stringify({ error: 'Erro ao processar dados do equipamento.' })
        )
        const malformed = await createEquipment(send('POST', '/e', '{'))
        expect(malformed.status).toBe(500)
        expect(await malformed.text()).toBe(
          JSON.stringify({
            error: 'Erro interno do servidor ao criar equipamento.',
          })
        )
      })

      it('reads one owned equipment with the legacy _count shape', async () => {
        tx.equipment.findUnique.mockResolvedValueOnce(null)
        const missing = await readEquipment(get('/e'), params('eq-B'))
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(tx.equipment.findUnique).toHaveBeenCalledWith({
          where: { id: 'eq-B', tenantId },
          include,
        })
        tx.equipment.findUnique.mockResolvedValueOnce(row)
        const response = await readEquipment(get('/e'), params('eq-A'))
        expect(response.status).toBe(200)
        expectRentalLock()
        expect(await response.text()).toBe(
          JSON.stringify({
            ...row,
            pricePerDay: 12.5,
            isAvailable: false,
            _count: { quoteItems: 3, reviews: 0 },
          })
        )
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipment.findUnique.mockRejectedValueOnce(new Error('down'))
        const failed = await readEquipment(get('/e'), params('eq-A'))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro interno do servidor',
        })
      })

      const updateBody = {
        name: 'Novo',
        description: 'Nova desc',
        pricePerDay: '20.75',
        categoryId: 'cat-A',
      }

      it.each([
        [
          { ...updateBody, name: '' },
          'Nome é obrigatório e deve ser uma string',
        ],
        [
          { ...updateBody, description: 3 },
          'Descrição é obrigatória e deve ser uma string',
        ],
        [
          { ...updateBody, pricePerDay: 0 },
          'Preço por dia é obrigatório e deve ser um número válido',
        ],
        [
          { ...updateBody, pricePerDay: 'abc' },
          'Preço por dia é obrigatório e deve ser um número válido',
        ],
        [{ ...updateBody, categoryId: null }, 'ID da categoria é obrigatório'],
      ])('rejects invalid update %#', async (body, error) => {
        const response = await updateEquipment(
          send('PUT', '/e', body),
          params('eq-A')
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error })
        expect(tx.category.findFirst).not.toHaveBeenCalled()
      })

      it('checks category before equipment ownership and applies the legacy update rules', async () => {
        tx.category.findFirst.mockResolvedValueOnce(null)
        const category = await updateEquipment(
          send('PUT', '/e', updateBody),
          params('eq-A')
        )
        expect(category.status).toBe(404)
        expect(await category.json()).toEqual({
          error: 'Categoria não encontrada',
        })
        expect(tx.category.findFirst).toHaveBeenCalledWith({
          where: { id: 'cat-A', tenantId },
          select: { id: true },
        })
        expect(tx.equipment.findUnique).not.toHaveBeenCalled()
        tx.category.findFirst.mockResolvedValue({ id: 'cat-A' })
        tx.equipment.findUnique.mockResolvedValueOnce(null)
        const missing = await updateEquipment(
          send('PUT', '/e', updateBody),
          params('eq-B')
        )
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(tx.equipment.findUnique).toHaveBeenCalledWith({
          where: { id: 'eq-B', tenantId },
        })
        expect(tx.equipment.update).not.toHaveBeenCalled()

        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        tx.equipment.findUnique.mockResolvedValue({ id: 'eq-A' })
        tx.equipment.update.mockResolvedValue({
          ...row,
          pricePerDay: new Decimal('20.75'),
        })
        const response = await updateEquipment(
          send('PUT', '/e', {
            ...updateBody,
            specifications: null,
            images: 'not-array',
            isAvailable: 0,
            maxStock: '0',
            dailyDiscount: '-3',
            weeklyDiscount: '250',
            biweeklyDiscount: 'x',
            monthlyDiscount: 12.9,
            popularPeriod: 'yearly',
            dailyDirectValue: '-1',
            weeklyDirectValue: '3.5',
            biweeklyDirectValue: 'abc',
            monthlyDirectValue: 0,
            dailyUseDirectValue: 'yes',
            weeklyUseDirectValue: 0,
            biweeklyUseDirectValue: null,
            monthlyUseDirectValue: 1,
            dailyRentalEnabled: '',
            weeklyRentalEnabled: 'x',
            biweeklyRentalEnabled: false,
            monthlyRentalEnabled: true,
            partsLossHistory: [{ part: 'x' }],
            partsLossCount: '-2',
            tenantId: 'tenant-B',
          }),
          params('eq-A')
        )
        expect(response.status).toBe(200)
        expectRentalLock()
        expect(tx.equipment.update).toHaveBeenCalledWith({
          where: { id: 'eq-A', tenantId },
          data: {
            name: 'Novo',
            description: 'Nova desc',
            pricePerDay: 20.75,
            categoryId: 'cat-A',
            specifications: {},
            images: [],
            available: false,
            dailyDiscount: 0,
            weeklyDiscount: 100,
            monthlyDiscount: 12,
            monthlyDirectValue: 0,
            weeklyDirectValue: 3.5,
            dailyUseDirectValue: true,
            weeklyUseDirectValue: false,
            biweeklyUseDirectValue: false,
            monthlyUseDirectValue: true,
            dailyRentalEnabled: false,
            weeklyRentalEnabled: true,
            biweeklyRentalEnabled: false,
            monthlyRentalEnabled: true,
            partsLossHistory: [{ part: 'x' }],
          },
          include,
        })
        expect(await response.text()).toBe(
          JSON.stringify({
            ...row,
            pricePerDay: 20.75,
            isAvailable: false,
            _count: { quoteItems: 3, reviews: 0 },
          })
        )
        await updateEquipment(
          send('PUT', '/e', {
            ...updateBody,
            pricePerDay: 9,
            images: ['x.jpg'],
            maxStock: 3,
            popularPeriod: 'daily',
            partsLossCount: 2,
            specifications: { a: 1 },
          }),
          params('eq-A')
        )
        expect(tx.equipment.update.mock.lastCall![0].data).toEqual({
          name: 'Novo',
          description: 'Nova desc',
          pricePerDay: 9,
          categoryId: 'cat-A',
          specifications: { a: 1 },
          images: ['x.jpg'],
          maxStock: 3,
          popularPeriod: 'daily',
          partsLossCount: 2,
        })
      })

      it.each(['production', 'development'])(
        'protects update failures according to %s',
        async (environment) => {
          vi.stubEnv('NODE_ENV', environment)
          vi.spyOn(console, 'error').mockImplementation(() => undefined)
          tx.category.findFirst.mockResolvedValue({ id: 'cat-A' })
          tx.equipment.findUnique.mockResolvedValue({ id: 'eq-A' })
          tx.equipment.update.mockRejectedValue(new Error('boom'))
          const failed = await updateEquipment(
            send('PUT', '/e', updateBody),
            params('eq-A')
          )
          expect(failed.status).toBe(500)
          expect(await failed.text()).toBe(
            JSON.stringify({
              error:
                environment === 'development'
                  ? 'boom'
                  : 'Erro interno do servidor',
              details:
                environment === 'development'
                  ? 'boom'
                  : 'Erro interno do servidor',
            })
          )
          const malformed = await updateEquipment(
            send('PUT', '/e', '{'),
            params('eq-A')
          )
          expect(malformed.status).toBe(500)
          const body = await malformed.json()
          expect(body.error).toBeTruthy()
          expect(body.details).toBe(body.error)
        }
      )

      it('deletes only owned equipment', async () => {
        tx.equipment.findUnique.mockResolvedValueOnce(null)
        const missing = await deleteEquipment(
          send('DELETE', '/e'),
          params('eq-B')
        )
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(tx.equipment.findUnique).toHaveBeenCalledWith({
          where: { id: 'eq-B', tenantId },
          select: { images: true },
        })
        expect(tx.equipment.delete).not.toHaveBeenCalled()
        tx.equipment.findUnique.mockResolvedValue({ images: [] })
        const response = await deleteEquipment(
          send('DELETE', '/e'),
          params('eq-A')
        )
        expect(response.status).toBe(200)
        expectRentalLock()
        expect(await response.json()).toEqual({
          message: 'Equipamento removido com sucesso',
        })
        expect(tx.equipment.delete).toHaveBeenCalledWith({
          where: { id: 'eq-A', tenantId },
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipment.delete.mockRejectedValue(new Error('fk'))
        const failed = await deleteEquipment(
          send('DELETE', '/e'),
          params('eq-A')
        )
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro interno do servidor',
        })
      })
    })

    describe('admin equipment units', () => {
      const include = {
        equipment: {
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
          },
        },
      }
      const unit = {
        id: 'unit-A',
        tenantId,
        uniqueCode: 'U-1',
        status: 'AVAILABLE',
      }

      it('lists tenant units with the legacy filters', async () => {
        tx.equipmentUnit.findMany.mockResolvedValue([unit])
        const response = await listUnits(get('/u'))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual([unit])
        expectRentalLock()
        expect(tx.equipmentUnit.findMany).toHaveBeenCalledWith({
          where: { tenantId },
          include,
          orderBy: { uniqueCode: 'asc' },
        })
        await listUnits(get('/u?equipmentId=eq-A&status=RENTED&search=u-1'))
        expect(tx.equipmentUnit.findMany.mock.lastCall![0].where).toEqual({
          tenantId,
          equipmentId: 'eq-A',
          status: 'RENTED',
          OR: [
            { uniqueCode: { contains: 'u-1', mode: 'insensitive' } },
            { serialNumber: { contains: 'u-1', mode: 'insensitive' } },
          ],
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipmentUnit.findMany.mockRejectedValue(new Error('down'))
        const failed = await listUnits(get('/u'))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao buscar unidades',
        })
      })

      it('creates a unit only for owned equipment and unique tenant code', async () => {
        const invalid = await createUnit(
          send('POST', '/u', { equipmentId: 'eq-A', uniqueCode: '' })
        )
        expect(invalid.status).toBe(400)
        const body = await invalid.json()
        expect(body.error).toBe('Dados inválidos')
        expect(body.details).toHaveLength(1)
        expect(body.details[0]).toMatchObject({
          path: ['uniqueCode'],
          message: 'Código único é obrigatório',
        })
        expect(tx.equipmentUnit.findFirst).not.toHaveBeenCalled()

        tx.equipmentUnit.findFirst.mockResolvedValueOnce({ id: 'unit-B' })
        const duplicate = await createUnit(
          send('POST', '/u', { equipmentId: 'eq-A', uniqueCode: 'U-1' })
        )
        expect(duplicate.status).toBe(400)
        expect(await duplicate.json()).toEqual({
          error: 'Código único já existe',
        })
        expect(tx.equipmentUnit.findFirst).toHaveBeenCalledWith({
          where: { tenantId, uniqueCode: 'U-1' },
        })

        tx.equipment.findUnique.mockResolvedValueOnce(null)
        const foreign = await createUnit(
          send('POST', '/u', { equipmentId: 'eq-B', uniqueCode: 'U-1' })
        )
        expect(foreign.status).toBe(404)
        expect(await foreign.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(tx.equipment.findUnique).toHaveBeenCalledWith({
          where: { id: 'eq-B', tenantId },
        })
        expect(tx.equipmentUnit.create).not.toHaveBeenCalled()

        tx.equipment.findUnique.mockResolvedValue({ id: 'eq-A' })
        tx.equipmentUnit.create.mockResolvedValue(unit)
        const response = await createUnit(
          send('POST', '/u', {
            equipmentId: 'eq-A',
            uniqueCode: 'U-1',
            serialNumber: 'SN',
            hourMeter: 0,
            odometer: 12.5,
            tenantId: 'tenant-B',
            status: 'RENTED',
          })
        )
        expect(response.status).toBe(201)
        expectRentalLock()
        expect(await response.json()).toEqual(unit)
        expect(tx.equipmentUnit.create).toHaveBeenCalledWith({
          data: {
            tenantId,
            equipmentId: 'eq-A',
            uniqueCode: 'U-1',
            serialNumber: 'SN',
            notes: undefined,
            hourMeter: undefined,
            odometer: 12.5,
            status: 'AVAILABLE',
          },
          include,
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const malformed = await createUnit(send('POST', '/u', '{'))
        expect(malformed.status).toBe(500)
        expect(await malformed.json()).toEqual({
          error: 'Erro ao criar unidade',
        })
      })

      it('reads one owned unit', async () => {
        tx.equipmentUnit.findFirst.mockResolvedValueOnce(null)
        const missing = await readUnit(get('/u'), params('unit-B'))
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Unidade não encontrada',
        })
        expect(tx.equipmentUnit.findFirst).toHaveBeenCalledWith({
          where: { id: 'unit-B', tenantId },
          include,
        })
        tx.equipmentUnit.findFirst.mockResolvedValueOnce(unit)
        const response = await readUnit(get('/u'), params('unit-A'))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(unit)
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipmentUnit.findFirst.mockRejectedValueOnce(new Error('down'))
        const failed = await readUnit(get('/u'), params('unit-A'))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({ error: 'Erro ao buscar unidade' })
      })

      it('checks unit ownership before validating the patch body', async () => {
        tx.equipmentUnit.findFirst.mockResolvedValueOnce(null)
        const missing = await updateUnit(
          send('PATCH', '/u', { status: 'BROKEN' }),
          params('unit-B')
        )
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Registro não encontrado',
        })
        expect(tx.equipmentUnit.findFirst).toHaveBeenCalledWith({
          where: { id: 'unit-B', tenantId },
          select: { id: true },
        })
        tx.equipmentUnit.findFirst.mockResolvedValueOnce({ id: 'unit-A' })
        const invalid = await updateUnit(
          send('PATCH', '/u', { status: 'BROKEN' }),
          params('unit-A')
        )
        expect(invalid.status).toBe(400)
        const body = await invalid.json()
        expect(body.error).toBe('Dados inválidos')
        expect(body.details[0]).toMatchObject({ path: ['status'] })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipmentUnit.findFirst.mockResolvedValueOnce({ id: 'unit-A' })
        const malformed = await updateUnit(
          send('PATCH', '/u', '{'),
          params('unit-A')
        )
        expect(malformed.status).toBe(500)
        expect(await malformed.json()).toEqual({
          error: 'Erro ao atualizar unidade',
        })
        expect(tx.equipmentUnit.update).not.toHaveBeenCalled()
      })

      it('updates a unit keeping code uniqueness per tenant', async () => {
        tx.equipmentUnit.findFirst
          .mockResolvedValueOnce({ id: 'unit-A' })
          .mockResolvedValueOnce({ id: 'unit-B' })
        const duplicate = await updateUnit(
          send('PATCH', '/u', { uniqueCode: 'U-2' }),
          params('unit-A')
        )
        expect(duplicate.status).toBe(400)
        expect(await duplicate.json()).toEqual({
          error: 'Código único já existe',
        })
        expect(tx.equipmentUnit.findFirst).toHaveBeenLastCalledWith({
          where: { tenantId, uniqueCode: 'U-2' },
        })
        expect(tx.equipmentUnit.update).not.toHaveBeenCalled()

        tx.equipmentUnit.findFirst
          .mockResolvedValueOnce({ id: 'unit-A' })
          .mockResolvedValueOnce({ id: 'unit-A' })
        tx.equipmentUnit.update.mockResolvedValue(unit)
        const response = await updateUnit(
          send('PATCH', '/u', {
            uniqueCode: 'U-1',
            status: 'MAINTENANCE',
            hourMeter: 0,
            odometer: 5,
            serialNumber: '',
            notes: 'nota',
            tenantId: 'tenant-B',
          }),
          params('unit-A')
        )
        expect(response.status).toBe(200)
        expectRentalLock()
        expect(await response.json()).toEqual(unit)
        expect(tx.equipmentUnit.update).toHaveBeenCalledWith({
          where: { id: 'unit-A', tenantId },
          data: {
            uniqueCode: 'U-1',
            status: 'MAINTENANCE',
            hourMeter: 0,
            odometer: 5,
            serialNumber: null,
            notes: 'nota',
          },
          include,
        })
        tx.equipmentUnit.findFirst.mockResolvedValueOnce({ id: 'unit-A' })
        await updateUnit(send('PATCH', '/u', { notes: '' }), params('unit-A'))
        expect(tx.equipmentUnit.update.mock.lastCall![0].data).toEqual({
          notes: null,
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipmentUnit.findFirst.mockResolvedValueOnce({ id: 'unit-A' })
        tx.equipmentUnit.update.mockRejectedValueOnce(new Error('down'))
        const failed = await updateUnit(
          send('PATCH', '/u', {}),
          params('unit-A')
        )
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao atualizar unidade',
        })
      })

      it('never deletes a foreign or in-use unit', async () => {
        tx.equipmentUnit.findFirst.mockResolvedValueOnce(null)
        const missing = await deleteUnit(send('DELETE', '/u'), params('unit-B'))
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Unidade não encontrada',
        })
        expect(tx.equipmentUnit.findFirst).toHaveBeenCalledWith({
          where: { id: 'unit-B', tenantId },
        })
        for (const status of ['RENTED', 'RESERVED']) {
          tx.equipmentUnit.findFirst.mockResolvedValueOnce({ ...unit, status })
          const busy = await deleteUnit(send('DELETE', '/u'), params('unit-A'))
          expect(busy.status).toBe(400)
          expect(await busy.json()).toEqual({
            error: 'Não é possível deletar unidade em uso',
          })
        }
        expect(tx.equipmentUnit.delete).not.toHaveBeenCalled()
        tx.equipmentUnit.findFirst.mockResolvedValue(unit)
        const response = await deleteUnit(
          send('DELETE', '/u'),
          params('unit-A')
        )
        expect(response.status).toBe(200)
        expectRentalLock()
        expect(await response.json()).toEqual({
          message: 'Unidade deletada com sucesso',
        })
        expect(tx.equipmentUnit.delete).toHaveBeenCalledWith({
          where: { id: 'unit-A', tenantId },
        })
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        tx.equipmentUnit.delete.mockRejectedValue(new Error('down'))
        const failed = await deleteUnit(send('DELETE', '/u'), params('unit-A'))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao deletar unidade',
        })
      })
    })
  }
)
