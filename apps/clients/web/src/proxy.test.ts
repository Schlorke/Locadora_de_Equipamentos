// Ponto de leitura do ambiente do proxy (achados 1 e 24 da revisão): `WEB_API_ORIGIN` é requisito do processo web,
// não do contrato comum. Em produção, sem ela, o proxy falha fechado (503) em qualquer página, não só nas APIs.
import { NextRequest } from 'next/server'
import { getRewrittenUrl, isRewrite } from 'next/experimental/testing/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'segredo-de-borda-de-teste-com-mais-de-32-caracteres'
const A = 'https://locadora-a.plataforma.example'

async function freshProxy() {
  vi.resetModules()
  return (await import('./proxy')).default
}

function request(url: string) {
  return new NextRequest(url, { headers: { host: new URL(url).host } })
}

beforeEach(() => {
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'plataforma.example')
  vi.stubEnv('PLATFORM_EDGE_SECRET', SECRET)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('PLATFORM_LABS_ENABLED', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('proxy: ambiente do processo web', () => {
  it('produção sem WEB_API_ORIGIN: 503 também nas páginas (falha fechada no web)', async () => {
    vi.stubEnv('WEB_API_ORIGIN', '')
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const proxy = await freshProxy()
    const page = await proxy(request(A + '/equipamentos'))
    expect(page.status).toBe(503)
    expect(page.headers.get('content-type')).toContain('text/html')
    expect((await proxy(request(A + '/api/categories'))).status).toBe(503)
    expect(JSON.stringify(log.mock.calls)).toContain('WEB_API_ORIGIN')
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET)
  })

  it('produção com WEB_API_ORIGIN em http: 503 (a origem do backend é validada no web)', async () => {
    vi.stubEnv('WEB_API_ORIGIN', 'http://backend.example')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const proxy = await freshProxy()
    expect((await proxy(request(A + '/equipamentos'))).status).toBe(503)
  })

  it('produção completa: página reescrita para a locadora e API repassada ao backend', async () => {
    vi.stubEnv('WEB_API_ORIGIN', 'https://backend.example')
    const card = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'x-site-mode': 'LIVE', 'x-site-indexable': 'true' } })
    )
    const proxy = await freshProxy()
    const page = await proxy(request(A + '/equipamentos'))
    expect(isRewrite(page)).toBe(true)
    expect(getRewrittenUrl(page)).toBe(A + '/locadora-a/equipamentos')
    expect(page.status).toBe(200)
    // S13: o modo do site vem do cartão público do backend, na origem privada e sem cache.
    expect(card).toHaveBeenCalledExactlyOnceWith(
      'https://backend.example/api/public/tenants/locadora-a',
      expect.objectContaining({ cache: 'no-store' })
    )
    const api = await proxy(request(A + '/api/categories'))
    expect(getRewrittenUrl(api)).toBe('https://backend.example/api/categories?tenantSlug=locadora-a')
    expect(card).toHaveBeenCalledOnce()
  })

  it('produção completa: vitrine em pausa vira a página de pausa com 503 real (S13)', async () => {
    vi.stubEnv('WEB_API_ORIGIN', 'https://backend.example')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'x-site-mode': 'PAUSED', 'x-site-indexable': 'false' } })
    )
    const proxy = await freshProxy()
    const page = await proxy(request(A + '/equipamentos?categoria=andaimes'))
    expect(isRewrite(page)).toBe(true)
    expect(getRewrittenUrl(page)).toBe(A + '/locadora-a/site-pausado?categoria=andaimes')
    expect(page.status).toBe(503)
    expect(page.headers.get('retry-after')).toBe('3600')
    expect(page.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('produção completa: vitrine sem cartão (404 do D10) vai ao 404 neutro; a área do cliente segue para a locadora (S13)', async () => {
    vi.stubEnv('WEB_API_ORIGIN', 'https://backend.example')
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'better-auth')
    const card = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"error":"Locadora não encontrada"}', { status: 404 }))
    const proxy = await freshProxy()
    const page = await proxy(request(A + '/orcamento'))
    expect(isRewrite(page)).toBe(true)
    expect(getRewrittenUrl(page)).toBe(A + '/_')
    const account = await proxy(request(A + '/area-cliente'))
    expect(getRewrittenUrl(account)).toBe(A + '/locadora-a/area-cliente')
    expect(card).toHaveBeenCalledOnce()
  })
})
