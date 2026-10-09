/**
 * Achado 149 (onda 133): leituras de conta fora do principal privado recusam `Origin` explícito de outra origem em
 * GET/HEAD, como as leituras privadas da onda 132 (`rejectExplicitCrossOrigin`), nas rotas REAIS dos dois hosts.
 *
 * Consumidores caracterizados antes da recusa (nenhum de outra origem):
 * - `/api/auth/organizations` e `/selection` (GET): o seletor do painel no host `app` (mesma origem, GET sem
 *   `Origin`) e o app nativo (sem `Origin`); no host de locadora o proxy já nega as duas (`TENANT_API_DENYLIST`);
 * - `/api/auth/organizations/current`: a área do cliente e a tela de vínculo no próprio host da locadora;
 * - `/api/auth/owner-account` e `/api/onboarding/slug-availability`: o cadastro no host `app`; já recusavam por
 *   `onboardingAppOrigin` (403 `ORIGIN_NOT_ALLOWED`) e ficam provados aqui.
 *
 * Sem `Origin` (navegação de topo, app nativo, servidor-servidor) a leitura segue; as recusas anteriores (409/404 de
 * host, 401 sem sessão) mantêm ordem e envelope; nenhum dado é lido com a origem recusada.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  organization: vi.fn(),
  transaction: vi.fn(),
  sql: vi.fn(),
  membershipUnique: vi.fn(),
  memberships: vi.fn(),
  membership: vi.fn(),
  user: vi.fn(),
}))
const database = vi.hoisted(() => ({
  organization: { findUnique: state.organization },
  membership: { findMany: state.memberships, findFirst: state.membership },
  user: { findUnique: state.user },
  $transaction: state.transaction,
}))
vi.mock('@/lib/application-session', () => ({
  getServerSession: state.session,
}))
vi.mock('@/lib/prisma', () => ({ prisma: database }))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
  getIdentity: vi.fn(),
  handleIdentityRequest: vi.fn(),
  findAccountsByEmail: vi.fn(),
  consumeAccountNotice: vi.fn(),
  resetAuthAccountAttempts: vi.fn(),
  refuseAuthAttempt: vi.fn(),
}))
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: database }),
  createResendClient: () => null,
}))

import { GET as legacyList } from '@/app/api/auth/organizations/route'
import { GET as serviceList } from '../../apps/services/api/src/app/api/auth/organizations/route'
import { GET as legacyCurrent } from '@/app/api/auth/organizations/current/route'
import { GET as serviceCurrent } from '../../apps/services/api/src/app/api/auth/organizations/current/route'
import {
  GET as legacySelection,
  POST as legacySelect,
} from '@/app/api/auth/organizations/selection/route'
import {
  GET as serviceSelection,
  POST as serviceSelect,
} from '../../apps/services/api/src/app/api/auth/organizations/selection/route'
import { GET as legacyOwner } from '@/app/api/auth/owner-account/route'
import { GET as serviceOwner } from '../../apps/services/api/src/app/api/auth/owner-account/route'
import { GET as legacySlug } from '@/app/api/onboarding/slug-availability/route'
import { GET as serviceSlug } from '../../apps/services/api/src/app/api/onboarding/slug-availability/route'

const SECRET = 'account-read-origin-edge-secret-0123456789'
const ROOT = 'platform.test'
const APP = `https://app.${ROOT}`
const ALFA = `https://alfa.${ROOT}`
const BRAVO = `https://bravo.${ROOT}`
const BACKEND = 'https://backend.example.test'
const DENIAL = { error: 'Origem não permitida' }

const appEdge = {
  'x-platform-edge-auth': SECRET,
  'x-platform-host-kind': 'app',
  'x-platform-origin': APP,
}
const tenantEdge = {
  'x-platform-edge-auth': SECRET,
  'x-platform-host-kind': 'tenant',
  'x-platform-origin': ALFA,
  'x-platform-tenant-slug': 'alfa',
}
const tenant = {
  id: 'fixture-alfa',
  slug: 'alfa',
  name: 'Alfa',
  status: 'ACTIVE',
}
const row = {
  id: 'fixture-membership',
  role: 'CLIENT',
  status: 'ACTIVE',
  tenantId: tenant.id,
  userId: 'fixture-user',
  organization: tenant,
}

/** Origens explícitas que nenhum consumidor legítimo envia numa leitura do host `app`. */
const FOREIGN_ON_APP: readonly (readonly [string, Record<string, string>])[] = [
  ['sibling tenant', { Origin: BRAVO, 'Sec-Fetch-Site': 'same-site' }],
  ['tenant origin on the panel', { Origin: ALFA }],
  ['opaque origin', { Origin: 'null' }],
  [
    'other site',
    { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
  ],
  [
    'own origin with a same-site fetch',
    { Origin: APP, 'Sec-Fetch-Site': 'same-site' },
  ],
]
/** Origens explícitas recusadas no host da locadora `alfa`. */
const FOREIGN_ON_TENANT: readonly (readonly [
  string,
  Record<string, string>,
])[] = [
  ['sibling tenant', { Origin: BRAVO, 'Sec-Fetch-Site': 'same-site' }],
  [
    'panel origin on the tenant host',
    { Origin: APP, 'Sec-Fetch-Site': 'same-site' },
  ],
  ['opaque origin', { Origin: 'null' }],
  [
    'other site',
    { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
  ],
]
/** O que os consumidores reais enviam: GET sem `Origin` (mesma origem, app nativo, navegação) ou a própria origem. */
const ALLOWED = (own: string) =>
  [
    ['no Origin', {}],
    ['no Origin on a top-level navigation', { 'Sec-Fetch-Site': 'cross-site' }],
    ['own origin', { Origin: own, 'Sec-Fetch-Site': 'same-origin' }],
  ] as const

const request = (
  path: string,
  headers: Record<string, string>,
  method = 'GET'
) => new Request(`${BACKEND}${path}`, { method, headers })

const assertDenial = async (response: Response) => {
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual(DENIAL)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('set-cookie')).toBeNull()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
  vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_API_ORIGIN', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  vi.stubEnv('PLATFORM_SELF_SERVICE_SIGNUP', 'off')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  state.session.mockResolvedValue({ user: { id: row.userId, role: 'ADMIN' } })
  state.organization.mockResolvedValue({
    id: tenant.id,
    status: 'ACTIVE',
    ...LIVE_SITE,
  })
  state.membershipUnique.mockResolvedValue(row)
  state.sql.mockResolvedValue([])
  state.transaction.mockImplementation(async (operation) =>
    operation({
      membership: { findUnique: state.membershipUnique },
      $queryRaw: state.sql,
    })
  )
  state.memberships.mockResolvedValue([
    { id: row.id, role: row.role, organization: tenant },
  ])
  state.membership.mockResolvedValue({
    id: row.id,
    role: row.role,
    organization: tenant,
  })
  state.user.mockResolvedValue({
    id: row.userId,
    email: 'owner@example.test',
    authEmailVerified: true,
  })
})
afterAll(() => vi.unstubAllEnvs())

describe.each([
  ['legacy', legacyList],
  ['service', serviceList],
] as const)('%s GET /api/auth/organizations', (_host, GET) => {
  const path = '/api/auth/organizations'
  it.each(FOREIGN_ON_APP)(
    'refuses %s after the session and before listing the memberships',
    async (_name, origin) => {
      for (const method of ['GET', 'HEAD'])
        await assertDenial(
          await GET(request(path, { ...appEdge, ...origin }, method))
        )
      expect(state.session).toHaveBeenCalledTimes(2)
      expect(state.memberships).not.toHaveBeenCalled()
    }
  )
  it('refuses a sibling Origin without the platform edge (configured public origin)', async () => {
    vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://legacy.example.test')
    await assertDenial(await GET(request(path, { Origin: BRAVO })))
    expect(state.memberships).not.toHaveBeenCalled()
    const own = await GET(
      request(path, { Origin: 'https://legacy.example.test' })
    )
    expect(own.status).toBe(200)
  })
  it.each(ALLOWED(APP))('keeps the list for %s', async (_name, origin) => {
    const response = await GET(request(path, { ...appEdge, ...origin }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      memberships: [{ membershipId: row.id, role: row.role, tenant }],
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('vary')).toBe('Cookie')
  })
  it('keeps the 401 without a session ahead of the origin refusal', async () => {
    state.session.mockResolvedValue(null)
    const response = await GET(request(path, { ...appEdge, Origin: BRAVO }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(state.memberships).not.toHaveBeenCalled()
  })
})

describe.each([
  ['legacy', legacyCurrent],
  ['service', serviceCurrent],
] as const)('%s GET /api/auth/organizations/current', (_host, GET) => {
  const path = '/api/auth/organizations/current'
  it.each(FOREIGN_ON_TENANT)(
    'refuses %s after the host and the session, before reading the membership',
    async (_name, origin) => {
      for (const method of ['GET', 'HEAD'])
        await assertDenial(
          await GET(request(path, { ...tenantEdge, ...origin }, method))
        )
      expect(state.organization).toHaveBeenCalledTimes(2)
      expect(state.session).toHaveBeenCalledTimes(2)
      expect(state.transaction).not.toHaveBeenCalled()
      expect(state.membershipUnique).not.toHaveBeenCalled()
    }
  )
  it.each(ALLOWED(ALFA))(
    'keeps the host membership for %s',
    async (_name, origin) => {
      const response = await GET(request(path, { ...tenantEdge, ...origin }))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        membership: { membershipId: row.id, role: row.role, tenant },
      })
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    }
  )
  it('keeps the host refusals and the 401 ahead of the origin refusal', async () => {
    const outside = await GET(request(path, { ...appEdge, Origin: BRAVO }))
    expect(outside.status).toBe(409)
    expect(await outside.json()).toEqual({
      error: 'Disponível somente no endereço da locadora',
      code: 'TENANT_REQUIRED',
    })
    state.organization.mockResolvedValueOnce(null)
    const unknown = await GET(request(path, { ...tenantEdge, Origin: BRAVO }))
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: 'Locadora não encontrada' })
    state.session.mockResolvedValueOnce(null)
    const anonymous = await GET(request(path, { ...tenantEdge, Origin: BRAVO }))
    expect(anonymous.status).toBe(401)
    expect(await anonymous.json()).toEqual({
      error: 'Authentication required',
    })
    expect(state.membershipUnique).not.toHaveBeenCalled()
  })
})

describe.each([
  ['legacy', legacySelection, legacySelect],
  ['service', serviceSelection, serviceSelect],
] as const)('%s GET /api/auth/organizations/selection', (_host, GET, POST) => {
  const path = '/api/auth/organizations/selection'
  const preference = { cookie: `selected-tenant-id=${tenant.id}` }
  it.each(FOREIGN_ON_APP)(
    'refuses %s after the session, before revalidating or clearing the preference',
    async (_name, origin) => {
      for (const method of ['GET', 'HEAD'])
        await assertDenial(
          await GET(
            request(path, { ...appEdge, ...preference, ...origin }, method)
          )
        )
      expect(state.session).toHaveBeenCalledTimes(2)
      expect(state.membership).not.toHaveBeenCalled()
    }
  )
  it.each(ALLOWED(APP))(
    'keeps the revalidated selection for %s',
    async (_name, origin) => {
      const response = await GET(
        request(path, { ...appEdge, ...preference, ...origin })
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        selection: { membershipId: row.id, role: row.role, tenant },
      })
      expect(response.headers.get('set-cookie')).toBeNull()
    }
  )
  it('keeps the 401 (and its clearing cookie) ahead of the origin refusal', async () => {
    state.session.mockResolvedValue(null)
    const response = await GET(
      request(path, { ...appEdge, ...preference, Origin: BRAVO })
    )
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(state.membership).not.toHaveBeenCalled()
  })
  it('keeps the selection mutation refusal unchanged', async () => {
    const response = await POST(
      new Request(`${BACKEND}${path}`, {
        method: 'POST',
        headers: {
          ...appEdge,
          Origin: BRAVO,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId: tenant.id }),
      })
    )
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Origin not allowed' })
    expect(state.membership).not.toHaveBeenCalled()
  })
})

describe.each([
  ['legacy', legacyOwner, legacySlug],
  ['service', serviceOwner, serviceSlug],
] as const)(
  '%s owner account and slug reads (already refused by onboardingAppOrigin)',
  (_host, owner, slug) => {
    const reads = [
      ['owner-account', () => owner, '/api/auth/owner-account'],
      [
        'slug-availability',
        () => slug,
        '/api/onboarding/slug-availability?slug=nova-locadora',
      ],
    ] as const
    it.each(
      reads.flatMap(([name, handler, path]) =>
        FOREIGN_ON_APP.map(
          ([label, origin]) => [name, label, handler, path, origin] as const
        )
      )
    )(
      '%s refuses %s with ORIGIN_NOT_ALLOWED before any account fact',
      async (_name, _label, handler, path, origin) => {
        const response = await handler()(
          request(path, { ...appEdge, ...origin })
        )
        expect(response.status).toBe(403)
        expect(await response.json()).toMatchObject({
          code: 'ORIGIN_NOT_ALLOWED',
        })
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(state.user).not.toHaveBeenCalled()
      }
    )
    it.each(reads)(
      '%s does not refuse the origin of its real consumer (same origin or none)',
      async (_name, handler, path) => {
        for (const origin of [
          {},
          { Origin: APP, 'Sec-Fetch-Site': 'same-origin' },
        ]) {
          const response = await handler()(
            request(path, { ...appEdge, ...origin })
          )
          // The next step is the signup switch (off here), never the origin.
          expect(await response.json()).toMatchObject({
            code: 'SELF_SERVICE_SIGNUP_DISABLED',
          })
        }
        expect(state.user).not.toHaveBeenCalled()
      }
    )
    it.each(reads)(
      '%s keeps its stricter fetch-metadata rule: a cross-site request is refused even without Origin',
      async (_name, handler, path) => {
        const response = await handler()(
          request(path, { ...appEdge, 'Sec-Fetch-Site': 'cross-site' })
        )
        expect(response.status).toBe(403)
        expect(await response.json()).toMatchObject({
          code: 'ORIGIN_NOT_ALLOWED',
        })
      }
    )
  }
)
