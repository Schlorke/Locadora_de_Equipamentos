import { describe, expect, it } from 'vitest'
import { linkDoMapa, localDaLoja } from './local-da-loja'

// Mapa e JSON-LD só com o local que a própria locadora declarou (onda 134).
const conteudo = {
  storeLocation: {
    latitude: -25.4284,
    longitude: -49.2733,
    placeId: 'ChIJ_exemplo-0123456789',
    addressLine1: 'Rua Exemplo, 100',
    addressLine2: 'Curitiba, PR, Brazil',
  },
}

describe('localDaLoja', () => {
  it('local completo no formato do localizador do Google, com o nome do cartão', () => {
    expect(localDaLoja(conteudo, ' Locadora Nova ')).toEqual({
      title: 'Locadora Nova',
      address1: 'Rua Exemplo, 100',
      address2: 'Curitiba, PR, Brazil',
      coords: { lat: -25.4284, lng: -49.2733 },
      placeId: 'ChIJ_exemplo-0123456789',
    })
  })

  it('sem Place ID e sem a segunda linha: as chaves ficam de fora', () => {
    expect(
      localDaLoja(
        {
          storeLocation: {
            latitude: 1,
            longitude: 2,
            addressLine1: 'Rua A, 1',
          },
        },
        'Locadora Nova'
      )
    ).toEqual({
      title: 'Locadora Nova',
      address1: 'Rua A, 1',
      coords: { lat: 1, lng: 2 },
    })
  })

  it('sem local ou sem nome: nenhum mapa', () => {
    expect(localDaLoja({}, 'Locadora Nova')).toBeNull()
    expect(localDaLoja(null, 'Locadora Nova')).toBeNull()
    expect(localDaLoja(conteudo, '  ')).toBeNull()
    expect(localDaLoja(conteudo, null)).toBeNull()
  })
})

describe('linkDoMapa', () => {
  it('o link da produção com as coordenadas da própria locadora', () => {
    expect(linkDoMapa(conteudo)).toBe(
      'https://www.google.com/maps?q=-25.4284,-49.2733&hl=pt-BR'
    )
    expect(linkDoMapa({})).toBeNull()
  })
})
