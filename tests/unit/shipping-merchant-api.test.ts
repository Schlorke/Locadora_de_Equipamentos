import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  credential: vi.fn(),
  fetch: vi.fn(),
  tx: {
    tenantIntegration: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    equipment: { count: vi.fn() },
  },
}))
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/private-identity')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: state.principal,
      withTenantTransaction: state.transaction,
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: state.principal,
      withTenantTransaction: state.transaction,
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/webhook-authentication',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/webhook-authentication')
    >()),
    ...(await (() => ({
      resolveIntegrationCredential: state.credential,
    }))()),
  })
)
import * as serviceRoute0 from '../../apps/services/api/src/app/api/integrations/melhor-envio/calculate/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/google-merchant/status/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/google-merchant/sync/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/google-merchant/products/[id]/route'

const HOSTS = [
  [
    'service',
    {
      shipping: serviceRoute0.POST,
      status: serviceRoute1.GET,
      sync: serviceRoute2.POST,
      product: serviceRoute3.POST,
      remove: serviceRoute3.DELETE,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (_host, { shipping, status, sync, product, remove }) => {
    const principal = {
      tenantId: 'tenant-a',
      userId: 'user-a',
      membershipId: 'member-a',
      role: 'ADMIN',
    }
    const credential = {
      signingSecret: 'local',
      apiKey: 'local-key',
      environment: 'sandbox',
      userAgent: 'Fixture (support@example.test)',
    }
    const input = {
      from: { postal_code: '01001-000' },
      to: { postal_code: '02002-000' },
      products: [
        { id: 'equipment-a', width: 10, height: 10, length: 10, weight: 2 },
      ],
    }
    const option = {
      id: 1,
      name: 'Local',
      company: { name: 'Carrier' },
      price: '12.50',
      delivery_time: '4',
    }
    const unavailable = {
      success: false,
      configured: false,
      error: 'Configure uma integração Merchant isolada por locadora',
      code: 'TENANT_MERCHANT_ADAPTER_UNAVAILABLE',
    }
    const merchant = [
      ['GET', status],
      ['POST', sync],
      ['POST product', product],
      ['DELETE', remove],
    ] as const
    function request(
      body: unknown = input,
      headers: Record<string, string> = {},
      method = 'POST'
    ) {
      return new NextRequest(
        'https://api.test/api/integrations/melhor-envio/calculate',
        {
          method,
          headers,
          ...(method !== 'GET'
            ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
            : {}),
        }
      )
    }
    beforeEach(() => {
      vi.resetAllMocks()
      vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://api.test')
      vi.stubGlobal('fetch', state.fetch)
      state.principal.mockResolvedValue({ ok: true, principal })
      state.transaction.mockImplementation(async (_scope, operation) =>
        operation(state.tx)
      )
      state.tx.tenantIntegration.findMany.mockResolvedValue([
        { credentialsRef: 'env:LOCADORA_INTEGRATION_LOCAL' },
      ])
      state.tx.organization.findUnique.mockResolvedValue({
        postalCode: '01001-000',
      })
      state.tx.equipment.count.mockResolvedValue(1)
      state.credential.mockResolvedValue(credential)
      state.fetch.mockImplementation(async () => Response.json([option]))
    })
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    })
    describe('shipping and Merchant legacy characterization', () => {
      it.each([401, 403, 409])(
        'preserves guard refusal %s before JSON, SQL or provider',
        async (code) => {
          const denied = Response.json({ error: 'Denied' }, { status: code })
          state.principal.mockResolvedValue({ ok: false, response: denied })
          expect(await shipping(request('{'))).toBe(denied)
          for (const [method, handler] of merchant)
            expect(
              await handler(request('{', {}, method === 'GET' ? 'GET' : 'POST'))
            ).toBe(denied)
          expect(state.transaction).not.toHaveBeenCalled()
          expect(state.fetch).not.toHaveBeenCalled()
        }
      )
      it.each(['CLIENT', 'OPERATOR', 'FINANCIAL', 'ADMIN'])(
        'shipping accepts active %s principal',
        async (role) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role },
          })
          expect((await shipping(request())).status).toBe(200)
        }
      )
      it.each(['null', 'https://bravo.test'])(
        'blocks cross origin %s before parsing and provider',
        async (Origin) => {
          expect((await shipping(request('{', { Origin }))).status).toBe(403)
          expect(state.transaction).not.toHaveBeenCalled()
          expect(state.fetch).not.toHaveBeenCalled()
        }
      )
      it('preserves same-origin and native requests', async () => {
        expect(
          (await shipping(request(input, { Origin: 'https://api.test' })))
            .status
        ).toBe(200)
        expect((await shipping(request())).status).toBe(200)
      })
      it.each([
        ['root extra', { ...input, tenantId: 'foreign' }],
        ['short postal', { ...input, to: { postal_code: '123' } }],
        ['no products', { ...input, products: [] }],
        [
          'too many',
          {
            ...input,
            products: Array.from({ length: 101 }, () => input.products[0]),
          },
        ],
        ...Object.entries({
          id: '',
          width: 0,
          height: 5001,
          length: -1,
          weight: 100001,
          quantity: 0,
          insurance_value: -1,
        }).map(
          ([key, value]) =>
            [
              key,
              { ...input, products: [{ ...input.products[0], [key]: value }] },
            ] as const
        ),
        [
          'fractional quantity',
          { ...input, products: [{ ...input.products[0], quantity: 1.5 }] },
        ],
        [
          'too many quantity',
          { ...input, products: [{ ...input.products[0], quantity: 10001 }] },
        ],
      ] as const)(
        'invalid %s returns old 400 before tenant transaction',
        async (_name, data) => {
          const response = await shipping(request(data))
          expect(response.status).toBe(400)
          expect(await response.json()).toEqual({
            error: 'Dados de frete inválidos',
          })
          expect(state.transaction).not.toHaveBeenCalled()
        }
      )
      it('normalizes postal codes, defaults quantity, strips nested extras and deduplicates only SQL ids', async () => {
        const data = {
          ...input,
          from: { ...input.from, url: 'https://foreign.test' },
          products: [
            { ...input.products[0], tenantId: 'foreign' },
            { ...input.products[0], quantity: 3, insurance_value: 0 },
          ],
        }
        const response = await shipping(request(data))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          shippingOptions: [
            {
              id: 1,
              name: 'Local',
              company: 'Carrier',
              price: 12.5,
              deliveryTime: '4 dias úteis',
              estimatedDays: 4,
            },
          ],
          chargeableWeight: 8,
        })
        expect(state.transaction.mock.calls[0]![0]).toEqual(principal)
        expect(state.tx.tenantIntegration.findMany).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-a',
            provider: 'MELHOR_ENVIO',
            status: 'ACTIVE',
            organization: { status: 'ACTIVE' },
          },
          take: 2,
        })
        expect(state.tx.organization.findUnique).toHaveBeenCalledWith({
          where: { id: 'tenant-a' },
          select: { postalCode: true },
        })
        expect(state.tx.equipment.count).toHaveBeenCalledWith({
          where: { tenantId: 'tenant-a', id: { in: ['equipment-a'] } },
        })
        const [url, init] = state.fetch.mock.calls[0]!
        expect(url).toBe(
          'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate'
        )
        expect(init).toMatchObject({
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: 'Bearer local-key',
            'User-Agent': credential.userAgent,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        })
        expect(init.signal).toBeInstanceOf(AbortSignal)
        expect(JSON.parse(init.body)).toEqual({
          from: { postal_code: '01001000' },
          to: { postal_code: '02002000' },
          products: [
            { ...input.products[0], quantity: 1 },
            { ...input.products[0], quantity: 3, insurance_value: 0 },
          ],
        })
        expect(state.credential).toHaveBeenCalledWith(
          'env:LOCADORA_INTEGRATION_LOCAL'
        )
      })
      it('uses volumetric maximum, zero custom overrides and fixed production host', async () => {
        state.credential.mockResolvedValue({
          ...credential,
          environment: 'production',
        })
        state.fetch.mockResolvedValue(
          Response.json([
            { ...option, custom_price: '0', custom_delivery_time: '0' },
          ])
        )
        const response = await shipping(
          request({
            ...input,
            products: [{ ...input.products[0], length: 100, quantity: 3 }],
          })
        )
        expect(await response.json()).toEqual({
          shippingOptions: [
            {
              id: 1,
              name: 'Local',
              company: 'Carrier',
              price: 0,
              deliveryTime: '0 dias úteis',
              estimatedDays: 0,
            },
          ],
          chargeableWeight: 30,
        })
        expect(state.fetch.mock.calls[0]![0]).toBe(
          'https://melhorenvio.com.br/api/v2/me/shipment/calculate'
        )
        const timeout = vi.spyOn(AbortSignal, 'timeout')
        state.fetch.mockImplementation(async () => Response.json([]))
        await shipping(request())
        expect(timeout).toHaveBeenCalledWith(12000)
        timeout.mockRestore()
      })
      it('rejects foreign equipment before missing config or credential access', async () => {
        state.tx.equipment.count.mockResolvedValue(0)
        state.tx.tenantIntegration.findMany.mockResolvedValue([])
        const response = await shipping(request())
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(state.credential).not.toHaveBeenCalled()
      })
      it.each([
        { integrations: [] },
        { integrations: [{ credentialsRef: 'a' }, { credentialsRef: 'b' }] },
      ])(
        'requires exactly one active integration (%j)',
        async ({ integrations }) => {
          state.tx.tenantIntegration.findMany.mockResolvedValue(integrations)
          const response = await shipping(request())
          expect(response.status).toBe(503)
          expect(await response.json()).toEqual({
            error: 'Frete da locadora não configurado',
          })
          expect(state.credential).not.toHaveBeenCalled()
        }
      )
      it.each([null, { postalCode: null }, { postalCode: '---' }])(
        'requires organization postal code (%j)',
        async (row) => {
          state.tx.organization.findUnique.mockResolvedValue(row)
          expect((await shipping(request())).status).toBe(503)
          expect(state.credential).not.toHaveBeenCalled()
        }
      )
      it('rejects diverging origin before credential resolution', async () => {
        const response = await shipping(
          request({ ...input, from: { postal_code: '99999999' } })
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'CEP de origem diverge da locadora',
        })
        expect(state.credential).not.toHaveBeenCalled()
      })
      it.each([
        null,
        { ...credential, apiKey: '' },
        { ...credential, environment: 'other' },
        { ...credential, userAgent: '' },
        { ...credential, userAgent: 'bad\r\nHeader' },
        { ...credential, userAgent: 'Fixture (no-email)' },
      ])('rejects unusable tenant credential (%j)', async (value) => {
        vi.stubEnv('MELHOR_ENVIO_TOKEN', 'global-must-not-be-used')
        state.credential.mockResolvedValue(value)
        const response = await shipping(request())
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({
          error: 'Credenciais de frete da locadora indisponíveis',
        })
        expect(state.fetch).not.toHaveBeenCalled()
      })
      it.each([
        { ...option, price: '-1' },
        { ...option, price: '1,00' },
        { ...option, delivery_time: 1.5 },
        { ...option, custom_price: -1 },
        { ...option, custom_delivery_time: '1.5' },
        { ...option, company: null },
        {},
      ])(
        'drops invalid provider option (%j) without discarding valid peers',
        async (bad) => {
          state.fetch.mockResolvedValue(Response.json([bad, option]))
          const response = await shipping(request())
          expect(response.status).toBe(200)
          expect((await response.json()).shippingOptions).toHaveLength(1)
        }
      )
      it('accepts empty valid options rather than inventing a quote', async () => {
        state.fetch.mockResolvedValue(
          Response.json([{ error: 'local rejection' }])
        )
        expect(await (await shipping(request())).json()).toEqual({
          shippingOptions: [],
          chargeableWeight: 2,
        })
      })
      it.each([400, 401, 429, 500])(
        'sanitizes upstream HTTP %s',
        async (code) => {
          state.fetch.mockResolvedValue(
            Response.json({ secret: 'provider-secret' }, { status: code })
          )
          const response = await shipping(request())
          expect(response.status).toBe(502)
          expect(await response.json()).toEqual({
            error: 'Cotação indisponível no provedor',
          })
        }
      )
      it('rejects non-array provider response', async () => {
        state.fetch.mockResolvedValue(Response.json({ options: [] }))
        const response = await shipping(request())
        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
          error: 'Resposta de frete inválida',
        })
      })
      it.each([
        'guard',
        'transaction',
        'credential',
        'fetch',
        'provider-json',
        'body-json',
      ])('unexpected %s preserves generic 502', async (boundary) => {
        if (boundary === 'guard')
          state.principal.mockRejectedValue(new Error('internal'))
        if (boundary === 'transaction')
          state.transaction.mockRejectedValue(new Error('internal'))
        if (boundary === 'credential')
          state.credential.mockRejectedValue(new Error('internal'))
        if (boundary === 'fetch')
          state.fetch.mockRejectedValue(new Error('internal'))
        if (boundary === 'provider-json')
          state.fetch.mockResolvedValue(new Response('{'))
        const response = await shipping(
          request(boundary === 'body-json' ? '{' : input)
        )
        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({
          error: 'Não foi possível consultar o frete',
        })
      })
      it.each(merchant)(
        '%s Merchant preserves unavailable response without body or provider access',
        async (_method, handler) => {
          vi.stubEnv('GOOGLE_MERCHANT_ID', 'global-unused')
          const req = request('{')
          const json = vi.spyOn(req, 'json')
          const response = await handler(req)
          expect(response.status).toBe(503)
          expect(await response.json()).toEqual(unavailable)
          expect(json).not.toHaveBeenCalled()
          expect(state.transaction).not.toHaveBeenCalled()
          expect(state.fetch).not.toHaveBeenCalled()
        }
      )
      it.each(['CLIENT', 'OPERATOR', 'FINANCIAL'])(
        'all four Merchant methods reject %s before body',
        async (role) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role },
          })
          for (const [, handler] of merchant) {
            const response = await handler(request('{'))
            expect(response.status).toBe(403)
            expect(await response.json()).toEqual({ error: 'Forbidden' })
          }
        }
      )
    })
  }
)
