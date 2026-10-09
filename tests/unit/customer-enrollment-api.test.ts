import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { EnrollmentError } from '@gb-locacoes/backend/customers'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  organization: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    organization: { findUnique: vi.fn() },
    membership: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    clientProfile: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('@/lib/application-session', () => ({
  getServerSession: state.session,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: state.organization },
    $transaction: state.transaction,
  },
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      organization: { findUnique: state.organization },
      $transaction: state.transaction,
    },
  }),
}))
import { POST as legacy } from '@/app/api/client/enroll/route'
import { POST as service } from '../../apps/services/api/src/app/api/client/enroll/route'

const tenant = {
  id: 'enroll-tenant',
  slug: 'alfa',
  name: 'Tenant Alfa',
  status: 'ACTIVE',
}
const user = {
  id: 'enroll-user',
  name: '  Customer  ',
  email: 'customer@example.test',
  phone: '(11) 98888-7777',
  cpf: '123.456.789-01',
  cnpj: '12.345.678/0001-99',
  company: ' Company ',
}
const secret = 'fixture-enrollment-edge-secret-0123456789'
const edge = {
  'x-platform-edge-auth': secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': 'alfa',
  'x-platform-origin': 'https://alfa.platform.test',
  'x-platform-client-ip': '203.0.113.17',
}
const outside: Array<[string, Record<string, string>]> = [
  ['no edge', {}],
  ['forged', { ...edge, 'x-platform-edge-auth': 'forged' }],
  [
    'app',
    {
      ...edge,
      'x-platform-host-kind': 'app',
      'x-platform-tenant-slug': '',
      'x-platform-origin': 'https://app.platform.test',
    },
  ],
  [
    'apex',
    {
      ...edge,
      'x-platform-host-kind': 'apex',
      'x-platform-tenant-slug': '',
      'x-platform-origin': 'https://platform.test',
    },
  ],
]
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv('PLATFORM_EDGE_SECRET', secret)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_API_ORIGIN', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  state.organization.mockResolvedValue({ id: tenant.id, status: tenant.status })
  state.session.mockResolvedValue({ user: { id: user.id, role: 'ADMIN' } })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.$queryRaw.mockResolvedValue([])
  state.tx.organization.findUnique.mockResolvedValue(tenant)
  state.tx.membership.findUnique.mockResolvedValue(null)
  state.tx.membership.create.mockResolvedValue({
    id: 'enroll-member',
    role: 'CLIENT',
  })
  state.tx.user.findUnique.mockResolvedValue(user)
  state.tx.clientProfile.findUnique.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllEnvs())

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s client enrollment characterization', (_host, POST) => {
  const request = (
    body: unknown = { consent: true },
    headers: Record<string, string> = edge,
    query = '',
    raw = false
  ) =>
    new Request(`https://api.platform.test/api/client/enroll${query}`, {
      method: 'POST',
      headers,
      body: raw ? (body as string) : JSON.stringify(body),
    })
  const reply = async (
    response: Response,
    status: number,
    body: unknown,
    privateCache = true
  ) => {
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual(body)
    expect(response.headers.get('cache-control')).toBe(
      privateCache ? 'private, no-store' : 'no-store'
    )
    expect(response.headers.get('vary')).toBe(
      privateCache ? 'Cookie, Host' : null
    )
    expect(response.headers.get('set-cookie')).toBeNull()
  }
  const unwritten = () => {
    expect(state.transaction).not.toHaveBeenCalled()
    expect(state.tx.membership.create).not.toHaveBeenCalled()
    expect(state.tx.clientProfile.create).not.toHaveBeenCalled()
    expect(state.tx.auditLog.create).not.toHaveBeenCalled()
  }
  it.each<Record<string, string>>([
    { origin: 'https://bravo.platform.test' },
    { origin: 'null' },
    { origin: 'https://alfa.platform.test', 'sec-fetch-site': 'same-site' },
    { 'sec-fetch-site': 'cross-site' },
  ])(
    'rejects sibling/browser origin before host, body, session or effects: %j',
    async (headers) => {
      await reply(
        await POST(request('{', { ...edge, ...headers }, '', true)),
        403,
        { error: 'Origem não permitida' }
      )
      expect(state.organization).not.toHaveBeenCalled()
      expect(state.session).not.toHaveBeenCalled()
      unwritten()
    }
  )
  it.each(
    outside.flatMap(([name, headers]) =>
      ['', '?tenantSlug=alfa', '?tenantSlug=bravo'].map(
        (query) => [name, headers, query] as const
      )
    )
  )(
    'outside tenant host %s %j %s refuses before parsing or lookup',
    async (_name, headers, query) => {
      const req = request('{', headers, query, true)
      const json = vi.spyOn(req, 'json')
      await reply(await POST(req), 409, {
        error: 'Disponível somente no endereço da locadora',
        code: 'TENANT_REQUIRED',
      })
      expect(json).not.toHaveBeenCalled()
      expect(state.organization).not.toHaveBeenCalled()
      expect(state.session).not.toHaveBeenCalled()
      unwritten()
    }
  )
  it.each([null, { id: tenant.id, status: 'SUSPENDED' }])(
    'unavailable host %j is neutral before consent or session',
    async (row) => {
      state.organization.mockResolvedValue(row)
      await reply(
        await POST(request('{', edge, '', true)),
        404,
        { error: 'Locadora não encontrada' },
        false
      )
      expect(state.session).not.toHaveBeenCalled()
      unwritten()
    }
  )
  it('malformed JSON is 400 before identity', async () => {
    await reply(await POST(request('{', edge, '', true)), 400, {
      error: 'Dados inválidos',
    })
    expect(state.session).not.toHaveBeenCalled()
    unwritten()
  })
  it.each([
    null,
    [],
    {},
    { consent: false },
    { consent: 'true' },
    { consent: 1 },
    { consent: true, role: 'ADMIN' },
    { consent: true, tenantId: tenant.id },
    { consent: true, userId: 'foreign' },
    { consent: true, phone: '123' },
    { consent: true, tenantSlug: null },
  ])('strict consent contract %j', async (body) => {
    await reply(await POST(request(body)), 400, {
      error: 'Confirme o consentimento para vincular sua conta',
    })
    expect(state.session).not.toHaveBeenCalled()
    unwritten()
  })
  it.each([
    [{ consent: true, tenantSlug: 'bravo' }, ''],
    [{ consent: true }, '?tenantSlug=bravo'],
    [{ consent: true }, '?tenantSlug=alfa&tenantSlug=bravo'],
  ])(
    'conflicting body/query %j %s is 400 before session',
    async (body, query) => {
      await reply(
        await POST(request(body, edge, query as string)),
        400,
        { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
        false
      )
      expect(state.session).not.toHaveBeenCalled()
      unwritten()
    }
  )
  it.each(['', 'foreign-tenant'])(
    'conflicting tenant header %s has private cache',
    async (value) => {
      await reply(
        await POST(
          request({ consent: true }, { ...edge, 'x-tenant-id': value })
        ),
        400,
        { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' }
      )
      expect(state.session).not.toHaveBeenCalled()
      unwritten()
    }
  )
  it.each([null, {}, { user: {} }, { user: { id: '' } }])(
    'requires authenticated identity %j',
    async (session) => {
      state.session.mockResolvedValue(session)
      await reply(await POST(request()), 401, {
        error: 'Authentication required',
      })
      unwritten()
    }
  )
  it('creates only CLIENT with one scoped transaction, normalized profile and consent audit', async () => {
    await reply(
      await POST(
        request(
          { consent: true, tenantSlug: 'alfa' },
          {
            ...edge,
            origin: edge['x-platform-origin'],
            'sec-fetch-site': 'same-origin',
            'x-tenant-id': tenant.id,
            'user-agent': 'x'.repeat(600),
          },
          '?tenantSlug=alfa'
        )
      ),
      201,
      {
        created: true,
        membership: { membershipId: 'enroll-member', role: 'CLIENT', tenant },
      }
    )
    expect(state.transaction).toHaveBeenCalledTimes(1)
    expect(state.tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(state.tx.$queryRaw.mock.calls[0]!.slice(1)).toEqual([tenant.id])
    expect(state.tx.membership.create.mock.calls[0]![0].data).toEqual({
      tenantId: tenant.id,
      userId: user.id,
      role: 'CLIENT',
      status: 'ACTIVE',
    })
    expect(state.tx.clientProfile.create).toHaveBeenCalledExactlyOnceWith({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        name: 'Customer',
        email: user.email,
        phone: '11988887777',
        document: '12345678901',
        company: 'Company',
      },
    })
    expect(state.tx.auditLog.create.mock.calls[0]![0].data).toEqual({
      tenantId: tenant.id,
      userId: user.id,
      action: 'CLIENT_ENROLLED',
      entity: 'Membership',
      entityId: 'enroll-member',
      changes: { role: 'CLIENT', consent: true },
      ipAddress: '203.0.113.17',
      userAgent: 'x'.repeat(512),
    })
  })
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'])(
    'active membership role %s is returned unchanged without profile repair or audit',
    async (role) => {
      state.tx.membership.findUnique.mockResolvedValue({
        id: 'existing',
        role,
        status: 'ACTIVE',
      })
      await reply(await POST(request()), 200, {
        created: false,
        membership: { membershipId: 'existing', role, tenant },
      })
      expect(state.tx.user.findUnique).not.toHaveBeenCalled()
      expect(state.tx.clientProfile.create).not.toHaveBeenCalled()
      expect(state.tx.membership.create).not.toHaveBeenCalled()
      expect(state.tx.auditLog.create).not.toHaveBeenCalled()
    }
  )
  it.each(['SUSPENDED', 'REVOKED'])(
    'does not reactivate %s membership',
    async (status) => {
      state.tx.membership.findUnique.mockResolvedValue({
        id: 'existing',
        role: 'CLIENT',
        status,
      })
      await reply(await POST(request()), 403, {
        error: 'Vínculo com esta locadora indisponível',
        code: 'MEMBERSHIP_INACTIVE',
      })
      expect(state.tx.membership.create).not.toHaveBeenCalled()
      expect(state.tx.auditLog.create).not.toHaveBeenCalled()
    }
  )
  it.each([null, { ...tenant, status: 'SUSPENDED' }])(
    'organization disappearing during transaction %j',
    async (row) => {
      state.tx.organization.findUnique.mockResolvedValue(row)
      await reply(await POST(request()), 404, {
        error: 'Locadora não encontrada',
        code: 'TENANT_UNAVAILABLE',
      })
      expect(state.tx.membership.create).not.toHaveBeenCalled()
    }
  )
  it('session user removed before enrollment is 401 USER_NOT_FOUND', async () => {
    state.tx.user.findUnique.mockResolvedValue(null)
    await reply(await POST(request()), 401, {
      error: 'Authentication required',
      code: 'USER_NOT_FOUND',
    })
    expect(state.tx.membership.create).not.toHaveBeenCalled()
  })
  it.each(['foreign-user', null])(
    'never adopts document holder %s',
    async (userId) => {
      state.tx.clientProfile.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId })
      await reply(await POST(request()), 409, {
        error: 'Não foi possível concluir o vínculo. Fale com a locadora.',
        code: 'PROFILE_CONFLICT',
      })
      expect(state.tx.membership.create).not.toHaveBeenCalled()
    }
  )
  it('preserves an existing own profile', async () => {
    state.tx.clientProfile.findUnique.mockResolvedValue({ id: 'own-profile' })
    expect((await POST(request())).status).toBe(201)
    expect(state.tx.clientProfile.create).not.toHaveBeenCalled()
    expect(state.tx.auditLog.create).toHaveBeenCalledTimes(1)
  })
  it('retries a genuine unique race in a fresh tenant transaction', async () => {
    state.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('fixture unique', {
        code: 'P2002',
        clientVersion: 'fixture',
      })
    )
    state.tx.membership.findUnique.mockResolvedValue({
      id: 'winner',
      role: 'CLIENT',
      status: 'ACTIVE',
    })
    await reply(await POST(request()), 200, {
      created: false,
      membership: { membershipId: 'winner', role: 'CLIENT', tenant },
    })
    expect(state.transaction).toHaveBeenCalledTimes(2)
    expect(state.tx.membership.create).not.toHaveBeenCalled()
  })
  it('two genuine unique failures return PROFILE_CONFLICT', async () => {
    state.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('fixture unique', {
        code: 'P2002',
        clientVersion: 'fixture',
      })
    )
    await reply(await POST(request()), 409, {
      error: 'Não foi possível concluir o vínculo. Fale com a locadora.',
      code: 'PROFILE_CONFLICT',
    })
    expect(state.transaction).toHaveBeenCalledTimes(2)
  })
  it.each([
    'host lookup',
    'session',
    'transaction',
    'profile',
    'audit',
    'fake P2002',
  ])('unexpected failure at %s is neutral 503', async (where) => {
    const error =
      where === 'fake P2002' ? { code: 'P2002' } : new Error('private detail')
    const mock =
      where === 'host lookup'
        ? state.organization
        : where === 'session'
          ? state.session
          : where === 'profile'
            ? state.tx.clientProfile.create
            : where === 'audit'
              ? state.tx.auditLog.create
              : state.transaction
    mock.mockRejectedValue(error)
    await reply(await POST(request()), 503, {
      error: 'Vínculo indisponível no momento',
    })
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'private detail'
    )
    if (where === 'fake P2002')
      expect(state.transaction).toHaveBeenCalledTimes(1)
  })
  it('preserves typed service errors', async () => {
    state.transaction.mockRejectedValue(
      new EnrollmentError('fixture conflict', 409, 'PROFILE_CONFLICT')
    )
    await reply(await POST(request()), 409, {
      error: 'fixture conflict',
      code: 'PROFILE_CONFLICT',
    })
  })
})
