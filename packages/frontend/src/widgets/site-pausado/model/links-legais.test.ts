// Links legais da moldura da pausa (onda 134, S13): os documentos que a locadora publicou e a Política de Cookies da
// plataforma, na ordem do rodapé da vitrine. Documento não publicado não tem link (a página dá 404).
import { describe, expect, it } from 'vitest'
import { linksLegaisDaPausa } from './links-legais'

describe('linksLegaisDaPausa', () => {
  it('todos publicados: Privacidade, Termos, Cookies e Devolução', () => {
    expect(
      linksLegaisDaPausa({ terms: true, privacy: true, returnPolicy: true })
    ).toEqual([
      { href: '/privacidade', rotulo: 'Privacidade' },
      { href: '/termos', rotulo: 'Termos' },
      { href: '/cookies', rotulo: 'Cookies' },
      { href: '/politica-devolucao', rotulo: 'Devolução' },
    ])
  })

  it('sem documento publicado (ou sem a leitura): só Cookies', () => {
    expect(
      linksLegaisDaPausa({ terms: false, privacy: false, returnPolicy: false })
    ).toEqual([{ href: '/cookies', rotulo: 'Cookies' }])
    expect(linksLegaisDaPausa(null)).toEqual([
      { href: '/cookies', rotulo: 'Cookies' },
    ])
    expect(linksLegaisDaPausa({ terms: true } as never)).toEqual([
      { href: '/termos', rotulo: 'Termos' },
      { href: '/cookies', rotulo: 'Cookies' },
    ])
  })
})
