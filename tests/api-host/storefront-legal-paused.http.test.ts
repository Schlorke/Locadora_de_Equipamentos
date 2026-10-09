import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { requestWeb, startWebConsumer } from './web-consumer'
import { startReceivingAccountFixture } from './receiving-account'
import { legacyRunning } from './targets'

/**
 * Onda 134 (lote vitrine-conteúdo, B9; decisão do dono de 2026-10-06, item 4; S13): prova HTTP real do host web
 * compilado (`next start`) contra os dois hosts de API num banco descartável próprio, com a fiscalização da assinatura
 * `on`. Com a locadora em pausa (acesso RESTRICTED e site publicado), as páginas legais continuam no ar (200, noindex,
 * sem cache, moldura neutra) e o resto da vitrine segue na página de pausa (503 com Retry-After). Com o site desligado
 * (não publicado), a página legal é o mesmo 404 da locadora desconhecida (D10).
 */
const original = inject('apiParity')
let fixture: Awaited<ReturnType<typeof startReceivingAccountFixture>>

const TERMOS = {
  version: 1,
  lastUpdated: '2 de março de 2026',
  sections: [
    {
      id: 'uso',
      title: 'Uso do Site',
      blocks: [
        { type: 'paragraph', text: 'Texto dos Termos da locadora pausada.' },
      ],
    },
  ],
}

const paused = () => fixture.owners[0]!
const off = () => fixture.owners[1]!

beforeAll(async () => {
  fixture = await startReceivingAccountFixture(original, {
    env: { PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'on' },
  })
  const scope = createPlatformScope(fixture.platform)
  // Configurações e Termos publicados da locadora pausada (o superusuário do banco descartável cria a linha).
  await fixture.prisma.setting.create({
    data: {
      tenantId: paused().tenantId,
      termsDocument: TERMOS,
      termsPublishedAt: new Date('2026-03-02T12:00:00.000Z'),
    },
  })
  await scope.withPlatformTransaction((tx) =>
    tx.organization.update({
      where: { id: paused().tenantId },
      data: { access: 'RESTRICTED', sitePublishedAt: new Date() },
    })
  )
  // A segunda locadora fica com o site desligado (nunca publicado): OFF.
  await scope.withPlatformTransaction((tx) =>
    tx.organization.update({
      where: { id: off().tenantId },
      data: { access: 'FULL', sitePublishedAt: null },
    })
  )
}, 240000)

afterAll(async () => {
  await fixture?.stop()
})

// A fixture própria sobe a raiz legada só quando a rodada a tem (API_LEGACY_MODE=absent: só a API; onda 135, E1).
describe.each([
  ['API compartilhada', () => fixture.context.api] as const,
  ...(legacyRunning(original)
    ? [['raiz legada', () => fixture.context.legacy!] as const]
    : []),
])('host web compilado -> %s', (_name, target) => {
  let web: Awaited<ReturnType<typeof startWebConsumer>>
  beforeAll(async () => {
    web = await startWebConsumer(fixture.context, target())
  }, 90000)
  afterAll(async () => {
    await web?.stop()
  })
  const get = (slug: string, pathname: string) =>
    requestWeb(web.origin + pathname, {
      headers: { Host: `${slug}.platform.test` },
      redirect: 'manual',
    })

  it('em pausa: /termos e /cookies no ar com 200, noindex, sem cache e a moldura neutra', async () => {
    const termos = await get(paused().tenantId, '/termos')
    expect(termos.status).toBe(200)
    expect(termos.headers.get('x-robots-tag')).toBe('noindex')
    expect(termos.headers.get('cache-control')).toContain('no-store')
    expect(termos.headers.get('retry-after')).toBeNull()
    const html = await termos.text()
    expect(html).toContain('Texto dos Termos da locadora pausada.')
    expect(html).toContain('2 de março de 2026')
    expect(html).toContain('aria-label="Documentos legais"')
    expect(html).not.toContain('Site temporariamente indisponível')
    const cookies = await get(paused().tenantId, '/cookies')
    expect(cookies.status).toBe(200)
    expect(cookies.headers.get('x-robots-tag')).toBe('noindex')
    expect(cookies.headers.get('cache-control')).toContain('no-store')
    expect(await cookies.text()).toContain('Política de Cookies')
  })

  it('em pausa: documento não publicado é 404 dentro da locadora (não 503 nem o texto de outra)', async () => {
    const privacidade = await get(paused().tenantId, '/privacidade')
    expect(privacidade.status).toBe(404)
    expect(await privacidade.text()).not.toContain(
      'Texto dos Termos da locadora pausada.'
    )
  })

  it.each(['/', '/orcamento', '/equipamentos'])(
    'em pausa: %s segue na página de pausa com 503 e Retry-After',
    async (pathname) => {
      const response = await get(paused().tenantId, pathname)
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('3600')
      expect(response.headers.get('x-robots-tag')).toBe('noindex')
      expect(await response.text()).toContain(
        'Site temporariamente indisponível'
      )
    }
  )

  it('site desligado: /termos é o mesmo 404 da locadora desconhecida', async () => {
    const desligado = await get(off().tenantId, '/termos')
    const desconhecida = await get('locadora-inexistente-134', '/termos')
    expect(desligado.status).toBe(404)
    expect(desconhecida.status).toBe(404)
    expect(await desligado.text()).toBe(await desconhecida.text())
  })
})
