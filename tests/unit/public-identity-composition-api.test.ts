import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  membership: vi.fn(),
  origin: vi.fn(),
  tenant: vi.fn(),
  contact: vi.fn(),
  limiter: vi.fn(),
  permission: vi.fn(),
  delivery: vi.fn(),
  quote: vi.fn(),
}))
vi.mock('@/lib/application-session', () => ({
  getServerSession: state.session,
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { membership: { findFirst: state.membership } },
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: { membership: { findFirst: state.membership } },
  }),
}))
vi.mock('@/lib/security/mutation-origin', () => ({
  isTrustedMutationOrigin: state.origin,
}))
vi.mock('../../apps/services/api/src/host/mutation-origin', () => ({
  isTrustedMutationOrigin: state.origin,
}))
vi.mock('@/lib/tenant', () => ({ resolvePublicRequestTenant: state.tenant }))
vi.mock('../../apps/services/api/src/host/runtime', () => ({
  resolvePublicRequestTenant: state.tenant,
}))
vi.mock('@/lib/contact-request', () => ({
  createContactRequest: state.contact,
}))
vi.mock('../../apps/services/api/src/host/contact-request', () => ({
  createContactRequest: state.contact,
}))
vi.mock('@/lib/rental-transaction', async () => {
  const { RentalMutationError } = await import('@gb-locacoes/backend/rentals')
  return { RentalMutationError }
})
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: state.limiter,
  strictRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: state.limiter,
  strictRateLimit: {},
}))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('@/lib/quote-boleto', () => ({
  requestQuoteBoletoDelivery: state.delivery,
}))
vi.mock('../../apps/services/api/src/host/payments', () => ({
  requestQuoteBoletoDelivery: state.delivery,
}))
vi.mock('@/lib/payment-obligation', async () => {
  const { PaymentRequestError } = await import('@gb-locacoes/backend/billing')
  return { PaymentRequestError }
})
vi.mock('@/app/api/quotes/route', () => ({ POST: state.quote }))
vi.mock('../../apps/services/api/src/app/api/quotes/route', () => ({
  POST: state.quote,
}))
import { POST as contactLegacy } from '@/app/api/contact/route'
import { POST as contactService } from '../../apps/services/api/src/app/api/contact/route'
import { POST as sendLegacy } from '@/app/api/admin/quotes/[id]/send-boleto/route'
import { POST as sendService } from '../../apps/services/api/src/app/api/admin/quotes/[id]/send-boleto/route'
import { POST as quoteLegacy } from '@/app/api/orcamentos/route'
import { POST as quoteService } from '../../apps/services/api/src/app/api/orcamentos/route'
import {
  POST as selectLegacy,
  DELETE as clearLegacy,
} from '@/app/api/auth/organizations/selection/route'
import {
  POST as selectService,
  DELETE as clearService,
} from '../../apps/services/api/src/app/api/auth/organizations/selection/route'

const principal = {
  tenantId: 'local',
  userId: 'user',
  membershipId: 'membership',
  role: 'ADMIN',
}
const contact = {
  name: 'Visitor',
  email: 'visitor@example.test',
  message: 'Rental question',
}
const request = (
  body: unknown = {},
  method = 'POST',
  headers: Record<string, string> = {}
) =>
  new NextRequest('https://app.platform.test/api/endpoint', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', 'https://app.platform.test')
  state.session.mockResolvedValue({ user: { id: 'user' } })
  state.origin.mockReturnValue(true)
  state.membership.mockResolvedValue({
    id: 'membership',
    role: 'CLIENT',
    organization: {
      id: 'local',
      slug: 'local',
      name: 'Local',
      status: 'ACTIVE',
    },
  })
  state.tenant.mockResolvedValue({ ok: true, context: principal, edge: null })
  state.contact.mockResolvedValue({ id: 'saved' })
  state.limiter.mockReturnValue({ allowed: true })
  state.permission.mockResolvedValue({ ok: true, principal })
  state.delivery.mockResolvedValue({ id: 'boleto' })
  state.quote.mockResolvedValue(
    Response.json(
      { id: 'saved', total: '12.30', status: 'PENDING' },
      { status: 201 }
    )
  )
})
afterEach(() => vi.unstubAllEnvs())

function responseHandler<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response | undefined>
) {
  return async (...args: Args): Promise<Response> => {
    const response = await handler(...args)
    expect(response).toBeInstanceOf(Response)
    if (!response) throw new Error('The handler did not return a response')
    return response
  }
}

describe.each([
  ['legacy', responseHandler(contactLegacy)],
  ['service', responseHandler(contactService)],
] as const)('%s contact contract', (_host, POST) => {
  it('persists parsed fields for the resolved company and returns queued 202', async () => {
    const r = await POST(
      request({
        ...contact,
        tenantSlug: 'local',
        tenantId: 'foreign',
        total: 99,
        equipment: 'informational',
      })
    )
    expect(r.status).toBe(202)
    expect(await r.json()).toEqual({
      success: true,
      data: { messageId: 'saved', deliveryStatus: 'queued' },
      message:
        'Solicitação recebida! Entraremos em contato em até 2 horas úteis.',
    })
    expect(state.contact).toHaveBeenCalledWith(principal, {
      ...contact,
      equipment: 'informational',
    })
  })
  it('returns limiter refusal before malformed JSON and company lookup', async () => {
    const denial = Response.json({ error: 'limited' }, { status: 429 })
    state.limiter.mockReturnValue({ allowed: false, response: denial })
    expect(await POST(request('{'))).toBe(denial)
    expect(state.tenant).not.toHaveBeenCalled()
    expect(state.contact).not.toHaveBeenCalled()
  })
  it('validates company before input, returning its refusal unchanged', async () => {
    const denial = Response.json({ error: 'tenant' }, { status: 404 })
    state.tenant.mockResolvedValue({ ok: false, response: denial })
    expect(await POST(request({ name: '' }))).toBe(denial)
    expect(state.contact).not.toHaveBeenCalled()
  })
  it('rejects sibling origin with a validated edge before writes', async () => {
    state.tenant.mockResolvedValue({
      ok: true,
      context: principal,
      edge: { hostKind: 'tenant' },
    })
    state.origin.mockReturnValue(false)
    const r = await POST(request(contact))
    expect(r.status).toBe(403)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(state.contact).not.toHaveBeenCalled()
  })
  it.each([
    { ...contact, email: 'invalid' },
    { ...contact, name: '' },
    { ...contact, message: '' },
  ])('rejects invalid fields without persistence %#', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(state.contact).not.toHaveBeenCalled()
  })
  it('preserves generic persistence failure without leaking SQL details', async () => {
    state.contact.mockRejectedValue(new Error('private SQL'))
    const r = await POST(request(contact))
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'Erro ao salvar solicitação' })
  })
})

describe.each([
  ['legacy', responseHandler(sendLegacy)],
  ['service', responseHandler(sendService)],
] as const)('%s queued boleto delivery', (_host, POST) => {
  it('limits before permission and does not parse a body before queuing', async () => {
    const r = await POST(request('{'), {
      params: Promise.resolve({ id: 'quote' }),
    })
    expect(r.status).toBe(202)
    expect(state.permission).toHaveBeenCalledWith(
      expect.anything(),
      'FINANCIAL',
      'WRITE'
    )
    expect(state.delivery).toHaveBeenCalledWith(principal, 'quote')
    expect(await r.json()).toEqual({
      success: true,
      processing: 'PENDING',
      boleto: { id: 'boleto' },
      message: 'Envio solicitado',
    })
  })
  it('returns permission refusal without queuing', async () => {
    const denial = Response.json({ error: 'denied' }, { status: 403 })
    state.permission.mockResolvedValue({ ok: false, response: denial })
    expect(
      await POST(request(), { params: Promise.resolve({ id: 'quote' }) })
    ).toBe(denial)
    expect(state.delivery).not.toHaveBeenCalled()
  })
  it('preserves obligation error and generic error envelopes', async () => {
    state.delivery.mockRejectedValue(
      new PaymentRequestError(409, 'Unavailable')
    )
    const a = await POST(request(), {
      params: Promise.resolve({ id: 'quote' }),
    })
    expect(a.status).toBe(409)
    expect(await a.json()).toEqual({ error: 'Unavailable' })
    state.delivery.mockRejectedValue(new Error('private'))
    const b = await POST(request(), {
      params: Promise.resolve({ id: 'quote' }),
    })
    expect(b.status).toBe(500)
    expect(await b.json()).toEqual({
      error: 'Não foi possível solicitar o envio',
    })
  })
})

describe.each([
  ['legacy', responseHandler(quoteLegacy)],
  ['service', responseHandler(quoteService)],
] as const)('%s legacy localized quotation alias', (_host, POST) => {
  it('adapts only 201 without changing total representation', async () => {
    const r = await POST(request())
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({
      success: true,
      data: { id: 'saved', totalValue: '12.30', status: 'PENDING' },
      message:
        'Orçamento criado com sucesso! Entraremos em contato em até 2 horas úteis.',
    })
  })
  it('passes through unsuccessful quote responses exactly', async () => {
    const refusal = Response.json({ error: 'out of stock' }, { status: 409 })
    state.quote.mockResolvedValue(refusal)
    expect(await POST(request())).toBe(refusal)
  })
})

describe.each([
  ['legacy', selectLegacy, clearLegacy],
  ['service', selectService, clearService],
] as const)('%s company preference mutation', (_host, POST, DELETE) => {
  it('authenticates before malformed body and clears preference on missing session', async () => {
    state.session.mockResolvedValue(null)
    const r = await POST(request('{'))
    expect(r.status).toBe(401)
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(state.membership).not.toHaveBeenCalled()
  })
  it('selects only the caller membership, ignoring a body role', async () => {
    const r = await POST(request({ tenantId: 'local', role: 'ADMIN' }))
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.selection.role).toBe('CLIENT')
    expect(r.headers.get('set-cookie')).toContain('selected-tenant-id=local')
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(r.headers.get('vary')).toBe('Cookie, x-tenant-id')
    expect(state.membership.mock.calls[0]![0].where).toMatchObject({
      userId: 'user',
      tenantId: 'local',
      status: 'ACTIVE',
      organization: { status: 'ACTIVE' },
    })
  })
  it.each([
    {},
    null,
    { tenantId: '' },
    { tenantId: '../foreign' },
    { tenantId: 3 },
  ])('rejects invalid preference without lookup %#', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(state.membership).not.toHaveBeenCalled()
  })
  it('does not grant preference for an absent or inactive membership', async () => {
    state.membership.mockResolvedValue(null)
    expect((await POST(request({ tenantId: 'foreign' }))).status).toBe(403)
  })
  it('requires JSON for POST but DELETE clears without reading malformed input or SQL', async () => {
    expect(
      (
        await POST(
          request({ tenantId: 'local' }, 'POST', {
            'Content-Type': 'text/plain',
          })
        )
      ).status
    ).toBe(415)
    const r = await DELETE(request('{', 'DELETE'))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ selection: null })
    expect(r.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(state.membership).not.toHaveBeenCalled()
  })
  it('clears securely in production and returns generic 503 on membership outage', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const r = await DELETE(request())
    expect(r.headers.get('set-cookie')).toContain('; Secure')
    state.membership.mockRejectedValue(new Error('private SQL'))
    const failure = await POST(request({ tenantId: 'local' }))
    expect(failure.status).toBe(503)
    expect(await failure.json()).toEqual({
      error: 'Organization selection unavailable',
    })
  })
})
