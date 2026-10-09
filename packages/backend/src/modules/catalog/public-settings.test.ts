import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  PUBLIC_SETTINGS_FIELDS,
  PublicLegalIdentitySchema,
} from '@gb-locacoes/contracts/settings'
import { createPublicCatalog } from './public'
import {
  publicBusinessHours,
  publicLegalAvailability,
  publicLegalIdentity,
  publicSeoText,
  publicSiteContent,
} from './public-settings'

// Achado 147: a vitrine volta a ter o horário de funcionamento e o CNPJ da PRÓPRIA locadora, lidos das configurações e
// da organização dela; nunca um padrão de outra locadora, um CPF ou o documento cru.

/** O horário que o script da GB grava (tools/gb-site-settings.mjs). */
const HORARIO_DO_SCRIPT = {
  monday: { open: '08:00', close: '18:00', closed: false },
  tuesday: { open: '08:00', close: '18:00', closed: false },
  wednesday: { open: '08:00', close: '18:00', closed: false },
  thursday: { open: '08:00', close: '18:00', closed: false },
  friday: { open: '08:00', close: '18:00', closed: false },
  saturday: { open: '08:00', close: '12:00', closed: false },
  sunday: { closed: true },
}

describe('publicBusinessHours', () => {
  it('mantém o horário do painel e do script, dia a dia', () => {
    expect(publicBusinessHours(HORARIO_DO_SCRIPT)).toEqual(HORARIO_DO_SCRIPT)
  })

  it('dia fechado vence as horas; hora inválida, dia desconhecido e campo extra ficam de fora', () => {
    expect(
      publicBusinessHours({
        monday: { open: ' 07:30 ', close: '17:00' },
        tuesday: { open: '8:00', close: '18:00', closed: false },
        wednesday: { open: '08:00', close: '24:00' },
        thursday: { closed: true, open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00', note: 'fixture-private' },
        holiday: { closed: true },
      })
    ).toEqual({
      monday: { closed: false, open: '07:30', close: '17:00' },
      thursday: { closed: true },
      friday: { closed: false, open: '08:00', close: '18:00' },
    })
  })

  it('sem nenhum dia válido (o padrão {} do banco, texto, lista, null): null, sem horário padrão', () => {
    for (const raw of [
      {},
      null,
      undefined,
      'Seg-Sex 8h',
      [],
      { monday: 'aberto' },
    ])
      expect(publicBusinessHours(raw), JSON.stringify(raw)).toBeNull()
  })
})

describe('publicLegalIdentity', () => {
  it('CNPJ válido da organização, formatado; o normalizado do cadastro vem antes do legado', () => {
    expect(
      publicLegalIdentity({
        legalName: '  Locadora Nova Ltda ',
        documentNormalized: '11222333000181',
        document: '11.444.777/0001-61',
      })
    ).toEqual({ legalName: 'Locadora Nova Ltda', cnpj: '11.222.333/0001-81' })
    expect(
      publicLegalIdentity({
        legalName: null,
        documentNormalized: null,
        document: '11.444.777/0001-61',
      })
    ).toEqual({ legalName: null, cnpj: '11.444.777/0001-61' })
  })

  it('aceita o CNPJ alfanumérico', () => {
    expect(
      publicLegalIdentity({
        legalName: null,
        documentNormalized: '12ABC34501DE35',
        document: null,
      }).cnpj
    ).toBe('12.ABC.345/01DE-35')
  })

  it('CPF, CNPJ inválido, vazio ou organização ausente: nenhum documento sai', () => {
    for (const document of [
      '529.982.247-25',
      '11222333000180',
      '00000000000000',
      '  ',
      null,
    ])
      expect(
        publicLegalIdentity({
          legalName: null,
          documentNormalized: document,
          document,
        }),
        String(document)
      ).toEqual({ legalName: null, cnpj: null })
    expect(publicLegalIdentity(null)).toEqual({ legalName: null, cnpj: null })
    expect(
      publicLegalIdentity({
        legalName: '   ',
        documentNormalized: null,
        document: null,
      })
    ).toEqual({ legalName: null, cnpj: null })
  })

  it('o resultado sempre cumpre o contrato público', () => {
    const identity = publicLegalIdentity({
      legalName: 'x'.repeat(300),
      documentNormalized: '11222333000181',
      document: null,
    })
    expect(PublicLegalIdentitySchema.safeParse(identity).success).toBe(true)
    expect(identity.legalName).toHaveLength(200)
  })
})

describe('getPublicSettings (composição na transação da locadora)', () => {
  const setup = (
    setting: Record<string, unknown> | null,
    organization: Record<string, unknown> | null
  ) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      setting: { findFirst: vi.fn().mockResolvedValue(setting) },
      organization: { findUnique: vi.fn().mockResolvedValue(organization) },
    }
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) =>
        operation(tx)
      ),
    } as unknown as PrismaClient
    return { tx, catalog: createPublicCatalog(prisma) }
  }

  it('devolve os dez campos de contato mais o horário e a identificação legal, nada do documento cru', async () => {
    const { tx, catalog } = setup(
      {
        companyPhone: '(41) 3000-0000',
        whatsappNumber: '',
        contactEmail: 'contato@locadora-nova.example.test',
        companyAddress: 'Rua A, 1',
        companyIconUrl: '',
        marketingEmail: '',
        aboutUsText: '',
        socialLinks: {},
        heroCarousel: [],
        waveAnimation: 'animated',
        businessHours: HORARIO_DO_SCRIPT,
      },
      {
        legalName: 'Locadora Nova Ltda',
        documentNormalized: '11222333000181',
        document: null,
      }
    )
    const settings = await catalog.getPublicSettings({
      tenantId: 'tenant-nova',
    })
    expect(Object.keys(settings!).sort()).toEqual(
      [
        'companyPhone',
        'whatsappNumber',
        'contactEmail',
        'companyAddress',
        'companyIconUrl',
        'marketingEmail',
        'aboutUsText',
        'socialLinks',
        'heroCarousel',
        'waveAnimation',
        'businessHours',
        'legalIdentity',
        'siteContent',
        'legalDocuments',
        'seoTitle',
        'seoDescription',
      ].sort()
    )
    expect(settings!.businessHours).toEqual(HORARIO_DO_SCRIPT)
    // Linha sem título nem descrição SEO: null (a vitrine monta o título com o nome do cartão da locadora).
    expect(settings!.seoTitle).toBeNull()
    expect(settings!.seoDescription).toBeNull()
    // Sem conteúdo nem documento publicado: objeto vazio e nenhum texto legal disponível.
    expect(settings!.siteContent).toEqual({})
    expect(settings!.legalDocuments).toEqual({
      terms: false,
      privacy: false,
      returnPolicy: false,
    })
    expect(settings!.legalIdentity).toEqual({
      legalName: 'Locadora Nova Ltda',
      cnpj: '11.222.333/0001-81',
    })
    expect(JSON.stringify(settings)).not.toContain('11222333000181')
    // Mesma locadora nas duas leituras, só as colunas da identificação legal.
    expect(tx.setting.findFirst.mock.calls[0]![0].where).toEqual({
      tenantId: 'tenant-nova',
    })
    expect(tx.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-nova' },
      select: { legalName: true, documentNormalized: true, document: true },
    })
  })

  it('coluna fora do contrato não sai, mesmo que a consulta a traga', async () => {
    const { catalog } = setup(
      {
        contactEmail: 'contato@locadora-nova.example.test',
        smtpConfig: { password: 'fixture-private' },
        customJs: 'fixture-private',
        tenantId: 'tenant-nova',
        businessHours: {},
      },
      null
    )
    const settings = await catalog.getPublicSettings({
      tenantId: 'tenant-nova',
    })
    expect(Object.keys(settings!)).toEqual([...PUBLIC_SETTINGS_FIELDS])
    expect(JSON.stringify(settings)).not.toMatch(/fixture-private|tenant-nova/)
    expect(settings!.businessHours).toBeNull()
    expect(settings!.legalIdentity).toEqual({ legalName: null, cnpj: null })
  })

  it('sem configurações: null (409 da rota) e a organização nem é lida', async () => {
    const { tx, catalog } = setup(null, {
      legalName: 'X',
      documentNormalized: null,
      document: null,
    })
    expect(
      await catalog.getPublicSettings({ tenantId: 'tenant-nova' })
    ).toBeNull()
    expect(tx.organization.findUnique).not.toHaveBeenCalled()
  })
})

// Onda 134 (lote vitrine-conteúdo): conteúdo institucional e disponibilidade dos textos legais na leitura pública.
describe('publicSiteContent', () => {
  it('mantém o conteúdo válido e descarta só a chave inválida, registrando só o nome', () => {
    const report = vi.fn()
    expect(
      publicSiteContent(
        {
          experienceYears: 10,
          fleetSize: -3,
          googleMerchantId: 'fixture-private-merchant',
          featuredClients: ['Construtora Alfa'],
          futuro: 'ignorado',
        },
        report
      )
    ).toEqual({ experienceYears: 10, featuredClients: ['Construtora Alfa'] })
    expect(report).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith(['fleetSize', 'googleMerchantId'])
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/fixture-private|-3/)
  })

  it('o padrão {} do banco, texto, lista ou null: objeto vazio, sem registro', () => {
    const report = vi.fn()
    for (const raw of [{}, null, undefined, 'texto', []])
      expect(publicSiteContent(raw, report), JSON.stringify(raw)).toEqual({})
    expect(report).not.toHaveBeenCalled()
  })
})

describe('publicLegalAvailability', () => {
  it('cada documento publicado pela data da publicação, sem ler o texto', () => {
    expect(
      publicLegalAvailability({
        termsPublishedAt: new Date('2026-10-06T12:00:00Z'),
        privacyPublishedAt: null,
        returnPolicyPublishedAt: new Date('2026-10-06T12:00:00Z'),
      })
    ).toEqual({ terms: true, privacy: false, returnPolicy: true })
    expect(
      publicLegalAvailability({
        termsPublishedAt: null,
        privacyPublishedAt: null,
        returnPolicyPublishedAt: null,
      })
    ).toEqual({ terms: false, privacy: false, returnPolicy: false })
  })
})

describe('publicSeoText (onda 135, A4)', () => {
  it('apara, junta numa linha e troca controle por espaço; vazio ou que não é texto: null', () => {
    expect(publicSeoText('  Locadora Nova | Andaimes em Curitiba  ')).toBe(
      'Locadora Nova | Andaimes em Curitiba'
    )
    expect(publicSeoText('Locadora\nNova\t\u202eAndaimes\u0000')).toBe(
      'Locadora Nova Andaimes'
    )
    for (const raw of ['', '   ', '\n\t', null, undefined, 12, {}, []])
      expect(publicSeoText(raw), JSON.stringify(raw)).toBeNull()
  })
})

describe('getPublicSettings com o SEO da locadora (onda 135, A4)', () => {
  it('lê o título e a descrição da própria linha, na transação da locadora, e os devolve normalizados', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      setting: {
        findFirst: vi.fn().mockResolvedValue({
          businessHours: {},
          siteContent: {},
          seoTitle: '  Locadora Nova  |  Andaimes ',
          seoDescription: 'Locação de andaimes\nem Curitiba.',
          termsPublishedAt: null,
          privacyPublishedAt: null,
          returnPolicyPublishedAt: null,
        }),
      },
      organization: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) =>
        operation(tx)
      ),
    } as unknown as PrismaClient
    const settings = await createPublicCatalog(prisma).getPublicSettings({
      tenantId: 'tenant-nova',
    })
    expect(settings!.seoTitle).toBe('Locadora Nova | Andaimes')
    expect(settings!.seoDescription).toBe('Locação de andaimes em Curitiba.')
    const query = tx.setting.findFirst.mock.calls[0]![0]
    expect(query.where).toEqual({ tenantId: 'tenant-nova' })
    expect(query.select).toMatchObject({ seoTitle: true, seoDescription: true })
    // O resto do que o painel guarda continua fora da consulta pública.
    for (const privado of [
      'analyticsTrackingId',
      'customJs',
      'customCss',
      'smtpConfig',
    ])
      expect(query.select).not.toHaveProperty(privado)
  })
})

describe('getPublicSettings com conteúdo e textos legais', () => {
  const linha = {
    contactEmail: 'contato@locadora-nova.example.test',
    businessHours: {},
    siteContent: {
      experienceYears: 12,
      clientsServed: 0,
      commitments: { support24h: true },
    },
    termsPublishedAt: new Date('2026-10-06T12:00:00Z'),
    privacyPublishedAt: null,
    returnPolicyPublishedAt: null,
  }

  it('conteúdo por chave e disponibilidade pelas datas; os textos não são selecionados', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      setting: { findFirst: vi.fn().mockResolvedValue(linha) },
      organization: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) =>
        operation(tx)
      ),
    } as unknown as PrismaClient
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const settings = await createPublicCatalog(prisma).getPublicSettings({
      tenantId: 'tenant-nova',
    })
    expect(settings!.siteContent).toEqual({
      experienceYears: 12,
      commitments: { support24h: true },
    })
    expect(settings!.legalDocuments).toEqual({
      terms: true,
      privacy: false,
      returnPolicy: false,
    })
    const select = tx.setting.findFirst.mock.calls[0]![0].select
    expect(select).toMatchObject({
      siteContent: true,
      termsPublishedAt: true,
      privacyPublishedAt: true,
      returnPolicyPublishedAt: true,
    })
    for (const texto of [
      'termsDocument',
      'privacyDocument',
      'returnPolicyDocument',
    ])
      expect(select).not.toHaveProperty(texto)
    // A chave inválida é registrada com a locadora e o nome, nunca com o valor.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls)).toContain('clientsServed')
    expect(JSON.stringify(warn.mock.calls)).toContain('tenant-nova')
    expect(JSON.stringify(warn.mock.calls)).not.toContain(':0')
    warn.mockRestore()
  })
})

describe('getPublicLegalDocument (transação da locadora, só a coluna do documento)', () => {
  const documento = {
    version: 1,
    lastUpdated: '13 de Fevereiro de 2026',
    sections: [
      {
        id: 'contato',
        title: 'Contato',
        blocks: [{ type: 'paragraph', text: 'Fale conosco.' }],
      },
    ],
  }
  const setup = (row: Record<string, unknown> | null) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      setting: { findFirst: vi.fn().mockResolvedValue(row) },
    }
    const prisma = {
      $transaction: vi.fn((operation: (client: typeof tx) => unknown) =>
        operation(tx)
      ),
    } as unknown as PrismaClient
    return { tx, prisma, catalog: createPublicCatalog(prisma) }
  }

  it.each([
    ['terms', 'termsDocument', 'termsPublishedAt'],
    ['privacy', 'privacyDocument', 'privacyPublishedAt'],
    ['returnPolicy', 'returnPolicyDocument', 'returnPolicyPublishedAt'],
  ] as const)(
    '%s: lê só o documento e a data, com o contexto da locadora',
    async (kind, documentColumn, dateColumn) => {
      const { tx, prisma, catalog } = setup({
        [documentColumn]: documento,
        [dateColumn]: new Date('2026-10-06T12:00:00.000Z'),
      })
      expect(
        await catalog.getPublicLegalDocument({ tenantId: 'tenant-nova' }, kind)
      ).toEqual({
        kind,
        document: documento,
        publishedAt: '2026-10-06T12:00:00.000Z',
      })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      // set_config('app.tenant_id', …) da transação da locadora antes da leitura.
      expect(tx.$queryRaw).toHaveBeenCalled()
      expect(JSON.stringify(tx.$queryRaw.mock.calls[0])).toContain(
        'tenant-nova'
      )
      expect(tx.setting.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-nova' },
        select: { [documentColumn]: true, [dateColumn]: true },
      })
    }
  )

  it('sem configurações ou sem documento: null', async () => {
    expect(
      await setup(null).catalog.getPublicLegalDocument(
        { tenantId: 'tenant-nova' },
        'terms'
      )
    ).toBeNull()
    expect(
      await setup({
        termsDocument: null,
        termsPublishedAt: null,
      }).catalog.getPublicLegalDocument({ tenantId: 'tenant-nova' }, 'terms')
    ).toBeNull()
  })

  it('documento fora do contrato no banco: null e registro sem o texto', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    for (const invalido of [
      { ...documento, sections: [] },
      { ...documento, version: 2 },
      { html: '<p>fixture-private</p>' },
    ])
      expect(
        await setup({
          privacyDocument: invalido,
          privacyPublishedAt: new Date('2026-10-06T12:00:00Z'),
        }).catalog.getPublicLegalDocument(
          { tenantId: 'tenant-nova' },
          'privacy'
        )
      ).toBeNull()
    expect(warn).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('fixture-private')
    warn.mockRestore()
  })
})
