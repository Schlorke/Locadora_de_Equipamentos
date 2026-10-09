import { describe, expect, it } from 'vitest'
import {
  SITE_CONTENT_COMMITMENTS,
  SITE_CONTENT_KEYS,
  SITE_MEASUREMENT_KEYS,
  SettingsSchema,
  SiteContentSchema,
} from './settings'

// Onda 134 (lote vitrine-conteúdo): conteúdo institucional por locadora, gravado pelo painel no `PUT /api/admin/settings`
// (decisão do dono de 2026-10-06, ADR adr-saas-subscription B.18, item 2). Escrita estrita: chave desconhecida, valor
// fora do limite ou caractere de controle recusam o corpo inteiro.
const valido = {
  experienceYears: 10,
  fleetSize: 200,
  clientsServed: 500,
  projectsCompleted: 500,
  citiesServed: 50,
  featuredClients: ['Construtora Alfa', 'Incorporadora Beta'],
  history: 'Começamos com poucos equipamentos e muita vontade de atender bem.',
  timeline: [
    { year: 2014, title: 'Fundação', description: 'Início das atividades.' },
  ],
  footerHighlights: ['Andaimes', 'Betoneiras'],
  commitments: { certifiedEquipment: true, support24h: false },
  storeLocation: {
    latitude: -25.4284,
    longitude: -49.2733,
    placeId: 'ChIJ_exemplo-0123456789',
    addressLine1: 'Rua Exemplo, 100',
    addressLine2: 'Centro, Curitiba/PR',
  },
  googleMerchantId: '123456789',
  reviews: {
    rating: 4.7,
    count: 31,
    sourceName: 'Google',
    sourceUrl: 'https://g.page/r/exemplo',
  },
}

describe('SiteContentSchema (escrita)', () => {
  it('aceita o conteúdo completo e o objeto vazio; apara os textos', () => {
    expect(SiteContentSchema.parse(valido)).toEqual(valido)
    expect(SiteContentSchema.parse({})).toEqual({})
    expect(
      SiteContentSchema.parse({ history: '  Texto da locadora.  ' })
    ).toEqual({ history: 'Texto da locadora.' })
  })

  it('as chaves do contrato são exatamente as do inventário (§2.2)', () => {
    expect([...SITE_CONTENT_KEYS].sort()).toEqual(
      [
        'experienceYears',
        'fleetSize',
        'clientsServed',
        'projectsCompleted',
        'citiesServed',
        'featuredClients',
        'history',
        'timeline',
        'footerHighlights',
        'commitments',
        'storeLocation',
        'googleMerchantId',
        'reviews',
        // Onda 135, A11: medição e verificação da locadora.
        'googleAnalyticsId',
        'googleAdsId',
        'googleSiteVerification',
        'facebookDomainVerification',
      ].sort()
    )
    expect(SITE_CONTENT_KEYS).toEqual(
      expect.arrayContaining([...SITE_MEASUREMENT_KEYS])
    )
  })

  it('recusa chave desconhecida, inclusive dentro de cada objeto', () => {
    for (const invalido of [
      { aboutUs: 'x' },
      { commitments: { freeShipping: true } },
      { storeLocation: { ...valido.storeLocation, zoom: 15 } },
      { reviews: { ...valido.reviews, best: 5 } },
      { timeline: [{ ...valido.timeline[0], icon: 'star' }] },
    ])
      expect(
        SiteContentSchema.safeParse(invalido).success,
        JSON.stringify(invalido)
      ).toBe(false)
  })

  it.each([
    ['experienceYears', 0],
    ['experienceYears', 151],
    ['experienceYears', 10.5],
    ['experienceYears', '10'],
    ['fleetSize', 0],
    ['fleetSize', 1_000_001],
    ['clientsServed', -1],
    ['projectsCompleted', 1.5],
    ['citiesServed', Number.NaN],
  ] as const)('número fora do limite: %s = %s', (campo, valor) => {
    expect(SiteContentSchema.safeParse({ [campo]: valor }).success).toBe(false)
  })

  it('aceita os limites dos números', () => {
    for (const [campo, valor] of [
      ['experienceYears', 1],
      ['experienceYears', 150],
      ['fleetSize', 1],
      ['fleetSize', 1_000_000],
      ['citiesServed', 1_000_000],
    ] as const)
      expect(SiteContentSchema.safeParse({ [campo]: valor }).success).toBe(true)
  })

  it('listas e textos: tamanho mínimo e máximo, sem texto vazio', () => {
    const texto = (n: number) => 'a'.repeat(n)
    for (const [conteudo, aceito] of [
      [{ featuredClients: [] }, false],
      [{ featuredClients: Array(12).fill('Alfa') }, true],
      [{ featuredClients: Array(13).fill('Alfa') }, false],
      [{ featuredClients: [texto(80)] }, true],
      [{ featuredClients: [texto(81)] }, false],
      [{ featuredClients: ['   '] }, false],
      [{ history: texto(1500) }, true],
      [{ history: texto(1501) }, false],
      [{ history: '' }, false],
      [{ footerHighlights: Array(8).fill('Andaimes') }, true],
      [{ footerHighlights: Array(9).fill('Andaimes') }, false],
      [{ footerHighlights: [texto(61)] }, false],
      [{ timeline: [] }, false],
      [{ timeline: Array(12).fill(valido.timeline[0]) }, true],
      [{ timeline: Array(13).fill(valido.timeline[0]) }, false],
      [{ timeline: [{ ...valido.timeline[0], year: 1899 }] }, false],
      [{ timeline: [{ ...valido.timeline[0], year: 2101 }] }, false],
      [{ timeline: [{ ...valido.timeline[0], title: texto(81) }] }, false],
      [
        { timeline: [{ ...valido.timeline[0], description: texto(241) }] },
        false,
      ],
    ] as const)
      expect(
        SiteContentSchema.safeParse(conteudo).success,
        JSON.stringify(conteudo).slice(0, 80)
      ).toBe(aceito)
  })

  // Cada caractere proibido, com os dois extremos de cada faixa: C0 (U+0000–U+001F), DEL e C1 (U+007F–U+009F), os
  // separadores de linha e de parágrafo (U+2028, U+2029), os controles de direção embutidos (U+202A–U+202E) e os
  // isolamentos de direção LRI, RLI, FSI e PDI (U+2066–U+2069), que invertem a leitura de um trecho como os embutidos.
  // O título do caso traz o ponto de código, nunca o caractere (um isolamento de direção no relatório o embaralharia).
  const pontoDeCodigo = (codigo: number) =>
    `U+${codigo.toString(16).toUpperCase().padStart(4, '0')}`
  it.each(
    [
      0x0000, 0x0009, 0x000a, 0x001f, 0x007f, 0x0080, 0x0085, 0x009f, 0x2028,
      0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
      0x2069,
    ].map((codigo) => ({
      ponto: pontoDeCodigo(codigo),
      controle: String.fromCharCode(codigo),
    }))
  )(
    'recusa o caractere de controle $ponto no meio do texto',
    ({ controle }) => {
      expect(
        SiteContentSchema.safeParse({ history: `Texto${controle}fim` }).success
      ).toBe(false)
      expect(
        SiteContentSchema.safeParse({ featuredClients: [`A${controle}B`] })
          .success
      ).toBe(false)
    }
  )

  // Na primeira e na última posição (o ataque de direção clássico põe o U+202E antes do texto), o texto também é
  // recusado: o `.trim()` não remove estes caracteres, e a checagem passa por todo o texto aparado, pontas inclusive.
  it.each(
    [
      0x0000, 0x001f, 0x007f, 0x0080, 0x0085, 0x009f, 0x202a, 0x202b, 0x202c,
      0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
    ].map((codigo) => ({
      ponto: pontoDeCodigo(codigo),
      controle: String.fromCharCode(codigo),
    }))
  )(
    'recusa o caractere de controle $ponto no início e no fim do texto',
    ({ controle }) => {
      for (const texto of [`${controle}Texto`, `Texto${controle}`]) {
        expect(SiteContentSchema.safeParse({ history: texto }).success).toBe(
          false
        )
        expect(
          SiteContentSchema.safeParse({ featuredClients: [texto] }).success
        ).toBe(false)
      }
    }
  )

  // Já tabulação, quebras de linha e os separadores U+2028 e U+2029 nas pontas são espaço para o `.trim()`: saem antes
  // da checagem, e o que se grava é o texto aparado, sem o caractere.
  it.each(
    [0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x2028, 0x2029].map((codigo) => ({
      ponto: pontoDeCodigo(codigo),
      espaco: String.fromCharCode(codigo),
    }))
  )('apara $ponto nas pontas do texto', ({ espaco }) => {
    expect(
      SiteContentSchema.parse({ history: `${espaco}Texto${espaco}` }).history
    ).toBe('Texto')
  })

  // Os vizinhos de cada faixa são texto comum e passam: espaço, til, espaço sem quebra (U+00A0), ponto de hifenização
  // (U+2027), espaço estreito sem quebra (U+202F), por mil (U+2030), os dois vizinhos dos isolamentos de direção (U+2065,
  // sem atribuição, e U+206A, o primeiro dos formatos obsoletos, que não mudam a direção) e o zero sobrescrito (U+2070).
  it.each(
    [
      0x0020, 0x007e, 0x00a0, 0x2027, 0x202f, 0x2030, 0x2065, 0x206a, 0x2070,
    ].map((codigo) => ({
      ponto: pontoDeCodigo(codigo),
      comum: String.fromCharCode(codigo),
    }))
  )(
    'aceita o caractere comum $ponto, vizinho das faixas proibidas',
    ({ comum }) => {
      expect(
        SiteContentSchema.parse({ history: `Texto${comum}fim` }).history
      ).toBe(`Texto${comum}fim`)
    }
  )

  it('os 11 compromissos comerciais, todos booleanos opcionais (§2.3)', () => {
    expect([...SITE_CONTENT_COMMITMENTS]).toEqual([
      'certifiedEquipment',
      'freeDelivery',
      'fastDelivery',
      'sameDayDelivery',
      'ownLogistics',
      'equipmentTracking',
      'support24h',
      'flexibleScheduling',
      'freeConsulting',
      'responseWithin24h',
      'fastResponseGuaranteed',
    ])
    const todos = Object.fromEntries(
      SITE_CONTENT_COMMITMENTS.map((chave) => [chave, true])
    )
    expect(SiteContentSchema.parse({ commitments: todos })).toEqual({
      commitments: todos,
    })
    expect(
      SiteContentSchema.safeParse({ commitments: { support24h: 'sim' } })
        .success
    ).toBe(false)
  })

  it('local da loja: coordenadas no intervalo, Place ID e endereço', () => {
    const local = valido.storeLocation
    for (const [patch, aceito] of [
      [{}, true],
      [{ latitude: -90, longitude: 180 }, true],
      [{ latitude: 90.0001 }, false],
      [{ longitude: -180.5 }, false],
      [{ latitude: Number.POSITIVE_INFINITY }, false],
      [{ placeId: undefined }, true],
      [{ placeId: 'curto' }, false],
      [{ placeId: 'ChIJ com espaço 0123' }, false],
      [{ addressLine2: undefined }, true],
      [{ addressLine1: '' }, false],
      [{ addressLine1: 'a'.repeat(121) }, false],
    ] as const)
      expect(
        SiteContentSchema.safeParse({ storeLocation: { ...local, ...patch } })
          .success,
        JSON.stringify(patch)
      ).toBe(aceito)
  })

  it('Merchant Center: só dígitos, sem zero à esquerda, 6 a 15 dígitos, como texto', () => {
    for (const [id, aceito] of [
      ['123456', true],
      ['123456789012345', true],
      ['12345', false],
      ['1234567890123456', false],
      ['0123456', false],
      ['12345a7', false],
    ] as const)
      expect(
        SiteContentSchema.safeParse({ googleMerchantId: id }).success,
        id
      ).toBe(aceito)
    expect(
      SiteContentSchema.safeParse({ googleMerchantId: 123456789 }).success
    ).toBe(false)
  })

  it('medição e verificação: só o identificador no formato de cada serviço, nunca código (onda 135, A11)', () => {
    const casos: Array<[string, unknown, boolean]> = [
      ['googleAnalyticsId', 'G-5ABCDE1234', true],
      ['googleAnalyticsId', 'G-ABCD', true],
      ['googleAnalyticsId', 'G-' + 'A'.repeat(16), true],
      ['googleAnalyticsId', 'G-' + 'A'.repeat(17), false],
      ['googleAnalyticsId', 'g-5abcde1234', false],
      ['googleAnalyticsId', 'UA-123456-1', false],
      ['googleAnalyticsId', 'GTM-ABC123', false],
      ['googleAnalyticsId', "G-ABC');alert(1);//", false],
      ['googleAdsId', 'AW-123456789', true],
      ['googleAdsId', 'AW-12345', false],
      ['googleAdsId', 'AW-1234567890123456', false],
      ['googleAdsId', 'AW-12345678A', false],
      ['googleAdsId', 'G-123456789', false],
      [
        'googleSiteVerification',
        'abcDEF0123456789_-xyzABCDEFGHIJ012345678',
        true,
      ],
      ['googleSiteVerification', 'curto', false],
      ['googleSiteVerification', 'a'.repeat(101), false],
      [
        'googleSiteVerification',
        '<meta name="google-site-verification" content="x">',
        false,
      ],
      ['googleSiteVerification', 'abc def 0123456789012345', false],
      ['facebookDomainVerification', 'abcdefghij0123456789abcdefghij', true],
      ['facebookDomainVerification', 'ABCDEFGHIJ0123456789abcdefghij', false],
      ['facebookDomainVerification', 'abc', false],
      ['facebookDomainVerification', 'abcdefghij0123456789"onload="x', false],
      ['facebookDomainVerification', 123456789, false],
    ]
    for (const [chave, valor, aceito] of casos)
      expect(
        SiteContentSchema.safeParse({ [chave]: valor }).success,
        `${chave}=${String(valor)}`
      ).toBe(aceito)
  })

  it('nota de avaliações só com fonte nomeada e link https (decisão D-A)', () => {
    const nota = valido.reviews
    for (const [patch, aceito] of [
      [{}, true],
      [{ rating: 5 }, true],
      [{ rating: 1 }, true],
      [{ rating: 0.9 }, false],
      [{ rating: 5.1 }, false],
      [{ rating: 4.75 }, false],
      [{ count: 0 }, false],
      [{ count: 2.5 }, false],
      [{ sourceName: 'G' }, false],
      [{ sourceName: undefined }, false],
      [{ sourceUrl: undefined }, false],
      [{ sourceUrl: 'http://g.page/r/exemplo' }, false],
      [{ sourceUrl: 'javascript:alert(1)' }, false],
      [{ sourceUrl: 'https://usuario:senha@g.page/r/x' }, false],
      [{ sourceUrl: 'https://' + 'a'.repeat(500) }, false],
      [
        { sourceUrl: 'https://www.google.com/maps/place/?q=x#avaliacoes' },
        true,
      ],
    ] as const)
      expect(
        SiteContentSchema.safeParse({ reviews: { ...nota, ...patch } }).success,
        JSON.stringify(patch)
      ).toBe(aceito)
  })

  it('o maior conteúdo aceito cabe no CHECK de 65.536 bytes da coluna', () => {
    const emoji = '\u{1F600}'
    const maximo = SiteContentSchema.parse({
      ...valido,
      featuredClients: Array(12).fill(emoji.repeat(40)),
      history: emoji.repeat(750),
      timeline: Array(12).fill({
        year: 2100,
        title: emoji.repeat(40),
        description: emoji.repeat(120),
      }),
      footerHighlights: Array(8).fill(emoji.repeat(30)),
      commitments: Object.fromEntries(
        SITE_CONTENT_COMMITMENTS.map((chave) => [chave, true])
      ),
      googleAnalyticsId: 'G-' + 'A'.repeat(16),
      googleAdsId: 'AW-' + '1'.repeat(15),
      googleSiteVerification: 'a'.repeat(100),
      facebookDomainVerification: 'a'.repeat(64),
    })
    // jsonb::text acrescenta um espaço depois de cada ":" e ","; dobrar a conta cobre essa folga com sobra.
    expect(
      new TextEncoder().encode(JSON.stringify(maximo)).length * 2
    ).toBeLessThan(65_536)
  })
})

describe('SettingsSchema com siteContent (PUT /api/admin/settings)', () => {
  const base = {
    seoTitle: 'Locadora Nova',
    seoDescription: 'Locação de equipamentos',
    themeColorPrimary: '#ea580c',
  }

  it('o PUT antigo (sem siteContent e com horário legado) continua válido', () => {
    const antigo = {
      ...base,
      businessHours: {
        monday: { open: '8h', close: '18h', closed: false },
        sunday: { closed: true },
      },
    }
    const parsed = SettingsSchema.parse(antigo)
    expect(parsed).not.toHaveProperty('siteContent')
    expect(parsed.businessHours?.monday).toEqual({
      open: '8h',
      close: '18h',
      closed: false,
    })
  })

  it('aceita siteContent válido e recusa o corpo com siteContent inválido', () => {
    expect(
      SettingsSchema.parse({ ...base, siteContent: valido }).siteContent
    ).toEqual(valido)
    expect(
      SettingsSchema.safeParse({
        ...base,
        siteContent: { experienceYears: 0 },
      }).success
    ).toBe(false)
    expect(SettingsSchema.safeParse({ ...base, siteContent: [] }).success).toBe(
      false
    )
  })
})
