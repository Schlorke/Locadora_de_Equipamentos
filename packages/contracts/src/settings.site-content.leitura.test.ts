import { describe, expect, it } from 'vitest'
import { parsePublicSiteContent } from './settings'

// Leitura tolerante do conteúdo institucional (§2.1 do plano da onda 134): o backend e a vitrine descartam só a chave
// inválida e ignoram a desconhecida, para que um dado antigo ou um campo novo não escondam o conteúdo inteiro (app
// instalado diante de um campo que ainda não conhece).
describe('parsePublicSiteContent', () => {
  it('conteúdo válido sai igual, sem chave inválida', () => {
    const conteudo = {
      experienceYears: 10,
      featuredClients: ['Construtora Alfa'],
      commitments: { certifiedEquipment: true, freeDelivery: false },
    }
    expect(parsePublicSiteContent(conteudo)).toEqual({
      content: conteudo,
      invalidKeys: [],
    })
  })

  it('descarta só a chave inválida e registra o nome dela', () => {
    expect(
      parsePublicSiteContent({
        experienceYears: 0,
        clientsServed: 500,
        googleMerchantId: 5721,
        history: 'História da locadora.',
      })
    ).toEqual({
      content: { clientsServed: 500, history: 'História da locadora.' },
      invalidKeys: ['experienceYears', 'googleMerchantId'],
    })
  })

  it('ignora chave desconhecida (no topo e dentro dos objetos) sem apagar o resto', () => {
    expect(
      parsePublicSiteContent({
        experienceYears: 12,
        novoCampoDoFuturo: { qualquer: 'coisa' },
        storeLocation: {
          latitude: -25.4,
          longitude: -49.2,
          addressLine1: 'Rua Exemplo, 100',
          zoom: 15,
        },
        commitments: { support24h: true, novoCompromisso: true },
      })
    ).toEqual({
      content: {
        experienceYears: 12,
        storeLocation: {
          latitude: -25.4,
          longitude: -49.2,
          addressLine1: 'Rua Exemplo, 100',
        },
        commitments: { support24h: true },
      },
      invalidKeys: [],
    })
  })

  it('compromisso com valor que não é booleano sai sozinho; os outros ficam', () => {
    expect(
      parsePublicSiteContent({
        commitments: { support24h: 'sim', freeDelivery: true },
      })
    ).toEqual({
      content: { commitments: { freeDelivery: true } },
      invalidKeys: ['commitments.support24h'],
    })
  })

  it('medição: só o identificador inválido sai, com o nome registrado; os válidos ficam (onda 135, A11)', () => {
    const { content, invalidKeys } = parsePublicSiteContent({
      googleAnalyticsId: 'G-5ABCDE1234',
      googleAdsId: '<script>alert(1)</script>',
      googleSiteVerification: 'abcDEF0123456789_-xyzABCDEFGHIJ012345678',
      facebookDomainVerification: 'abcdefghij0123456789abcdefghij',
      customJs: 'alert(1)',
    })
    expect(content).toEqual({
      googleAnalyticsId: 'G-5ABCDE1234',
      googleSiteVerification: 'abcDEF0123456789_-xyzABCDEFGHIJ012345678',
      facebookDomainVerification: 'abcdefghij0123456789abcdefghij',
    })
    expect(invalidKeys).toEqual(['googleAdsId'])
  })

  it('nota de avaliações sem fonte é inválida (nunca aparece sem a fonte)', () => {
    expect(
      parsePublicSiteContent({ reviews: { rating: 4.8, count: 127 } })
    ).toEqual({ content: {}, invalidKeys: ['reviews'] })
  })

  it.each([null, undefined, 'texto', 42, [], [{ experienceYears: 10 }]])(
    'raiz fora de objeto (%j): conteúdo vazio',
    (raiz) => {
      expect(parsePublicSiteContent(raiz).content).toEqual({})
    }
  )
})
