import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'

const db = vi.hoisted(() => ({
  lookup: vi.fn(),
  organization: vi.fn(),
  setting: vi.fn(),
  transaction: vi.fn(),
  tenantSetting: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: db.lookup },
    $transaction: db.transaction,
  },
}))
vi.mock('@/lib/application-session', () => ({ getServerSession: vi.fn() }))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      organization: { findUnique: db.lookup },
      $transaction: db.transaction,
    },
  }),
}))
import { GET as legacy } from '@/app/api/public/tenants/[slug]/route'
import { GET as service } from '../../apps/services/api/src/app/api/public/tenants/[slug]/route'

beforeEach(() => {
  vi.resetAllMocks()
  db.lookup.mockResolvedValue({
    id: 'tenant-alfa',
    status: 'ACTIVE',
    ...LIVE_SITE,
  })
  db.organization.mockResolvedValue({
    slug: 'alfa',
    name: 'Alfa',
    city: ' Porto Alegre ',
    state: ' rs ',
    status: 'ACTIVE',
  })
  db.setting.mockResolvedValue({
    companyIconUrl: 'https://assets.example.test/logo.svg',
  })
  db.transaction.mockImplementation((operation) =>
    operation({
      $queryRaw: db.tenantSetting,
      organization: { findUnique: db.organization },
      setting: { findFirst: db.setting },
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())
const request = () => new Request('http://api.test/api/public/tenants/alfa')
const params = () => ({ params: Promise.resolve({ slug: 'alfa' }) })

describe.each([
  ['legado', legacy],
  ['serviço', service],
] as const)('%s — cartão público/erros', (_host, handler) => {
  it('normaliza o DTO sem dados privados e consulta o logo dentro da transação tenant', async () => {
    const response = await handler(request(), params())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      slug: 'alfa',
      name: 'Alfa',
      city: 'Porto Alegre',
      state: 'RS',
      logoUrl: 'https://assets.example.test/logo.svg',
    })
    expect(db.tenantSetting.mock.calls[0]![1]).toBe('tenant-alfa')
    expect(db.organization).toHaveBeenCalledWith({
      where: { id: 'tenant-alfa' },
      select: {
        slug: true,
        name: true,
        city: true,
        state: true,
        status: true,
      },
    })
    expect(db.setting).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-alfa' },
      select: { companyIconUrl: true },
    })
  })
  it.each([
    null,
    { slug: 'alfa', name: 'Alfa', status: 'SUSPENDED' },
    { slug: 'bravo', name: 'Alfa', status: 'ACTIVE' },
    { slug: 'alfa', name: ' ', status: 'ACTIVE' },
  ])(
    'organização removida ou alterada durante a leitura mantém 404 neutro',
    async (row) => {
      db.organization.mockResolvedValue(row)
      const response = await handler(request(), params())
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Locadora não encontrada',
      })
      expect(response.headers.get('cache-control')).toBe('no-store')
    }
  )
  it.each([
    'http://assets.example.test/logo.svg',
    'https://user:password@assets.example.test/logo.svg',
    'invalid',
  ])('logo não publicável %s vira null', async (logo) => {
    db.setting.mockResolvedValue({ companyIconUrl: logo })
    const response = await handler(request(), params())
    expect(response.status).toBe(200)
    expect((await response.json()).logoUrl).toBeNull()
  })
  it.each(['lookup', 'organization', 'setting'] as const)(
    'falha em %s mantém mensagem genérica e status',
    async (stage) => {
      db[stage].mockRejectedValue(new Error('fixture-private-database-error'))
      const response = await handler(request(), params())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao buscar locadora',
      })
    }
  )
})
