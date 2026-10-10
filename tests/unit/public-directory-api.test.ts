import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ counter: vi.fn(), organizations: vi.fn() }))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      platformRateLimit: { upsert: db.counter },
      organization: { findMany: db.organizations },
    },
  }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/public/tenants/route'

const secret = 'local-directory-parity-secret-0123456789'
const edgeSecret = 'local-directory-edge-secret-0123456789'
const ip = '2001:db8:abc:def::1'
const edge = (address: string | null = ip) => ({
  'x-platform-edge-auth': edgeSecret,
  'x-platform-host-kind': 'apex',
  'x-platform-origin': 'https://platform.test',
  ...(address ? { 'x-platform-client-ip': address } : {}),
})
const request = (query: string, headers: Record<string, string> = edge()) =>
  new Request(`http://api.test/api/public/tenants${query}`, { headers })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv('PLATFORM_EDGE_SECRET', edgeSecret)
  vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', secret)
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('TRUSTED_PROXY_HOPS', '')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-01T00:00:00.250Z'))
  db.counter.mockResolvedValue({ count: 1 })
  db.organizations.mockResolvedValue([
    { slug: 'alfa', name: ' Alfa ', city: ' Porto Alegre ', state: ' rs ' },
  ])
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe.each([['serviço', service]] as const)(
  '%s — busca do diretório',
  (_host, handler) => {
    it.each([
      '',
      '?q=ab',
      '?q=abc&q=def',
      '?q=abc&page=1',
      '?q=%00%00%00',
      `?q=${'x'.repeat(81)}`,
    ])('query inválida %s recusa antes de contar/buscar', async (query) => {
      const response = await handler(request(query))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Informe apenas q, com 3 a 80 caracteres.',
        code: 'INVALID_QUERY',
      })
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(db.counter).not.toHaveBeenCalled()
      expect(db.organizations).not.toHaveBeenCalled()
    })
    it('consome contador atômico antes da busca e devolve somente a projeção pública', async () => {
      const response = await handler(request('?q=%20Alfa%20'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        results: [
          { slug: 'alfa', name: 'Alfa', city: 'Porto Alegre', state: 'RS' },
        ],
      })
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
      expect(db.counter.mock.invocationCallOrder[0]).toBeLessThan(
        db.organizations.mock.invocationCallOrder[0]!
      )
      const hit = db.counter.mock.calls[0]![0]
      expect(hit.where.key).toMatch(
        /^directory-search:ip:[a-f0-9]{32}:31557600$/
      )
      expect(hit.create).toEqual({
        key: hit.where.key,
        count: 1,
        expiresAt: new Date('2030-01-01T00:01:00Z'),
      })
      expect(hit.update).toEqual({ count: { increment: 1 } })
      expect(hit.select).toEqual({ count: true })
      expect(db.organizations).toHaveBeenCalledWith({
        where: {
          directoryListed: true,
          status: 'ACTIVE',
          name: { contains: 'Alfa', mode: 'insensitive' },
        },
        select: { slug: true, name: true, city: true, state: true },
        orderBy: [{ name: 'asc' }, { slug: 'asc' }],
        take: 10,
      })
    })
    it('31º consumo recusa antes da busca e conserva Retry-After arredondado', async () => {
      db.counter.mockResolvedValue({ count: 31 })
      const response = await handler(request('?q=Alfa'))
      expect(response.status).toBe(429)
      expect(await response.json()).toEqual({
        error: 'Muitas buscas. Tente novamente em instantes.',
        code: 'RATE_LIMITED',
      })
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('retry-after')).toBe('60')
      expect(db.organizations).not.toHaveBeenCalled()
    })
    it.each(['counter', 'organizations'] as const)(
      'falha em %s conserva 500 genérico e no-store',
      async (stage) => {
        db[stage].mockRejectedValue(new Error('fixture-private-database-error'))
        const response = await handler(request('?q=Alfa'))
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao buscar locadoras',
        })
        expect(response.headers.get('cache-control')).toBe('no-store')
        if (stage === 'counter') expect(db.organizations).not.toHaveBeenCalled()
      }
    )
    it('segredo ausente em produção recusa sem contar, pesquisar ou expor valor', async () => {
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', '')
      const response = await handler(request('?q=Alfa'))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        error: 'Erro ao buscar locadoras',
      })
      expect(db.counter).not.toHaveBeenCalled()
      expect(db.organizations).not.toHaveBeenCalled()
    })
    it('preview sem segredo usa o critério da plataforma e não o NODE_ENV', async () => {
      vi.stubEnv('PLATFORM_ENV', 'preview')
      vi.stubEnv('VERCEL_ENV', 'preview')
      vi.stubEnv('PLATFORM_RATE_LIMIT_SECRET', '')
      expect((await handler(request('?q=Alfa'))).status).toBe(200)
      expect(db.counter).toHaveBeenCalledOnce()
    })
    it.each([
      [
        {
          ...edge(null),
          'x-real-ip': '198.18.1.1',
          'x-forwarded-for': '198.18.1.2',
        },
      ],
      [
        {
          ...edge(),
          'x-platform-edge-auth': 'forged',
          'x-real-ip': '198.18.1.1',
          'x-forwarded-for': '198.18.1.2',
        },
      ],
    ])(
      'IP ausente na borda ou cabeçalhos forjados compartilham unknown',
      async (headers) => {
        expect((await handler(request('?q=Alfa', headers))).status).toBe(200)
        expect(db.counter.mock.calls[0]![0].where.key).toBe(
          'directory-search:ip:unknown:31557600'
        )
      }
    )
    it('IP da borda é canônico /64 e não é substituído por forwarded headers', async () => {
      await handler(
        request('?q=Alfa', {
          ...edge(),
          'x-real-ip': '198.18.1.1',
          'x-forwarded-for': '198.18.1.2',
        })
      )
      const first = db.counter.mock.calls[0]![0].where.key
      await handler(request('?q=Alfa', edge('2001:0db8:0abc:0def::2')))
      expect(db.counter.mock.calls[1]![0].where.key).toBe(first)
      expect(first).not.toContain('unknown')
      expect(first).not.toContain(ip)
    })
  }
)
