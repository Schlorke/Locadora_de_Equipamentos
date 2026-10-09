// POST /api/client/enroll (ADR adr-tenant-hosts, D9 e Lote 6): vínculo explícito como CLIENTE da locadora da
// BORDA, no PostgreSQL descartável. Nunca papel de equipe; vínculo revogado ou suspenso não é reativado; nada do
// cliente (corpo, x-tenant-id, Origin de outra locadora) escolhe a locadora.
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { PLATFORM_EDGE_HEADER } from '@gb-locacoes/contracts/platform'

const session = vi.hoisted(() => ({ userId: '' as string | null }))
const fixtureDatabase = vi.hoisted(() => ({ prisma: undefined as unknown }))
vi.mock('@/lib/application-session', () => ({
  getServerSession: async () =>
    session.userId ? { user: { id: session.userId, role: 'CLIENT' } } : null,
}))
vi.mock('@/lib/prisma', async () => {
  const { requireTestDatabase } = await import('../helpers/test-database')
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true')
    throw new Error('Disposable database opt-in required')
  const { Pool } = await import('pg')
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('@prisma/client')
  const pool = new Pool({
    connectionString: requireTestDatabase(process.env),
    max: 4,
  })
  return {
    prisma: (fixtureDatabase.prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    })),
    testPool: pool,
  }
})

import { prisma } from '@/lib/prisma'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: fixtureDatabase.prisma }),
}))
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  ...(await (() => ({
    getServerSession: async () =>
      session.userId ? { user: { id: session.userId, role: 'CLIENT' } } : null,
  }))()),
}))
import * as legacyRoute0 from '@/app/api/client/enroll/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/client/enroll/route'

const HOSTS = [
  [
    'legacy root',
    {
      enroll: legacyRoute0.POST,
    },
  ],
  [
    'service',
    {
      enroll: serviceRoute0.POST,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { enroll }) => {
  const EDGE_SECRET = 'fixture-edge-secret-with-more-than-32-chars'
  const ROOT = 'plataforma.example'
  const base = randomUUID().slice(0, 8)
  const tenantA = `enroll-${base}-a`
  const tenantB = `enroll-${base}-b`
  const slugA = `alfa-${base}`
  const slugB = `beta-${base}`
  const originA = `https://${slugA}.${ROOT}`
  const originB = `https://${slugB}.${ROOT}`
  const users = {
    client: `enroll-${base}-client`,
    revoked: `enroll-${base}-revoked`,
    suspended: `enroll-${base}-suspended`,
    staff: `enroll-${base}-staff`,
    documentTaken: `enroll-${base}-document`,
  }
  // CPF de 11 dígitos, único por execução (users.cpf é único no banco).
  const stamp = String(Date.now()).slice(-9)
  const keys = Object.keys(users) as (keyof typeof users)[]
  const cpfOf = (key: keyof typeof users) => `9${keys.indexOf(key)}${stamp}`

  function edge(slug: string): Record<string, string> {
    return {
      [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
      [PLATFORM_EDGE_HEADER.hostKind]: 'tenant',
      [PLATFORM_EDGE_HEADER.tenantSlug]: slug,
      [PLATFORM_EDGE_HEADER.origin]: `https://${slug}.${ROOT}`,
      [PLATFORM_EDGE_HEADER.clientIp]: '203.0.113.9',
    }
  }

  function request(
    body: unknown,
    headers: Record<string, string> = { ...edge(slugA), origin: originA }
  ) {
    return new Request('https://backend.example/api/client/enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  const stateOf = async (userId: string) => ({
    memberships: await prisma.membership.findMany({
      where: { userId, tenantId: { in: [tenantA, tenantB] } },
      select: { tenantId: true, role: true, status: true },
      orderBy: { tenantId: 'asc' },
    }),
    profiles: await prisma.clientProfile.count({
      where: { userId, tenantId: { in: [tenantA, tenantB] } },
    }),
    audits: await prisma.auditLog.count({
      where: { userId, tenantId: { in: [tenantA, tenantB] } },
    }),
  })

  beforeAll(async () => {
    vi.stubEnv('PLATFORM_ENV', 'production')
    vi.stubEnv('PLATFORM_ROOT_DOMAIN', ROOT)
    vi.stubEnv('PLATFORM_EDGE_SECRET', EDGE_SECRET)
    vi.stubEnv('WEB_API_ORIGIN', 'https://backend.example')
    await prisma.organization.createMany({
      data: [
        { id: tenantA, slug: slugA, name: 'Locadora Alfa' },
        { id: tenantB, slug: slugB, name: 'Locadora Beta' },
      ],
    })
    await prisma.user.createMany({
      data: keys.map((key) => ({
        id: users[key],
        email: `${users[key]}@example.test`,
        name: `Cliente ${key}`,
        // Papel global de equipe: o vínculo pelo site continua sendo de cliente.
        role: 'ADMIN',
        phone: '(11) 99999-0000',
        cpf: cpfOf(key),
      })),
    })
    await prisma.membership.createMany({
      data: [
        {
          tenantId: tenantA,
          userId: users.revoked,
          role: 'CLIENT',
          status: 'REVOKED',
        },
        {
          tenantId: tenantA,
          userId: users.suspended,
          role: 'CLIENT',
          status: 'SUSPENDED',
        },
        {
          tenantId: tenantA,
          userId: users.staff,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      ],
    })
    // Perfil cadastrado pela locadora (sem conta) com o mesmo documento de outro usuário.
    await prisma.clientProfile.create({
      data: {
        tenantId: tenantA,
        name: 'Cliente de balcão',
        document: cpfOf('documentTaken'),
      },
    })
  })
  beforeEach(() => {
    session.userId = users.client
  })
  afterAll(async () => {
    const scope = { tenantId: { in: [tenantA, tenantB] } }
    await prisma.auditLog.deleteMany({ where: scope })
    await prisma.clientProfile.deleteMany({ where: scope })
    await prisma.membership.deleteMany({ where: scope })
    await prisma.organization.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    })
    vi.unstubAllEnvs()
  })

  describe('POST /api/client/enroll', () => {
    it('recusa antes de gravar: sem consentimento, papel no corpo, outra locadora ou outra origem', async () => {
      const cases: Array<[Request, number]> = [
        [request({}), 400],
        [request({ consent: false }), 400],
        [request({ consent: true, role: 'ADMIN' }), 400],
        [request({ consent: true, tenantId: tenantB }), 400],
        [request({ consent: true, tenantSlug: slugB }), 400],
        [
          request(
            { consent: true },
            { ...edge(slugA), origin: originA, 'x-tenant-id': tenantB }
          ),
          400,
        ],
        [request({ consent: true }, { ...edge(slugA), origin: originB }), 403],
        // Host sem locadora (app) ou borda forjada: a locadora nunca vem do corpo.
        [
          request(
            { consent: true, tenantSlug: slugA },
            {
              [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
              [PLATFORM_EDGE_HEADER.hostKind]: 'app',
              [PLATFORM_EDGE_HEADER.origin]: `https://app.${ROOT}`,
              origin: `https://app.${ROOT}`,
            }
          ),
          409,
        ],
        [
          request(
            { consent: true, tenantSlug: slugA },
            { ...edge(slugA), [PLATFORM_EDGE_HEADER.auth]: 'x'.repeat(40) }
          ),
          409,
        ],
      ]
      for (const [input, status] of cases) {
        const response = await enroll(input)
        expect(response.status).toBe(status)
        expect(response.headers.get('cache-control')).toMatch(/no-store/)
      }
      const conflict = await enroll(
        request({ consent: true, tenantSlug: slugB })
      )
      expect((await conflict.json()).code).toBe('TENANT_CONFLICT')
      expect(await stateOf(users.client)).toEqual({
        memberships: [],
        profiles: 0,
        audits: 0,
      })
    })

    it('fora de host de locadora (app, apex ou sem borda): o 409 TENANT_REQUIRED documentado, igual a /current', async () => {
      const appEdge = {
        [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
        [PLATFORM_EDGE_HEADER.hostKind]: 'app',
        [PLATFORM_EDGE_HEADER.origin]: `https://app.${ROOT}`,
      }
      const apexEdge = {
        [PLATFORM_EDGE_HEADER.auth]: EDGE_SECRET,
        [PLATFORM_EDGE_HEADER.hostKind]: 'apex',
        [PLATFORM_EDGE_HEADER.origin]: `https://${ROOT}`,
      }
      const post = (
        body: string,
        headers: Record<string, string>,
        query = ''
      ) =>
        new Request(`https://backend.example/api/client/enroll${query}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body,
        })
      const json = (value: unknown) => JSON.stringify(value)
      const cases: Array<[string, Request]> = [
        ['sem borda, sem slug', post(json({ consent: true }), {})],
        [
          'sem borda, slug inexistente',
          post(json({ consent: true, tenantSlug: 'nao-existe-x9' }), {}),
        ],
        [
          'sem borda, slug ativo',
          post(json({ consent: true, tenantSlug: slugA }), {}),
        ],
        [
          'sem borda, slug inexistente na query',
          post(json({ consent: true }), {}, '?tenantSlug=nao-existe-x9'),
        ],
        [
          'host app, sem slug',
          post(json({ consent: true }), {
            ...appEdge,
            origin: `https://app.${ROOT}`,
          }),
        ],
        [
          'host app, slug inexistente',
          post(json({ consent: true, tenantSlug: 'nao-existe-x9' }), {
            ...appEdge,
            origin: `https://app.${ROOT}`,
          }),
        ],
        [
          'apex, slug ativo',
          post(json({ consent: true, tenantSlug: slugA }), {
            ...apexEdge,
            origin: `https://${ROOT}`,
          }),
        ],
        // Decide pela borda antes de ler o corpo: nem o corpo inválido muda a resposta.
        ['sem borda, corpo inválido', post('{', {})],
        [
          'host app, consentimento ausente',
          post(json({}), { ...appEdge, origin: `https://app.${ROOT}` }),
        ],
      ]
      for (const [label, input] of cases) {
        const response = await enroll(input)
        expect(response.status, label).toBe(409)
        expect(await response.json(), label).toEqual({
          error: 'Disponível somente no endereço da locadora',
          code: 'TENANT_REQUIRED',
        })
        expect(response.headers.get('cache-control'), label).toBe(
          'private, no-store'
        )
        expect(response.headers.get('vary'), label).toBe('Cookie, Host')
      }
      expect(await stateOf(users.client)).toEqual({
        memberships: [],
        profiles: 0,
        audits: 0,
      })
    })

    it('no host de locadora, tenantSlug de outra locadora na query ou no corpo: 400 TENANT_CONFLICT sem gravar', async () => {
      const at = (query: string, body: unknown) =>
        new Request(`https://backend.example/api/client/enroll${query}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...edge(slugA),
            origin: originA,
          },
          body: JSON.stringify(body),
        })
      for (const input of [
        at(`?tenantSlug=${slugB}`, { consent: true }),
        at(`?tenantSlug=${slugA}&tenantSlug=${slugB}`, { consent: true }),
        at(`?tenantSlug=${slugA}`, { consent: true, tenantSlug: slugB }),
      ]) {
        const response = await enroll(input)
        expect(response.status).toBe(400)
        expect((await response.json()).code).toBe('TENANT_CONFLICT')
      }
      expect(await stateOf(users.client)).toEqual({
        memberships: [],
        profiles: 0,
        audits: 0,
      })
    })

    it('sem sessão responde 401 sem gravar', async () => {
      session.userId = null
      expect((await enroll(request({ consent: true }))).status).toBe(401)
    })

    it('cria Membership(CLIENT) e ClientProfile na locadora da borda, com o consentimento auditado', async () => {
      const response = await enroll(
        request({ consent: true, tenantSlug: slugA })
      )
      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.membership).toMatchObject({
        role: 'CLIENT',
        tenant: { id: tenantA, slug: slugA, name: 'Locadora Alfa' },
      })
      const state = await stateOf(users.client)
      expect(state.memberships).toEqual([
        { tenantId: tenantA, role: 'CLIENT', status: 'ACTIVE' },
      ])
      const profile = await prisma.clientProfile.findUniqueOrThrow({
        where: { tenantId_userId: { tenantId: tenantA, userId: users.client } },
      })
      expect(profile).toMatchObject({
        name: 'Cliente client',
        email: `${users.client}@example.test`,
        phone: '11999990000',
        document: cpfOf('client'),
      })
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { tenantId: tenantA, userId: users.client },
      })
      expect(audit).toMatchObject({
        action: 'CLIENT_ENROLLED',
        entity: 'Membership',
        entityId: body.membership.membershipId,
        ipAddress: '203.0.113.9',
      })
      // Locadora B (outro host) continua sem vínculo.
      expect(state.memberships.some((row) => row.tenantId === tenantB)).toBe(
        false
      )
    })

    it('repetir o pedido devolve o vínculo existente sem gravar de novo', async () => {
      const before = await stateOf(users.client)
      const response = await enroll(request({ consent: true }))
      expect(response.status).toBe(200)
      expect((await response.json()).created).toBe(false)
      expect(await stateOf(users.client)).toEqual(before)
    })

    it('no host B, o vínculo é criado só em B', async () => {
      const response = await enroll(
        request({ consent: true }, { ...edge(slugB), origin: originB })
      )
      expect(response.status).toBe(201)
      expect((await stateOf(users.client)).memberships).toEqual([
        { tenantId: tenantA, role: 'CLIENT', status: 'ACTIVE' },
        { tenantId: tenantB, role: 'CLIENT', status: 'ACTIVE' },
      ])
    })

    it('vínculo revogado ou suspenso não é reativado', async () => {
      for (const [userId, status] of [
        [users.revoked, 'REVOKED'],
        [users.suspended, 'SUSPENDED'],
      ] as const) {
        session.userId = userId
        const response = await enroll(request({ consent: true }))
        expect(response.status).toBe(403)
        expect(await stateOf(userId)).toEqual({
          memberships: [{ tenantId: tenantA, role: 'CLIENT', status }],
          profiles: 0,
          audits: 0,
        })
      }
    })

    it('vínculo de equipe ativo é devolvido como está: nunca rebaixa nem promove', async () => {
      session.userId = users.staff
      const response = await enroll(request({ consent: true }))
      expect(response.status).toBe(200)
      expect((await response.json()).membership.role).toBe('ADMIN')
      expect(await stateOf(users.staff)).toEqual({
        memberships: [{ tenantId: tenantA, role: 'ADMIN', status: 'ACTIVE' }],
        profiles: 0,
        audits: 0,
      })
    })

    it('documento já cadastrado nesta locadora por outra pessoa: 409 sem assumir o perfil', async () => {
      session.userId = users.documentTaken
      const response = await enroll(request({ consent: true }))
      expect(response.status).toBe(409)
      expect((await response.json()).code).toBe('PROFILE_CONFLICT')
      expect(await stateOf(users.documentTaken)).toEqual({
        memberships: [],
        profiles: 0,
        audits: 0,
      })
      const holder = await prisma.clientProfile.findFirstOrThrow({
        where: { tenantId: tenantA, name: 'Cliente de balcão' },
      })
      expect(holder.userId).toBeNull()
    })
  })
})

// O cliente e o pool do banco descartável são da fábrica deste arquivo: fecham uma vez, depois dos dois hosts.
afterAll(async () => {
  if (!process.env.TEST_DATABASE_URL) return
  const database = (await import('@/lib/prisma')) as unknown as {
    prisma: { $disconnect(): Promise<void> }
    testPool: { end(): Promise<void> }
  }
  await database.prisma.$disconnect()
  await database.testPool.end()
})
