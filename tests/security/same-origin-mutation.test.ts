const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return { prisma: {} }
}
/**
 * Achado 2 da revisão (CSRF entre locadoras irmãs): todos os subdomínios da
 * raiz são o mesmo site, então o cookie de sessão de `alfa.<raiz>` acompanha
 * um `fetch` com `credentials: 'include'` disparado por script de
 * `bravo.<raiz>` (um POST `text/plain` nem passa por preflight). Com borda
 * validada, toda mutação autenticada por cookie liberada no host de locadora
 * só pode vir da origem EXATA do host.
 *
 * Sem banco: o principal e os serviços são dublês que registram cada efeito;
 * a borda e o guard são os reais. A prova com linhas reais no banco fica em
 * `same-origin-mutation.integration.test.ts`.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ effects: [] as string[] }))
const effect = (name: string) => () => {
  state.effects.push(name)
  return Response.json({ ok: true })
}

import {
  isSameOriginMutation,
  rejectCrossOriginMutation,
} from '@gb-locacoes/backend/identity'
import { isTrustedMutationOrigin } from '../../apps/services/api/src/host/mutation-origin'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma: {} }),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/private-identity')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: async () => ({
        ok: true,
        principal: {
          userId: 'client-alfa',
          tenantId: 'tenant-alfa',
          membershipId: 'member-alfa',
          role: 'CLIENT',
        },
      }),
      withTenantTransaction: async () => effect('tenant transaction')(),
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
      resolveTenantPrincipal: async () => ({
        ok: true,
        principal: {
          userId: 'client-alfa',
          tenantId: 'tenant-alfa',
          membershipId: 'member-alfa',
          role: 'CLIENT',
        },
      }),
      withTenantTransaction: async () => effect('tenant transaction')(),
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
      resolveIntegrationCredential: async () =>
        effect('integration credential')(),
    }))()),
  })
)
// Os serviços do host da API, com os mesmos efeitos registrados que as fachadas da raiz acima.
vi.mock(
  '../../apps/services/api/src/host/customers',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/customers')
    >()),
    readCustomerCart: async () => null,
    writeCustomerCart: async () => effect('cart write')(),
    listAddresses: async () => [],
    createAddress: async () => effect('address create')(),
    updateAddress: async () => effect('address update')(),
    deleteAddress: async () => effect('address delete')(),
    // O perfil do serviço abre a transação da locadora direto no backend: o efeito é registrado na mesma fronteira.
    updateCustomerProfile: async () => effect('tenant transaction')(),
  })
)
vi.mock('../../apps/services/api/src/host/rentals', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/rentals')
  >()),
  extendRental: async () => effect('rental extend')(),
}))
vi.mock('../../apps/services/api/src/host/portal', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/portal')
  >()),
  readClientRental: async () => null,
  hideClientRental: async () => Boolean(effect('rental hide')()),
  requestClientRentalAction: async () => effect('rental request')(),
  readClientQuote: async () => null,
  hideClientQuote: async () => Boolean(effect('quote hide')()),
}))
vi.mock(
  '../../apps/services/api/src/host/contracts',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/contracts')
    >()),
    requestContractSignature: async () => effect('contract signature')(),
  })
)
vi.mock(
  '../../apps/services/api/src/host/webhook-authentication',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/webhook-authentication')
    >()),
    resolveIntegrationCredential: async () =>
      effect('integration credential')(),
  })
)

import * as serviceRoute0 from '../../apps/services/api/src/app/api/cart/sync/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/cart/merge/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/addresses/route'

import * as serviceRoute3 from '../../apps/services/api/src/app/api/addresses/[id]/route'

import * as serviceRoute4 from '../../apps/services/api/src/app/api/client/notifications/[id]/route'

import * as serviceRoute5 from '../../apps/services/api/src/app/api/client/notifications/mark-all-read/route'

import * as serviceRoute6 from '../../apps/services/api/src/app/api/client/rentals/[id]/extend/route'

import * as serviceRoute7 from '../../apps/services/api/src/app/api/client/rentals/[id]/request-extension/route'

import * as serviceRoute8 from '../../apps/services/api/src/app/api/client/rentals/[id]/request-pickup/route'

import * as serviceRoute9 from '../../apps/services/api/src/app/api/client/rentals/[id]/route'

import * as serviceRoute10 from '../../apps/services/api/src/app/api/user/profile/route'

import * as serviceRoute11 from '../../apps/services/api/src/app/api/contracts/sign/route'

import * as serviceRoute12 from '../../apps/services/api/src/app/api/quotes/[id]/route'

import * as serviceRoute13 from '../../apps/services/api/src/app/api/integrations/melhor-envio/calculate/route'

const HOSTS = [
  [
    'service',
    {
      cartSync: serviceRoute0.POST,
      cartMerge: serviceRoute1.POST,
      createAddress: serviceRoute2.POST,
      updateAddress: serviceRoute3.PATCH,
      deleteAddress: serviceRoute3.DELETE,
      readNotification: serviceRoute4.PATCH,
      deleteNotification: serviceRoute4.DELETE,
      markAllRead: serviceRoute5.POST,
      extendRental: serviceRoute6.POST,
      requestExtension: serviceRoute7.POST,
      requestPickup: serviceRoute8.POST,
      hideRental: serviceRoute9.DELETE,
      updateProfile: serviceRoute10.PUT,
      signContract: serviceRoute11.POST,
      hideQuote: serviceRoute12.DELETE,
      freight: serviceRoute13.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      cartSync,
      cartMerge,
      createAddress,
      updateAddress,
      deleteAddress,
      readNotification,
      deleteNotification,
      markAllRead,
      extendRental,
      requestExtension,
      requestPickup,
      hideRental,
      updateProfile,
      signContract,
      hideQuote,
      freight,
    }
  ) => {
    const SECRET = 'edge-secret-same-origin-0123456789ab'
    const ROOT = 'plataforma.test'
    const API = 'https://backend.internal'
    const originOf = (slug: string) => `https://${slug}.${ROOT}`
    const tenantEdge = (slug: string, secret = SECRET) => ({
      'x-platform-edge-auth': secret,
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': slug,
      'x-platform-origin': originOf(slug),
    })
    const appEdge = {
      'x-platform-edge-auth': SECRET,
      'x-platform-host-kind': 'app',
      'x-platform-origin': `https://app.${ROOT}`,
    }

    type Headers = Record<string, string>
    const request = (method: string, headers: Headers = {}, body?: unknown) =>
      new NextRequest(API + '/api/x', {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    const params = (id = 'row-alfa') => ({ params: Promise.resolve({ id }) })

    beforeEach(() => {
      vi.stubEnv('PLATFORM_ENV', 'staging')
      vi.stubEnv('VERCEL_ENV', '')
      vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
      vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
      vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
      state.effects.length = 0
    })
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    describe('rejectCrossOriginMutation (guard compartilhado da identidade)', () => {
      const on = (method: string, headers: Headers) =>
        isSameOriginMutation(new Request(API + '/api/x', { method, headers }))

      it('on a tenant host a mutation must come from the exact host origin', () => {
        const host = tenantEdge('alfa')
        expect(on('POST', { ...host, origin: originOf('alfa') })).toBe(true)
        expect(
          on('POST', {
            ...host,
            origin: originOf('alfa'),
            'sec-fetch-site': 'same-origin',
          })
        ).toBe(true)
        // Navegação direta (barra de endereço, favorito) e clientes sem navegador.
        expect(on('POST', { ...host, 'sec-fetch-site': 'none' })).toBe(true)
        expect(on('POST', host)).toBe(true)
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
          for (const headers of [
            { origin: originOf('bravo') },
            { origin: `https://app.${ROOT}` },
            { origin: `https://${ROOT}` },
            { origin: `http://alfa.${ROOT}` },
            { origin: `https://alfa.${ROOT}:8443` },
            { origin: 'null' },
            { origin: originOf('alfa'), 'sec-fetch-site': 'same-site' },
            { origin: originOf('alfa'), 'sec-fetch-site': 'cross-site' },
            { 'sec-fetch-site': 'same-site' },
          ])
            expect(on(method, { ...host, ...headers })).toBe(false)
      })

      it('safe methods are never refused', () => {
        for (const method of ['GET', 'HEAD', 'OPTIONS'])
          expect(
            on(method, {
              ...tenantEdge('alfa'),
              origin: originOf('bravo'),
              'sec-fetch-site': 'same-site',
            })
          ).toBe(true)
      })

      it('the app host expects its own origin, never a tenant one', () => {
        expect(on('POST', { ...appEdge, origin: `https://app.${ROOT}` })).toBe(
          true
        )
        expect(on('POST', { ...appEdge, origin: originOf('alfa') })).toBe(false)
      })

      it('without a validated edge and without browser headers (mobile, server to server) nothing changes', () => {
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
          expect(on(method, {})).toBe(true)
          expect(on(method, { 'content-type': 'text/plain' })).toBe(true)
          const forged = tenantEdge(
            'alfa',
            'forged-secret-0123456789abcdefghijkl'
          )
          expect(on(method, forged)).toBe(true)
        }
      })

      it('without a validated edge a browser mutation must come from the configured public origin (WEB_PUBLIC_ORIGIN)', () => {
        const legacy = 'https://legado.example.test'
        vi.stubEnv('WEB_PUBLIC_ORIGIN', legacy)
        const forged = tenantEdge(
          'alfa',
          'forged-secret-0123456789abcdefghijkl'
        )
        expect(on('POST', { origin: legacy })).toBe(true)
        expect(
          on('POST', { origin: legacy, 'sec-fetch-site': 'same-origin' })
        ).toBe(true)
        expect(on('POST', { 'sec-fetch-site': 'none' })).toBe(true)
        for (const headers of [
          { origin: originOf('bravo') },
          { ...forged, origin: originOf('bravo') },
          { ...forged, origin: originOf('alfa') },
          { origin: API },
          { origin: 'null' },
          { origin: legacy, 'sec-fetch-site': 'same-site' },
          { 'sec-fetch-site': 'cross-site' },
        ])
          expect(on('POST', headers), JSON.stringify(headers)).toBe(false)
      })

      it('without a validated edge nor WEB_PUBLIC_ORIGIN, the request own origin; an invalid configured origin refuses browsers only', () => {
        vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
        expect(on('POST', { origin: API })).toBe(true)
        expect(on('POST', { origin: originOf('bravo') })).toBe(false)
        expect(on('DELETE', { 'sec-fetch-site': 'same-site' })).toBe(false)
        for (const invalid of [
          'https://legado.example.test/painel',
          'https://*.example.test',
          'https://user:secret@legado.example.test',
          'javascript:alert(1)',
          'not an origin',
        ]) {
          vi.stubEnv('WEB_PUBLIC_ORIGIN', invalid)
          expect(on('POST', { origin: API }), invalid).toBe(false)
          expect(on('POST', { 'sec-fetch-site': 'same-origin' }), invalid).toBe(
            false
          )
          // Sem navegador não há cookie de outro site: segue como antes.
          expect(on('POST', {}), invalid).toBe(true)
        }
      })

      it('header-only callers (next/headers, method and URL unknown): Origin marks a possible mutation', () => {
        const headersOnly = (headers: Headers) =>
          isSameOriginMutation({
            method: null,
            url: null,
            headers: new Headers(headers),
          })
        const app = `https://app.${ROOT}`
        // Com borda: a origem da borda.
        expect(headersOnly({ ...appEdge, origin: app })).toBe(true)
        expect(headersOnly({ ...appEdge, origin: originOf('alfa') })).toBe(
          false
        )
        expect(
          headersOnly({
            ...appEdge,
            origin: app,
            'sec-fetch-site': 'same-site',
          })
        ).toBe(false)
        // Sem Origin o navegador só pode ter enviado GET/HEAD (Fetch): navegação
        // de outro site (callback OAuth, link de e-mail) segue.
        expect(
          headersOnly({ ...appEdge, 'sec-fetch-site': 'cross-site' })
        ).toBe(true)
        expect(headersOnly(appEdge)).toBe(true)
        // Sem borda nem WEB_PUBLIC_ORIGIN: o authority do Host.
        vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
        const host = { host: 'painel.example.test' }
        expect(
          headersOnly({ ...host, origin: 'https://painel.example.test' })
        ).toBe(true)
        expect(
          headersOnly({ ...host, origin: 'https://outro.example.test' })
        ).toBe(false)
        expect(
          headersOnly({ ...host, origin: 'https://painel.example.test:8443' })
        ).toBe(false)
        expect(headersOnly({ origin: 'https://painel.example.test' })).toBe(
          false
        )
        vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://painel.example.test')
        expect(headersOnly({ origin: 'https://painel.example.test' })).toBe(
          true
        )
      })

      it('still applies on a production backend without WEB_API_ORIGIN (achados 1 e 24)', () => {
        vi.stubEnv('PLATFORM_ENV', 'production')
        vi.stubEnv('WEB_API_ORIGIN', '')
        expect(
          on('POST', { ...tenantEdge('alfa'), origin: originOf('alfa') })
        ).toBe(true)
        expect(
          on('POST', { ...tenantEdge('alfa'), origin: originOf('bravo') })
        ).toBe(false)
      })

      it('isTrustedMutationOrigin is the same rule (it delegates to the guard)', () => {
        const forged = tenantEdge(
          'alfa',
          'forged-secret-0123456789abcdefghijkl'
        )
        const edges = [{}, tenantEdge('alfa'), appEdge, forged]
        const browser: Headers[] = [
          {},
          { origin: originOf('alfa') },
          { origin: originOf('bravo') },
          { origin: `https://app.${ROOT}` },
          { origin: API },
          { origin: 'https://legado.example.test' },
          { origin: 'null' },
          { 'sec-fetch-site': 'same-origin' },
          { 'sec-fetch-site': 'same-site' },
          { origin: originOf('alfa'), 'sec-fetch-site': 'cross-site' },
        ]
        const configured = [
          '',
          'https://legado.example.test',
          'https://legado.example.test/painel',
        ]
        let compared = 0
        for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
          for (const edge of edges)
            for (const headers of browser)
              for (const origin of configured) {
                vi.stubEnv('WEB_PUBLIC_ORIGIN', origin)
                const request = new Request(API + '/api/x', {
                  method,
                  headers: { ...edge, ...headers },
                })
                expect(
                  isTrustedMutationOrigin(request),
                  `${method} ${JSON.stringify({ ...edge, ...headers })} ${origin}`
                ).toBe(isSameOriginMutation(request))
                compared++
              }
        expect(compared).toBe(6 * 4 * 10 * 3)
      })

      it('answers a neutral 403 that is never cached', async () => {
        const refused = rejectCrossOriginMutation(
          new Request(API + '/api/x', {
            method: 'POST',
            headers: { ...tenantEdge('alfa'), origin: originOf('bravo') },
          })
        )
        expect(refused?.status).toBe(403)
        expect(refused?.headers.get('cache-control')).toBe('no-store')
        expect(await refused?.json()).toEqual({ error: 'Origem não permitida' })
        expect(
          rejectCrossOriginMutation(
            new Request(API + '/api/x', {
              method: 'POST',
              headers: { ...tenantEdge('alfa'), origin: originOf('alfa') },
            })
          )
        ).toBeNull()
      })
    })

    /** Toda mutação autenticada por cookie liberada no host de locadora (TENANT_API_ALLOWLIST). */
    const MUTATIONS: Array<
      [string, (_headers: Headers) => Promise<Response>, string]
    > = [
      [
        'POST /api/cart/sync',
        (h) => cartSync(request('POST', h, { items: [] })),
        'cart write',
      ],
      [
        'POST /api/cart/merge',
        (h) => cartMerge(request('POST', h, { localCartItems: [] })),
        'cart write',
      ],
      [
        'POST /api/addresses',
        (h) =>
          createAddress(
            request('POST', h, {
              street: 'Rua A',
              number: '1',
              neighborhood: 'Centro',
              city: 'Curitiba',
              state: 'PR',
              zipCode: '80000-000',
            })
          ),
        'address create',
      ],
      [
        'PATCH /api/addresses/[id]',
        (h) =>
          updateAddress(request('PATCH', h, { city: 'Curitiba' }), params()),
        'address update',
      ],
      [
        'DELETE /api/addresses/[id]',
        (h) => deleteAddress(request('DELETE', h), params()),
        'address delete',
      ],
      [
        'PATCH /api/client/notifications/[id]',
        (h) => readNotification(request('PATCH', h), params()),
        'tenant transaction',
      ],
      [
        'DELETE /api/client/notifications/[id]',
        (h) => deleteNotification(request('DELETE', h), params()),
        'tenant transaction',
      ],
      [
        'POST /api/client/notifications/mark-all-read',
        (h) => markAllRead(request('POST', h)),
        'tenant transaction',
      ],
      [
        'POST /api/client/rentals/[id]/extend',
        (h) => extendRental(request('POST', h, { extensionDays: 2 }), params()),
        'rental extend',
      ],
      [
        'POST /api/client/rentals/[id]/request-extension',
        (h) =>
          requestExtension(request('POST', h, { additionalDays: 2 }), params()),
        'rental request',
      ],
      [
        'POST /api/client/rentals/[id]/request-pickup',
        (h) => requestPickup(request('POST', h), params()),
        'rental request',
      ],
      [
        'DELETE /api/client/rentals/[id]',
        (h) => hideRental(request('DELETE', h), params()),
        'rental hide',
      ],
      [
        'PUT /api/user/profile',
        (h) => updateProfile(request('PUT', h, { phone: '41999999999' })),
        'tenant transaction',
      ],
      [
        'POST /api/contracts/sign',
        (h) =>
          signContract(request('POST', h, { contractId: 'contract-alfa' })),
        'contract signature',
      ],
      [
        'DELETE /api/quotes/[id]',
        (h) => hideQuote(request('DELETE', h), params()),
        'quote hide',
      ],
      [
        'POST /api/integrations/melhor-envio/calculate',
        (h) =>
          freight(
            request('POST', h, {
              from: { postal_code: '80000-000' },
              to: { postal_code: '01001-000' },
              products: [
                { id: 'eq-alfa', width: 10, height: 10, length: 10, weight: 1 },
              ],
            })
          ),
        'tenant transaction',
      ],
    ]

    describe('cookie mutations allowed on a tenant host refuse a sibling tenant origin', () => {
      it.each(MUTATIONS)(
        '%s: a script on bravo cannot act as the client of alfa',
        async (_name, call) => {
          for (const headers of [
            // fetch('https://alfa.<raiz>/...', { credentials: 'include' }) em bravo
            {
              ...tenantEdge('alfa'),
              origin: originOf('bravo'),
              'sec-fetch-site': 'same-site',
              'content-type': 'text/plain;charset=UTF-8',
            },
            { ...tenantEdge('alfa'), origin: originOf('bravo') },
            { ...tenantEdge('alfa'), 'sec-fetch-site': 'same-site' },
            { ...tenantEdge('alfa'), origin: `https://app.${ROOT}` },
          ]) {
            const response = await call(headers)
            expect(response.status).toBe(403)
            expect(response.headers.get('cache-control')).toBe('no-store')
            expect(await response.json()).toEqual({
              error: 'Origem não permitida',
            })
          }
          expect(state.effects).toEqual([])
        }
      )

      it.each(MUTATIONS)(
        '%s: the same request from the host origin still runs (positive control)',
        async (_name, call, expected) => {
          const response = await call({
            ...tenantEdge('alfa'),
            origin: originOf('alfa'),
            'sec-fetch-site': 'same-origin',
            'content-type': 'application/json',
          })
          expect(response.status).not.toBe(403)
          expect(state.effects).toContain(expected)
        }
      )

      it.each(MUTATIONS)(
        '%s: without an edge and without browser headers (mobile) it still runs',
        async (_name, call, expected) => {
          const response = await call({ 'content-type': 'application/json' })
          expect(response.status).not.toBe(403)
          expect(state.effects).toContain(expected)
        }
      )
    })
  }
)
