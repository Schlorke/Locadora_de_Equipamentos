import {
  createClientDocumentService,
  REQUIRED_CLIENT_DOCUMENT_TYPES,
} from '@gb-locacoes/backend/customers'
import { withTenantTransaction } from '../../apps/services/api/src/host/tenant-transaction'
import { getPrivateDocumentStorage } from '../../apps/services/api/src/host/document-storage'
import {
  isOwnedDocumentPath,
  PRIVATE_DOCUMENT_URL_TTL,
} from '@gb-locacoes/backend/documents'
vi.mock('@gb-locacoes/backend/documents', async (importOriginal) => {
  privateStorage.requestedDuring ??=
    expect.getState().currentTestName ?? 'collection'
  return importOriginal<typeof import('@gb-locacoes/backend/documents')>()
})
import '@gb-locacoes/backend/documents'
/**
 * Caracterização dos fluxos de cliente: carrinho, perfil comercial, documentos
 * privados, pendências documentais e ClientProfile financeiro. Handlers e
 * fachadas reais rodam sobre um Prisma simulado; os testes fixam status,
 * corpos, headers, precedência de erros e predicados de locadora/usuário.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import Decimal from 'decimal.js'
import { buildQuotePricing } from '@gb-locacoes/domain/orcamento'

const mocked = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  })
  return {
    tx: {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      cart: model(),
      cartItem: model(),
      equipment: model(),
      clientProfile: model(),
      clientDocument: model(),
    },
    transaction: vi.fn(),
    principal: vi.fn(),
    bucket: { getBucket: vi.fn(), createSignedUrl: vi.fn() },
  }
})
/**
 * No incidente histórico, a antiga lib/client-documents importava lib/security/private-documents, ambas retiradas em F,
 * que puxava o barril @gb-locacoes/backend/documents: pdfkit, exceljs, dompurify, sharp.
 * Essa importação fria levou 8,9 s no caso que a disparava com o arquivo quase sozinho e passou do prazo de 20 s sob a
 * carga do test:unit (onda 131); o handler pendente seguia depois do prazo e o caso seguinte recebia 500. A importação
 * acontece na coleta do arquivo, sem prazo de caso; o mock só repassa o módulo real e anota quando ele foi pedido
 * (onda 132, achado 145).
 */
const privateStorage = vi.hoisted(() => ({
  requestedDuring: undefined as string | undefined,
}))
import { loadFinancialCustomers } from '@gb-locacoes/backend/customers'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade da raiz foi retirada no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: { $transaction: mocked.transaction } }),
  // O armazenamento privado do serviço (`host/document-storage`) com o mesmo cliente Supabase simulado da raiz: a
  // composição real (`createPrivateDocumentStorage`) confere o bucket privado como na fachada legada.
  createSupabaseDocumentStorage: () => {
    let storage:
      | ReturnType<
          typeof import('../../packages/backend/src/modules/documents/private-documents').createPrivateDocumentStorage
        >
      | undefined
    return {
      async getPrivateDocumentStorage() {
        const { createPrivateDocumentStorage } =
          await import('../../packages/backend/src/modules/documents/private-documents')
        storage ??= createPrivateDocumentStorage({
          getClient: async () =>
            ({
              storage: {
                from: () => mocked.bucket,
                getBucket: mocked.bucket.getBucket,
              },
            }) as never,
        })
        return storage.getPrivateDocumentStorage()
      },
    }
  },
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({ getServerSession: vi.fn() }))()),
}))
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/private-identity')
    >()),
    ...(await (async () => ({
      resolveTenantPrincipal: mocked.principal,
    }))()),
  })
)
import * as serviceRoute0 from '../../apps/services/api/src/app/api/cart/sync/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/cart/merge/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/user/profile/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/clients/[id]/documents/route'

const HOSTS = [
  [
    'service',
    {
      readCart: serviceRoute0.GET,
      syncCart: serviceRoute0.POST,
      mergeCart: serviceRoute1.POST,
      getProfile: serviceRoute2.GET,
      putProfile: serviceRoute2.PUT,
      listDocumentsRoute: serviceRoute3.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      readCart,
      syncCart,
      mergeCart,
      getProfile,
      putProfile,
      listDocumentsRoute,
    }
  ) => {
    const tenantId = 'tenant-A'
    const userId = 'client-A'
    const principal = (role: string, id = userId) => ({
      tenantId,
      userId: id,
      membershipId: 'member-A',
      role,
    })
    const origin = 'https://app.example.test'
    const get = (path = '/api') => new NextRequest(origin + path)
    const post = (body: unknown, method = 'POST') =>
      new NextRequest(origin + '/api', {
        method,
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    const tx = mocked.tx
    const tenantSet = () => tx.$queryRaw.mock.calls.map((call) => call[1])
    /**
     * Handlers de documentos em voo. Cada caso só termina depois que os seus assentam: um caso que estoura o prazo ou não
     * espera a resposta não deixa a continuação do handler consumir os mocks que o caso seguinte acabou de configurar.
     */
    const inFlight = new Set<Promise<unknown>>()
    const listDocuments = (...args: Parameters<typeof listDocumentsRoute>) => {
      const pending = listDocumentsRoute(...args)
      inFlight.add(pending)
      return pending
    }
    afterEach(async () => {
      await Promise.allSettled([...inFlight])
      inFlight.clear()
    })
    const cartInclude = {
      items: { include: { equipment: { include: { category: true } } } },
    }

    beforeEach(() => {
      vi.resetAllMocks()
      mocked.transaction.mockImplementation(async (operation) => operation(tx))
      mocked.principal.mockResolvedValue({
        ok: true,
        principal: principal('CLIENT'),
      })
      mocked.bucket.getBucket.mockResolvedValue({
        data: { public: false },
        error: null,
      })
    })

    describe('customer cart adapters', () => {
      const valid = { equipmentId: 'eq-A', quantity: 1, days: 1 }
      const equipment = (id: string, price = 10) => ({
        id,
        tenantId,
        pricePerDay: new Decimal(price),
        weeklyDiscount: 10,
      })

      it('reads only the CLIENT cart of the selected tenant', async () => {
        tx.cart.findFirst.mockResolvedValueOnce(null)
        const empty = await readCart(get())
        expect(empty.status).toBe(200)
        expect(await empty.json()).toEqual({ items: [] })
        expect(tenantSet()).toEqual([tenantId])
        expect(tx.cart.findFirst).toHaveBeenCalledWith({
          where: { tenantId, userId },
          include: cartInclude,
        })
        const cart = { id: 'cart-A', items: [{ id: 'item-A' }] }
        tx.cart.findFirst.mockResolvedValueOnce(cart)
        const response = await readCart(get())
        expect(await response.json()).toEqual(cart)
        tx.cart.findFirst.mockRejectedValueOnce(new Error('down'))
        const failed = await readCart(get())
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao sincronizar carrinho',
        })
      })

      it.each(['ADMIN', 'OPERATOR', 'FINANCIAL'])(
        'refuses %s memberships before validating or opening a transaction',
        async (role) => {
          mocked.principal.mockResolvedValue({
            ok: true,
            principal: principal(role),
          })
          const forbidden = {
            error: 'Carrinho disponível apenas para clientes da locadora',
          }
          for (const response of [
            await readCart(get()),
            await syncCart(post({ items: [valid] })),
            await syncCart(post({ items: 'invalid' })),
            await mergeCart(
              post({ localCartItems: [{ ...valid, quantity: 0 }] })
            ),
          ]) {
            expect(response.status).toBe(403)
            expect(await response.json()).toEqual(forbidden)
          }
          expect(mocked.transaction).not.toHaveBeenCalled()
          const malformed = await syncCart(post('{'))
          expect(malformed.status).toBe(500)
        }
      )

      it('propagates a denied principal', async () => {
        mocked.principal.mockImplementation(async () => ({
          ok: false,
          response: Response.json(
            { error: 'Select an organization' },
            { status: 409 }
          ),
        }))
        for (const response of [
          await readCart(get()),
          await syncCart(post('{')),
          await mergeCart(post('{')),
        ]) {
          expect(response.status).toBe(409)
          expect(await response.json()).toEqual({
            error: 'Select an organization',
          })
        }
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      const invalidItems: unknown[] = [
        undefined,
        null,
        {},
        'eq-A',
        [null],
        [[]],
        ['eq-A'],
        [{ ...valid, equipmentId: '' }],
        [{ ...valid, equipmentId: 5 }],
        [{ quantity: 1, days: 1 }],
        [{ ...valid, quantity: 0 }],
        [{ ...valid, quantity: -1 }],
        [{ ...valid, quantity: 1.5 }],
        [{ ...valid, quantity: '1' }],
        [{ ...valid, quantity: 10001 }],
        [{ ...valid, quantity: null }],
        [{ ...valid, days: 0 }],
        [{ ...valid, days: 3651 }],
        [{ ...valid, days: 2.5 }],
        [{ ...valid, days: true }],
        [{ equipmentId: 'eq-A', quantity: 1 }],
        Array.from({ length: 201 }, (_, index) => ({
          ...valid,
          equipmentId: 'eq-' + index,
        })),
      ]
      it.each(invalidItems.map((items, index) => [index, items]))(
        'rejects invalid cart items #%i without opening a transaction',
        async (_index, items) => {
          for (const response of [
            await syncCart(post(items === undefined ? {} : { items })),
            await mergeCart(
              post(items === undefined ? {} : { localCartItems: items })
            ),
          ]) {
            expect(response.status).toBe(400)
            expect(await response.json()).toEqual({ error: 'Itens inválidos' })
          }
          expect(mocked.transaction).not.toHaveBeenCalled()
        }
      )

      it('rejects non-finite quantities decoded from JSON', async () => {
        const response = await syncCart(
          post('{"items":[{"equipmentId":"eq-A","quantity":1e400,"days":1}]}')
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Itens inválidos' })
      })

      it('rejects repeated equipment before opening a transaction', async () => {
        const response = await syncCart(
          post({ items: [valid, { ...valid, days: 3 }] })
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'Equipamento repetido no carrinho',
        })
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('accepts the documented limits', async () => {
        const items = Array.from({ length: 200 }, (_, index) => ({
          equipmentId: 'eq-' + index,
          quantity: index === 0 ? 10000 : 1,
          days: index === 0 ? 3650 : 1,
        }))
        tx.equipment.findMany.mockResolvedValue(
          items.map((item) => equipment(item.equipmentId))
        )
        tx.cart.upsert.mockResolvedValue({ id: 'cart-A' })
        const response = await syncCart(post({ items }))
        expect(response.status).toBe(200)
        expect(tx.cartItem.upsert).toHaveBeenCalledTimes(200)
        const decimals = await syncCart(
          post('{"items":[{"equipmentId":"x","quantity":2.0,"days":1.0}]}')
        )
        expect(decimals.status).toBe(404)
      })

      it('refuses equipment outside the tenant catalog and rolls back', async () => {
        tx.equipment.findMany.mockResolvedValue([])
        const response = await syncCart(post({ items: [valid] }))
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Equipamento não encontrado nesta locadora',
        })
        expect(tx.cart.upsert).not.toHaveBeenCalled()
      })

      it('replaces the cart with server prices under the per-user cart lock', async () => {
        const row = equipment('eq-A', 25)
        tx.equipment.findMany.mockResolvedValue([row])
        tx.cart.upsert.mockResolvedValue({ id: 'cart-A' })
        const response = await syncCart(
          post({
            items: [
              {
                equipmentId: 'eq-A',
                quantity: 2,
                days: 8,
                pricePerDay: 0.01,
                finalPrice: 0.01,
                tenantId: 'tenant-B',
              },
            ],
          })
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          message: 'Carrinho sincronizado com sucesso',
        })
        expect(tenantSet()).toEqual([tenantId])
        const lock = tx.$executeRaw.mock.calls[0]!
        expect((lock[0] as readonly string[]).join('?')).toContain(
          'pg_advisory_xact_lock(hashtextextended('
        )
        expect(lock[1]).toBe(`${tenantId}:cart:${userId}`)
        expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
          tx.equipment.findMany.mock.invocationCallOrder[0]!
        )
        expect(tx.equipment.findMany).toHaveBeenCalledWith({
          where: { tenantId, id: { in: ['eq-A'] } },
        })
        expect(tx.cart.upsert).toHaveBeenCalledWith({
          where: { tenantId_userId: { tenantId, userId } },
          update: {},
          create: { tenantId, userId },
        })
        expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
          where: { tenantId, cartId: 'cart-A' },
        })
        const prices = buildQuotePricing(row, 8, 2)
        const item = {
          equipmentId: 'eq-A',
          quantity: 2,
          days: 8,
          tenantId,
          pricePerDay: prices.pricePerDay,
          finalPrice: prices.total,
        }
        expect(tx.cartItem.upsert).toHaveBeenCalledWith({
          where: {
            cartId_equipmentId: { cartId: 'cart-A', equipmentId: 'eq-A' },
          },
          update: item,
          create: { ...item, cartId: 'cart-A' },
        })
        expect(tx.cart.findUniqueOrThrow).toHaveBeenCalledWith({
          where: { id: 'cart-A', tenantId },
          include: cartInclude,
        })
      })

      it('merges without clearing and returns the authoritative cart', async () => {
        tx.equipment.findMany.mockResolvedValue([equipment('eq-A')])
        tx.cart.upsert.mockResolvedValue({ id: 'cart-A' })
        const cart = { id: 'cart-A', items: [{ equipmentId: 'eq-A' }] }
        tx.cart.findUniqueOrThrow.mockResolvedValue(cart)
        const response = await mergeCart(post({ localCartItems: [valid] }))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(cart)
        expect(tx.cartItem.deleteMany).not.toHaveBeenCalled()
        tx.cart.upsert.mockRejectedValueOnce(new Error('down'))
        const failed = await mergeCart(post({ localCartItems: [valid] }))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao mesclar carrinho',
        })
      })

      it('keeps generic failures for unreadable bodies', async () => {
        for (const [handler, body, error] of [
          [syncCart, '{', 'Erro ao sincronizar carrinho'],
          [syncCart, 'null', 'Erro ao sincronizar carrinho'],
          [mergeCart, '{', 'Erro ao mesclar carrinho'],
          [mergeCart, 'null', 'Erro ao mesclar carrinho'],
        ] as const) {
          const response = await handler(post(body))
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({ error })
        }
        expect(mocked.transaction).not.toHaveBeenCalled()
      })
    })

    describe('tenant commercial profile adapter', () => {
      const profile = {
        id: 'profile-A',
        tenantId,
        userId,
        name: 'Cliente A',
        email: 'a@example.test',
        phone: '11999999999',
        document: '12345678901',
        company: null,
      }
      const where = { tenantId_userId: { tenantId, userId } }

      it('reads the profile of the selected tenant only', async () => {
        tx.clientProfile.findUnique.mockResolvedValueOnce(null)
        const missing = await getProfile(get())
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Perfil da locadora não encontrado',
        })
        expect(tx.clientProfile.findUnique).toHaveBeenCalledWith({ where })
        expect(tenantSet()).toEqual([tenantId])
        for (const [document, cpf, cnpj] of [
          ['12345678901', '12345678901', null],
          ['12345678000199', null, '12345678000199'],
          ['123.456.789-01', null, '123.456.789-01'],
          [null, null, null],
        ] as const) {
          tx.clientProfile.findUnique.mockResolvedValueOnce({
            ...profile,
            document,
          })
          const response = await getProfile(get())
          expect(response.status).toBe(200)
          expect(response.headers.get('cache-control')).toBe('no-store')
          expect(await response.text()).toBe(
            JSON.stringify({
              user: {
                id: userId,
                name: 'Cliente A',
                email: 'a@example.test',
                phone: '11999999999',
                cpf,
                cnpj,
                company: null,
              },
            })
          )
        }
        tx.clientProfile.findUnique.mockRejectedValueOnce(new Error('down'))
        const failed = await getProfile(get())
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({ error: 'Erro ao buscar perfil' })
      })

      it('propagates a denied principal before reading the body', async () => {
        mocked.principal.mockResolvedValue({
          ok: false,
          response: Response.json(
            { error: 'Authentication required' },
            { status: 401 }
          ),
        })
        expect((await getProfile(get())).status).toBe(401)
        expect((await putProfile(post('{', 'PUT'))).status).toBe(401)
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it.each([
        [{ role: 'ADMIN' }, 400, 'Dados inválidos'],
        [{ phone: 'x'.repeat(31) }, 400, 'Dados inválidos'],
        [{ cpf: 12345678901 }, 400, 'Dados inválidos'],
        [{ company: 'x'.repeat(201) }, 400, 'Dados inválidos'],
        [
          { cpf: '123.456.789-01', cnpj: '12.345.678/0001-99' },
          400,
          'Informe somente CPF ou CNPJ válido',
        ],
        [{ cpf: '123' }, 400, 'Informe somente CPF ou CNPJ válido'],
        [{ cnpj: '123456780001' }, 400, 'Informe somente CPF ou CNPJ válido'],
        ['{', 500, 'Erro ao atualizar perfil'],
        ['null', 400, 'Dados inválidos'],
      ] as const)(
        'rejects %j without opening a transaction',
        async (body, status, error) => {
          const response = await putProfile(post(body, 'PUT'))
          expect(response.status).toBe(status)
          expect(await response.json()).toEqual({ error })
          expect(mocked.transaction).not.toHaveBeenCalled()
        }
      )

      it('updates only the tenant profile with normalized values', async () => {
        tx.clientProfile.findUnique.mockResolvedValue(profile)
        tx.clientProfile.update.mockImplementation(async ({ data }) => ({
          ...profile,
          ...data,
        }))
        const response = await putProfile(
          post(
            {
              phone: '(11) 98888-7777',
              cpf: '123.456.789-09',
              company: '  ACME  ',
            },
            'PUT'
          )
        )
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(tx.clientProfile.update).toHaveBeenCalledWith({
          where,
          data: {
            phone: '11988887777',
            document: '12345678909',
            company: 'ACME',
          },
        })
        expect(await response.text()).toBe(
          JSON.stringify({
            success: true,
            user: {
              id: userId,
              name: 'Cliente A',
              email: 'a@example.test',
              phone: '11988887777',
              cpf: '12345678909',
              cnpj: null,
              company: 'ACME',
            },
          })
        )
        for (const [body, data] of [
          [
            { phone: '', company: '   ' },
            { phone: null, company: null },
          ],
          [{ cnpj: '12.345.678/0001-99' }, { document: '12345678000199' }],
          [{ cpf: '' }, {}],
          [{}, {}],
        ] as const) {
          await putProfile(post(body, 'PUT'))
          expect(tx.clientProfile.update).toHaveBeenLastCalledWith({
            where,
            data,
          })
        }
      })

      it('never creates a missing profile and maps document conflicts', async () => {
        tx.clientProfile.findUnique.mockResolvedValueOnce(null)
        const missing = await putProfile(post({ phone: '1' }, 'PUT'))
        expect(missing.status).toBe(404)
        expect(await missing.json()).toEqual({
          error: 'Perfil da locadora não encontrado',
        })
        expect(tx.clientProfile.update).not.toHaveBeenCalled()
        tx.clientProfile.findUnique.mockResolvedValue(profile)
        tx.clientProfile.update.mockRejectedValueOnce(
          Object.assign(new Error('unique'), { code: 'P2002' })
        )
        const conflict = await putProfile(post({ cpf: '12345678909' }, 'PUT'))
        expect(conflict.status).toBe(409)
        expect(await conflict.json()).toEqual({
          error: 'Documento já cadastrado nesta locadora',
        })
        tx.clientProfile.update.mockRejectedValueOnce(new Error('down'))
        const failed = await putProfile(post({ cpf: '12345678909' }, 'PUT'))
        expect(failed.status).toBe(500)
        expect(await failed.json()).toEqual({
          error: 'Erro ao atualizar perfil',
        })
      })
    })

    describe('private client documents adapter', () => {
      const route = (id = userId) => ({ params: Promise.resolve({ id }) })
      const select = {
        id: true,
        userId: true,
        rentalId: true,
        type: true,
        filePath: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        fileHash: true,
        captureMetadata: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, name: true } },
      }

      it.each([
        ['FINANCIAL', userId],
        ['CLIENT', 'client-B'],
      ])(
        'denies %s reading %s before any storage or database access',
        async (role, id) => {
          mocked.principal.mockResolvedValue({
            ok: true,
            principal: principal(role),
          })
          const response = await listDocuments(get(), route(id))
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({ error: 'Acesso negado' })
          expect(mocked.transaction).not.toHaveBeenCalled()
          expect(mocked.bucket.getBucket).not.toHaveBeenCalled()
        }
      )

      it('propagates a denied principal', async () => {
        mocked.principal.mockResolvedValue({
          ok: false,
          response: Response.json(
            { error: 'Organization access denied' },
            { status: 403 }
          ),
        })
        const response = await listDocuments(get(), route())
        expect(response.status).toBe(403)
        expect(await response.json()).toEqual({
          error: 'Organization access denied',
        })
      })

      it('returns 404 for a client without profile in the tenant', async () => {
        mocked.principal.mockResolvedValue({
          ok: true,
          principal: principal('ADMIN', 'admin-A'),
        })
        tx.clientProfile.findUnique.mockResolvedValue(null)
        const response = await listDocuments(get(), route('client-B'))
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Cliente não encontrado',
        })
        expect(tx.clientProfile.findUnique).toHaveBeenCalledWith({
          where: { tenantId_userId: { tenantId, userId: 'client-B' } },
          select: { id: true },
        })
        expect(tx.clientDocument.findMany).not.toHaveBeenCalled()
        expect(mocked.bucket.getBucket).not.toHaveBeenCalled()
      })

      it('fails closed when private storage is unavailable, even without documents', async () => {
        tx.clientProfile.findUnique.mockResolvedValue({ id: 'profile-A' })
        tx.clientDocument.findMany.mockResolvedValue([])
        mocked.bucket.getBucket.mockResolvedValue({
          data: { public: true },
          error: null,
        })
        const response = await listDocuments(get(), route())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao carregar documentos sensíveis do cliente',
        })
      })

      it.each(['CLIENT', 'OPERATOR', 'ADMIN'])(
        'lets %s list tenant documents and signs only owned keys',
        async (role) => {
          mocked.principal.mockResolvedValue({
            ok: true,
            principal: principal(role, role === 'CLIENT' ? userId : 'staff-A'),
          })
          tx.clientProfile.findUnique.mockResolvedValue({ id: 'profile-A' })
          const created = '2030-01-01T00:00:00.000Z'
          tx.clientDocument.findMany.mockResolvedValue([
            {
              id: 'doc-1',
              filePath: `tenants/${tenantId}/clients/${userId}/abc.pdf`,
              fileName: 'a.pdf',
              type: 'ID_DOCUMENT',
              createdAt: created,
            },
            {
              id: 'doc-2',
              filePath: `tenants/tenant-B/clients/${userId}/abc.pdf`,
              fileName: 'b.pdf',
              type: 'SELFIE',
              createdAt: created,
            },
            {
              id: 'doc-3',
              filePath: `tenants/${tenantId}/clients/${userId}/def.pdf`,
              fileName: 'c.pdf',
              type: 'SELFIE',
              createdAt: created,
            },
          ])
          mocked.bucket.createSignedUrl
            .mockResolvedValueOnce({
              data: { signedUrl: 'https://storage.invalid/1' },
            })
            .mockResolvedValueOnce({ data: null })
          const response = await listDocuments(get(), route())
          expect(response.status).toBe(200)
          expect(response.headers.get('cache-control')).toBe(
            'private, no-store'
          )
          expect(await response.text()).toBe(
            JSON.stringify({
              documents: [
                {
                  id: 'doc-1',
                  fileName: 'a.pdf',
                  type: 'ID_DOCUMENT',
                  createdAt: created,
                  signedUrl: 'https://storage.invalid/1',
                },
                {
                  id: 'doc-2',
                  fileName: 'b.pdf',
                  type: 'SELFIE',
                  createdAt: created,
                  signedUrl: null,
                },
                {
                  id: 'doc-3',
                  fileName: 'c.pdf',
                  type: 'SELFIE',
                  createdAt: created,
                  signedUrl: null,
                },
              ],
            })
          )
          expect(mocked.bucket.createSignedUrl.mock.calls).toEqual([
            [
              `tenants/${tenantId}/clients/${userId}/abc.pdf`,
              300,
              { download: 'a.pdf' },
            ],
            [
              `tenants/${tenantId}/clients/${userId}/def.pdf`,
              300,
              { download: 'c.pdf' },
            ],
          ])
          expect(tenantSet()).toEqual([tenantId])
          expect(tx.clientDocument.findMany).toHaveBeenCalledWith({
            where: { tenantId, userId },
            orderBy: { createdAt: 'desc' },
            select,
          })
          expect(mocked.bucket.getBucket).toHaveBeenCalledWith(
            'gb-locacoes-client-documents'
          )
        }
      )

      it('fails closed when signing fails', async () => {
        tx.clientProfile.findUnique.mockResolvedValue({ id: 'profile-A' })
        tx.clientDocument.findMany.mockResolvedValue([
          {
            id: 'doc-1',
            filePath: `tenants/${tenantId}/clients/${userId}/abc.pdf`,
            fileName: 'a.pdf',
          },
        ])
        mocked.bucket.createSignedUrl.mockRejectedValue(new Error('storage'))
        const response = await listDocuments(get(), route())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao carregar documentos sensíveis do cliente',
        })
      })

      it('loads the private storage composition while collecting the file, never inside a case', () => {
        expect(privateStorage.requestedDuring).toBe('collection')
      })

      describe('isolation between cases', () => {
        const owned = {
          id: 'doc-1',
          filePath: `tenants/${tenantId}/clients/${userId}/abc.pdf`,
          fileName: 'a.pdf',
          type: 'ID_DOCUMENT',
          createdAt: '2030-01-01T00:00:00.000Z',
        }

        it('a handler still waiting for storage when its case ends settles before the next case', async () => {
          tx.clientProfile.findUnique.mockResolvedValue({ id: 'profile-A' })
          tx.clientDocument.findMany.mockResolvedValue([owned])
          let release = () => {}
          mocked.bucket.getBucket.mockReturnValue(
            new Promise((resolve) => {
              release = () => resolve({ data: { public: false }, error: null })
            })
          )
          // Sem await: é o caso que estourou o prazo com o handler ainda à espera do armazenamento.
          void listDocuments(get(), route())
          await vi.waitFor(() =>
            expect(mocked.bucket.getBucket).toHaveBeenCalled()
          )
          setTimeout(() => release(), 20)
        })

        it('the next case starts with no call left by the previous handler', async () => {
          await new Promise((resolve) => setTimeout(resolve, 60))
          expect(mocked.bucket.createSignedUrl).not.toHaveBeenCalled()
          expect(tx.$queryRaw).not.toHaveBeenCalled()
          expect(mocked.transaction).not.toHaveBeenCalled()
        })
      })
    })

    describe('required client documents', () => {
      it('lists missing required types for the rental or client scope', async () => {
        expect(REQUIRED_CLIENT_DOCUMENT_TYPES).toEqual([
          'ID_DOCUMENT',
          'SELFIE',
          'SIGNED_CONTRACT',
          'CPF_CNPJ_PROOF',
        ])
        const db = { clientDocument: { findMany: vi.fn() } }
        db.clientDocument.findMany.mockResolvedValue([
          { type: 'SELFIE' },
          { type: 'OTHER' },
        ])
        expect(
          await getMissingClientDocuments(
            { tenantId },
            { userId, rentalId: 'rental-A' },
            db as never
          )
        ).toEqual(['ID_DOCUMENT', 'SIGNED_CONTRACT', 'CPF_CNPJ_PROOF'])
        expect(db.clientDocument.findMany).toHaveBeenLastCalledWith({
          where: {
            userId,
            OR: [{ rentalId: 'rental-A' }, { rentalId: null }],
            tenantId,
          },
          select: { type: true },
        })
        for (const rentalId of [undefined, null, '']) {
          await getMissingClientDocuments(
            { tenantId },
            { userId, rentalId },
            db as never
          )
          expect(db.clientDocument.findMany).toHaveBeenLastCalledWith({
            where: { userId, tenantId },
            select: { type: true },
          })
        }
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('opens its own tenant transaction when no client is supplied', async () => {
        tx.clientDocument.findMany.mockResolvedValue([
          { type: 'ID_DOCUMENT' },
          { type: 'SELFIE' },
          { type: 'SIGNED_CONTRACT' },
          { type: 'CPF_CNPJ_PROOF' },
        ])
        expect(
          await getMissingClientDocuments({ tenantId }, { userId })
        ).toEqual([])
        expect(tenantSet()).toEqual([tenantId])
        expect(tx.clientDocument.findMany).toHaveBeenCalledWith({
          where: { userId, tenantId },
          select: { type: true },
        })
      })
    })

    describe('financial client profiles', () => {
      it('indexes tenant profiles by user and classifies documents by digits', async () => {
        const rows = [
          { id: 'p1', userId: 'u1', document: '123.456.789-01', name: 'A' },
          { id: 'p2', userId: 'u2', document: '12.345.678/0001-99', name: 'B' },
          { id: 'p3', userId: 'u3', document: null, name: 'C' },
          { id: 'p4', userId: 'u4', document: '123', name: 'D' },
        ]
        const db = {
          clientProfile: { findMany: vi.fn().mockResolvedValue(rows) },
        }
        const customers = await loadFinancialCustomers(
          { tenantId },
          db as never
        )
        expect(db.clientProfile.findMany).toHaveBeenCalledWith({
          where: { tenantId, userId: { not: null } },
        })
        expect([...customers.entries()]).toEqual([
          ['u1', { ...rows[0], cpf: '123.456.789-01', cnpj: null }],
          ['u2', { ...rows[1], cpf: null, cnpj: '12.345.678/0001-99' }],
          ['u3', { ...rows[2], cpf: null, cnpj: null }],
          ['u4', { ...rows[3], cpf: null, cnpj: null }],
        ])
        expect(mocked.transaction).not.toHaveBeenCalled()
      })
    })
  }
)

const { getMissingClientDocuments } = createClientDocumentService({
  withTenantTransaction,
  storage: {
    async open() {
      const bucket = await getPrivateDocumentStorage()
      return {
        isOwnedPath: isOwnedDocumentPath,
        async signedUrl(filePath, fileName) {
          const signed = await bucket.createSignedUrl(
            filePath,
            PRIVATE_DOCUMENT_URL_TTL,
            { download: fileName }
          )
          return signed.data?.signedUrl || null
        },
      }
    },
  },
})
