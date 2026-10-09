import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CustomerError } from '@gb-locacoes/backend/customers'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  transaction: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    clientProfile: { findUnique: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/lib/tenant', async () => {
  const { withTenantTransaction } =
    await import('@gb-locacoes/backend/identity')
  return {
    resolveTenantPrincipal: state.principal,
    withTenantTransaction: (context: { tenantId: string }, operation: never) =>
      withTenantTransaction(
        { $transaction: state.transaction } as never,
        context,
        operation
      ),
  }
})
import { PUT as legacy } from '@/app/api/user/profile/route'
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: { $transaction: state.transaction } }),
}))
import { PUT as service } from '../../apps/services/api/src/app/api/user/profile/route'

const principal = {
  tenantId: 'profile-tenant',
  userId: 'profile-user',
  membershipId: 'profile-member',
  role: 'CLIENT' as const,
}
const saved = {
  id: 'profile-storage-id',
  tenantId: principal.tenantId,
  userId: principal.userId,
  name: 'Commercial name',
  email: 'commercial@example.test',
  phone: '11999999999',
  document: '12345678901',
  company: 'Commercial company',
}
const expected = {
  id: principal.userId,
  name: saved.name,
  email: saved.email,
  phone: saved.phone,
  cpf: saved.document,
  cnpj: null,
  company: saved.company,
}
const key = {
  tenantId_userId: { tenantId: principal.tenantId, userId: principal.userId },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://app.platform.test')
  state.principal.mockResolvedValue({ ok: true, principal })
  state.transaction.mockImplementation(async (operation) => operation(state.tx))
  state.tx.clientProfile.findUnique.mockResolvedValue(saved)
  state.tx.clientProfile.update.mockImplementation(async ({ data }) => ({
    ...saved,
    ...data,
  }))
})
afterEach(() => vi.unstubAllEnvs())

describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s commercial profile PUT characterization', (_host, PUT) => {
  const request = (
    body: unknown = { phone: '(11) 98888-7777', company: ' New company ' },
    headers: Record<string, string> = {},
    query = '',
    raw = false
  ) =>
    new NextRequest(`https://app.platform.test/api/user/profile${query}`, {
      method: 'PUT',
      headers,
      body: raw ? (body as string) : JSON.stringify(body),
    })
  it.each(['FULL', 'SETUP', 'RESTRICTED'])(
    '%s keeps the own profile editable after scoped lookup, with no plan dependency',
    async (access) => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      state.tx.$queryRaw.mockImplementation(
        async (strings: TemplateStringsArray) =>
          strings.join('').includes('FROM organizations')
            ? [{ id: principal.tenantId, status: 'ACTIVE', access }]
            : []
      )
      expect(
        (await PUT(request(undefined, {}, '?userId=foreign'))).status
      ).toBe(200)
      expect(state.tx.clientProfile.update).toHaveBeenCalledExactlyOnceWith({
        where: key,
        data: { phone: '11988887777', company: 'New company' },
      })
    }
  )
  it('ARCHIVED refuses an own-profile mutation with the current private policy', async () => {
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
    state.tx.$queryRaw.mockImplementation(
      async (strings: TemplateStringsArray) =>
        strings.join('').includes('FROM organizations')
          ? [{ id: principal.tenantId, status: 'ACTIVE', access: 'ARCHIVED' }]
          : []
    )
    const response = await PUT(request())
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Esta locadora está arquivada.',
      code: 'TENANT_ARCHIVED',
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Host')
    expect(state.tx.clientProfile.update).not.toHaveBeenCalled()
  })
  it.each([400, 401, 403, 404, 409, 503])(
    'preserves principal refusal %i before parsing or opening a transaction',
    async (status) => {
      const refused = Response.json(
        { error: 'fixture-refused' },
        { status, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }
      )
      state.principal.mockResolvedValue({ ok: false, response: refused })
      expect(await PUT(request('{', {}, '', true))).toBe(refused)
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each<Record<string, string>>([
    { Origin: 'https://bravo.platform.test' },
    { Origin: 'null' },
    { 'Sec-Fetch-Site': 'same-site' },
    { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'cross-site' },
  ])(
    'rejects a cross-origin mutation %j before invalid JSON',
    async (headers) => {
      const response = await PUT(request('{', headers, '', true))
      expect(response.status).toBe(403)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({ error: 'Origem não permitida' })
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
    'updates only the own commercial profile with a %s membership',
    async (role) => {
      state.principal.mockResolvedValue({
        ok: true,
        principal: { ...principal, role },
      })
      const input = request(undefined, {}, '?userId=foreign&tenantId=foreign')
      const response = await PUT(input)
      expect(state.principal).toHaveBeenCalledExactlyOnceWith(input)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(await response.json()).toEqual({
        success: true,
        user: { ...expected, phone: '11988887777', company: 'New company' },
      })
      expect(state.tx.$queryRaw.mock.calls[0]![1]).toBe(principal.tenantId)
      expect(state.tx.clientProfile.findUnique).toHaveBeenCalledExactlyOnceWith(
        { where: key }
      )
      expect(state.tx.clientProfile.update).toHaveBeenCalledExactlyOnceWith({
        where: key,
        data: { phone: '11988887777', company: 'New company' },
      })
    }
  )
  const invalidBodies: unknown[] = [
    null,
    [],
    'profile',
    1,
    true,
    { phone: null },
    { phone: 123 },
    { phone: '1'.repeat(31) },
    { company: null },
    { company: true },
    { company: 'a'.repeat(201) },
    { cpf: null },
    { cpf: 123 },
    { cpf: '1'.repeat(21) },
    { cnpj: null },
    { cnpj: {} },
    { cnpj: '1'.repeat(21) },
    { name: 'Override' },
    { email: 'override@example.test' },
    { document: '12345678901' },
    { userId: 'foreign' },
    { tenantId: 'foreign' },
    { role: 'ADMIN' },
    { id: 'foreign' },
  ]
  it.each(invalidBodies)(
    'keeps the strict wire schema for %j',
    async (body) => {
      const response = await PUT(request(body))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Dados inválidos' })
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each([
    { cpf: '123' },
    { cnpj: '123' },
    { cpf: '12345678000199' },
    { cnpj: '12345678901' },
    { cpf: '12345678901', cnpj: '12345678000199' },
    { cnpj: '12ABC678000199' },
  ])(
    'keeps numeric document validation for %j before storage',
    async (body) => {
      const response = await PUT(request(body))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Informe somente CPF ou CNPJ válido',
      })
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each([
    [
      { cpf: '987.654.321-00' },
      { document: '98765432100' },
      { cpf: '98765432100' },
    ],
    [
      { cnpj: '12.345.678/0001-99' },
      { document: '12345678000199' },
      { cpf: null, cnpj: '12345678000199' },
    ],
    [
      { phone: '', company: '   ' },
      { phone: null, company: null },
      { phone: null, company: null },
    ],
    [
      { phone: 'abc', company: 'Company' },
      { phone: null, company: 'Company' },
      { phone: null, company: 'Company' },
    ],
    [{}, {}, {}],
    [{ cpf: '', cnpj: '' }, {}, {}],
    [{ cpf: 'letters only', cnpj: 'letters only' }, {}, {}],
    [
      { phone: '1'.repeat(30), company: 'a'.repeat(200) },
      { phone: '1'.repeat(30), company: 'a'.repeat(200) },
      { phone: '1'.repeat(30), company: 'a'.repeat(200) },
    ],
  ] as const)(
    'preserves normalization and empty-document behavior for %j',
    async (body, data, changes) => {
      const response = await PUT(request(body))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        user: { ...expected, ...changes },
      })
      expect(state.tx.clientProfile.update).toHaveBeenCalledExactlyOnceWith({
        where: key,
        data,
      })
    }
  )
  it('never creates or uses a global/foreign profile when the own profile is absent', async () => {
    state.tx.clientProfile.findUnique.mockResolvedValue(null)
    const response = await PUT(request())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: 'Perfil da locadora não encontrado',
    })
    expect(state.tx.clientProfile.update).not.toHaveBeenCalled()
  })
  it.each(['{', ''])(
    'keeps malformed JSON %j as the legacy generic 500',
    async (body) => {
      const response = await PUT(request(body, {}, '', true))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao atualizar perfil',
      })
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each(['principal', 'transaction', 'read', 'update'] as const)(
    'sanitizes the %s failure within the existing catch',
    async (dependency) => {
      const failure = new Error('fixture-private-failure')
      if (dependency === 'read')
        state.tx.clientProfile.findUnique.mockRejectedValue(failure)
      else if (dependency === 'update')
        state.tx.clientProfile.update.mockRejectedValue(failure)
      else state[dependency].mockRejectedValue(failure)
      const response = await PUT(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao atualizar perfil',
      })
    }
  )
  it('keeps P2002 as a sanitized tenant document conflict', async () => {
    state.tx.clientProfile.update.mockRejectedValue({
      code: 'P2002',
      meta: { private: 'fixture' },
    })
    const response = await PUT(request())
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Documento já cadastrado nesta locadora',
    })
  })
  it.each([400, 403, 404] as const)(
    'preserves CustomerError %i',
    async (status) => {
      state.tx.clientProfile.update.mockRejectedValue(
        new CustomerError('fixture-business-error', status)
      )
      const response = await PUT(request())
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error: 'fixture-business-error' })
    }
  )
})
