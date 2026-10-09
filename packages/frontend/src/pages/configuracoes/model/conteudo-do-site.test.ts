// Formulário do conteúdo institucional e dos compromissos no painel (onda 134, B10): ida e volta sem perda com o
// contrato (`siteContent`), campos vazios ficam ausentes (omissão na vitrine) e o erro aponta o campo.
import { describe, expect, it } from 'vitest'
import {
  conteudoDoFormulario,
  conteudoParaSalvar,
  medicaoDoFormulario,
  type ConteudoDoFormulario,
} from './conteudo-do-site'

const vazio = () => conteudoDoFormulario({})

// Locadora de teste com todos os campos do contrato preenchidos. A ida e volta do conteúdo da GB (o que o script grava)
// está em tests/unit/gb-site-content.painel.test.ts.
const COMPLETO = {
  experienceYears: 7,
  fleetSize: 120,
  clientsServed: 1500,
  projectsCompleted: 320,
  citiesServed: 12,
  featuredClients: ['Construtora Alfa', 'Incorporadora Beta'],
  history: 'A Locadora Teste começou com dez betoneiras.',
  timeline: [
    { year: 2019, title: 'Fundação', description: 'Primeiro galpão.' },
    {
      year: 2023,
      title: 'Segunda loja',
      description: 'Atendimento no litoral.',
    },
  ],
  footerHighlights: ['Betoneiras', 'Andaimes'],
  commitments: { support24h: true, freeConsulting: true },
  storeLocation: {
    latitude: -23.55,
    longitude: -46.63,
    placeId: 'place-id-de-teste-0001',
    addressLine1: 'Rua de Teste, 10',
    addressLine2: 'Cidade Teste, UF',
  },
  googleMerchantId: '123456',
  reviews: {
    rating: 4.5,
    count: 30,
    sourceName: 'Fonte Teste',
    sourceUrl: 'https://avaliacoes.example.test/locadora',
  },
}

describe('conteúdo do site no painel', () => {
  it('ida e volta sem perda: todos os campos do contrato voltam iguais ao salvar', () => {
    const form = conteudoDoFormulario(COMPLETO)
    expect(form.experienceYears).toBe('7')
    expect(form.featuredClients).toBe('Construtora Alfa\nIncorporadora Beta')
    expect(form.commitments.support24h).toBe(true)
    expect(form.commitments.freeDelivery).toBe(false)
    expect(conteudoParaSalvar(form)).toEqual({ conteudo: COMPLETO, erros: {} })
  })

  it('Locadora Nova: formulário vazio salva o objeto vazio (nenhum compromisso ligado)', () => {
    const form = vazio()
    expect(Object.values(form.commitments).every((ligado) => !ligado)).toBe(
      true
    )
    expect(conteudoParaSalvar(form)).toEqual({ conteudo: {}, erros: {} })
  })

  it('números com separador de milhar, vírgula decimal e listas uma por linha', () => {
    const form: ConteudoDoFormulario = {
      ...vazio(),
      clientsServed: '1.200',
      latitude: '-25,4284',
      longitude: '-49,2733',
      addressLine1: 'Rua A, 10',
      footerHighlights: ' Andaimes \n\nBetoneiras\n',
      reviewsRating: '4,7',
      reviewsCount: '52',
      reviewsSourceName: 'Google',
      reviewsSourceUrl: 'https://g.example.test/locadora',
      timeline: [
        { year: '2019', title: 'Começo', description: 'Primeiros andaimes' },
        { year: '', title: '', description: '' },
      ],
    }
    form.commitments = { ...form.commitments, freeDelivery: true }
    expect(conteudoParaSalvar(form)).toEqual({
      conteudo: {
        clientsServed: 1200,
        footerHighlights: ['Andaimes', 'Betoneiras'],
        timeline: [
          { year: 2019, title: 'Começo', description: 'Primeiros andaimes' },
        ],
        commitments: { freeDelivery: true },
        storeLocation: {
          latitude: -25.4284,
          longitude: -49.2733,
          addressLine1: 'Rua A, 10',
        },
        reviews: {
          rating: 4.7,
          count: 52,
          sourceName: 'Google',
          sourceUrl: 'https://g.example.test/locadora',
        },
      },
      erros: {},
    })
  })

  it('erros por campo: fora do limite, nota sem fonte (D-A), local sem endereço e marco incompleto', () => {
    const form: ConteudoDoFormulario = {
      ...vazio(),
      experienceYears: '200',
      fleetSize: 'muitos',
      reviewsRating: '4.8',
      latitude: '-25.4',
      googleMerchantId: '12ab',
      timeline: [{ year: '2019', title: '', description: 'Sem título' }],
    }
    const { conteudo, erros } = conteudoParaSalvar(form)
    expect(conteudo).toBeNull()
    expect(Object.keys(erros).sort()).toEqual([
      'experienceYears',
      'fleetSize',
      'googleMerchantId',
      'reviews',
      'storeLocation',
      'timeline',
    ])
    expect(erros.reviews).toContain('fonte')
  })
})

// Onda 135, A11 (decisão do dono D4): medição e verificação da locadora na seção "SEO & Meta Tags" do painel, gravadas no
// mesmo `siteContent`. Só o identificador; o código de verificação pode vir colado na meta inteira.
describe('medição e verificação no painel (onda 135, A11)', () => {
  const GA = 'G-5ABCDE1234'
  const ADS = 'AW-123456789'
  const GOOGLE = 'abcDEF0123456789_-xyzABCDEFGHIJ012345678'
  const META = 'abcdefghij0123456789abcdefghij'

  it('ida e volta sem perda com os quatro identificadores e o resto do conteúdo', () => {
    const conteudo = {
      ...COMPLETO,
      googleAnalyticsId: GA,
      googleAdsId: ADS,
      googleSiteVerification: GOOGLE,
      facebookDomainVerification: META,
    }
    const form = conteudoDoFormulario(conteudo)
    expect(medicaoDoFormulario(form)).toEqual({
      googleAnalyticsId: GA,
      googleAdsId: ADS,
      googleSiteVerification: GOOGLE,
      facebookDomainVerification: META,
    })
    expect(conteudoParaSalvar(form)).toEqual({ conteudo, erros: {} })
  })

  it('aceita a meta inteira colada do Search Console e da Meta, e apara os IDs', () => {
    const form = {
      ...vazio(),
      googleAnalyticsId: `  ${GA} `,
      googleSiteVerification: `<meta name="google-site-verification" content="${GOOGLE}" />`,
      facebookDomainVerification: `<meta name='facebook-domain-verification' content='${META}'>`,
    }
    expect(conteudoParaSalvar(form)).toEqual({
      conteudo: {
        googleAnalyticsId: GA,
        googleSiteVerification: GOOGLE,
        facebookDomainVerification: META,
      },
      erros: {},
    })
  })

  it('identificador fora do formato ou código: erro no próprio campo, nada é salvo', () => {
    const { conteudo, erros } = conteudoParaSalvar({
      ...vazio(),
      googleAnalyticsId: 'UA-1234-5',
      googleAdsId: "AW-1');alert(1);//",
      googleSiteVerification: '<script>alert(1)</script>',
      facebookDomainVerification: 'COM MAIUSCULA',
    })
    expect(conteudo).toBeNull()
    expect(Object.keys(erros).sort()).toEqual([
      'facebookDomainVerification',
      'googleAdsId',
      'googleAnalyticsId',
      'googleSiteVerification',
    ])
    expect(erros.googleAnalyticsId).toMatch(/G-/)
    expect(erros.googleAdsId).toMatch(/AW-/)
  })
})
