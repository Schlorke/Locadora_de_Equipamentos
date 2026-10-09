import { describe, expect, it } from 'vitest'
import { medicaoDaLocadora, tagDoGoogle } from './medicao'

// Onda 135, A11 (decisão do dono D4): a vitrine só injeta identificadores válidos da própria locadora num modelo fixo.
const GA = 'G-5ABCDE1234'
const ADS = 'AW-123456789'
const GOOGLE = 'abcDEF0123456789_-xyzABCDEFGHIJ012345678'
const META = 'abcdefghij0123456789abcdefghij'

describe('medicaoDaLocadora', () => {
  it('lê só as quatro chaves de medição e verificação do siteContent, cada uma pelo contrato', () => {
    expect(
      medicaoDaLocadora({
        googleAnalyticsId: GA,
        googleAdsId: ADS,
        googleSiteVerification: GOOGLE,
        facebookDomainVerification: META,
        googleMerchantId: '123456789',
        experienceYears: 10,
      })
    ).toEqual({
      googleAnalyticsId: GA,
      googleAdsId: ADS,
      googleSiteVerification: GOOGLE,
      facebookDomainVerification: META,
    })
  })

  it('identificador fora do formato, código ou ausência: fica de fora', () => {
    expect(
      medicaoDaLocadora({
        googleAnalyticsId: "G-ABC');fetch('//x');//",
        googleAdsId: '<script>alert(1)</script>',
        googleSiteVerification: 'curto',
        facebookDomainVerification: 'COM MAIUSCULA E ESPACO 1234567',
      })
    ).toEqual({})
    for (const vazio of [undefined, null, 'texto', [], {}])
      expect(medicaoDaLocadora(vazio), JSON.stringify(vazio)).toEqual({})
  })
})

describe('tagDoGoogle', () => {
  it('sem GA4 nem Ads: nada é injetado (só verificação não carrega o gtag.js)', () => {
    expect(tagDoGoogle({})).toBeNull()
    expect(
      tagDoGoogle({
        googleSiteVerification: GOOGLE,
        facebookDomainVerification: META,
      })
    ).toBeNull()
  })

  it('GA4 e Ads: o gtag.js leva o ID do Ads e cada ID ganha um config, como a raiz legada fazia', () => {
    const tag = tagDoGoogle({ googleAnalyticsId: GA, googleAdsId: ADS })!
    expect(tag.src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=AW-123456789'
    )
    expect(tag.configuracao.split('\n')).toEqual([
      'window.dataLayer = window.dataLayer || [];',
      'function gtag(){dataLayer.push(arguments);}',
      "gtag('js', new Date());",
      `gtag('config', "${GA}");`,
      `gtag('config', "${ADS}");`,
    ])
  })

  it('só GA4: o gtag.js leva o ID do GA4', () => {
    const tag = tagDoGoogle({ googleAnalyticsId: GA })!
    expect(tag.src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-5ABCDE1234'
    )
    expect(tag.configuracao).toContain(`gtag('config', "${GA}");`)
    expect(tag.configuracao).not.toContain('AW-')
  })

  it('revalida o formato: um ID adulterado depois da leitura não chega ao script', () => {
    expect(
      tagDoGoogle({ googleAnalyticsId: "G-ABC'); alert(1); ('" })
    ).toBeNull()
    const tag = tagDoGoogle({
      googleAnalyticsId: GA,
      googleAdsId: 'AW-1"); alert(1); ("',
    })!
    expect(tag.src).toContain('id=G-5ABCDE1234')
    expect(tag.configuracao).not.toContain('alert')
  })
})
