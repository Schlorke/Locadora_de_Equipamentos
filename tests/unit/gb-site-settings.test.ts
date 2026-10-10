// Script de corte das configurações da GB (tools/gb-site-settings.mjs; achado 143 da onda 132). Simulação por padrão,
// --apply explícito, só preenche campo vazio, idempotente, nunca imprime a URL do banco; no banco descartável, roda
// também com um papel restrito (sem BYPASSRLS), provando o contexto da locadora sob a RLS de settings. Segunda rodada:
// o --apply só grava na organização com o CNPJ da GB (slug de outra locadora gravava os dados da GB no site dela).
// Onda 134 (lote vitrine-conteúdo): também o conteúdo institucional chave a chave e os três textos legais, com a
// organização travada (FOR UPDATE, o lock do painel) antes da leitura, escrita condicional dos documentos e a linha de
// audit_logs; nunca a frota (D-B) nem a nota de avaliações (D-A). Segunda rodada da onda 134: uma vez por campo. Cada
// --apply registra os campos conferidos (GB_SITE_SETTINGS_APPLIED, só nomes) e uma execução seguinte não volta a eles,
// nem ao texto legal que o dono publicou ou retirou: rodar de novo depois do corte religava os compromissos desligados,
// regravava chaves apagadas e republicava a Privacidade despublicada pelo dono.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  GB_BUSINESS_HOURS,
  GB_PUBLIC_SETTINGS,
  GB_SETTINGS_APPLIED_ACTION,
  GB_SOCIAL_LINKS,
  checkGbOrganization,
  gbLegalDigest,
  handledGbFields,
  parseGbSettingsArguments,
  planGbSettings,
  runGbSiteSettings,
  runGbSiteSettingsCli,
} from '../../tools/gb-site-settings.mjs'
import {
  GB_LEGAL_DOCUMENTS,
  GB_SITE_CONTENT,
  GB_SITE_CONTENT_PENDING,
} from '../../tools/gb-site-content.mjs'
import { publicLegalIdentity } from '../../packages/backend/src/modules/catalog/public-settings'
import { storefrontLegalDigest } from '../../packages/backend/src/modules/catalog/admin-settings'
import { requireTestDatabase } from '../helpers/test-database'
import { createLoginRole } from '../helpers/database-roles'
import { alterSharedAcl } from '../helpers/shared-acl'

/** Os nomes que um --apply confere (`checked`), na ordem do plano: campos, redes, horário, conteúdo e textos legais. */
const TODOS_OS_CAMPOS = [
  ...Object.keys(GB_PUBLIC_SETTINGS),
  ...Object.keys(GB_SOCIAL_LINKS).map((rede) => 'socialLinks.' + rede),
  'businessHours',
  ...Object.keys(GB_SITE_CONTENT).map((chave) => 'siteContent.' + chave),
  'legal.terms',
  'legal.privacy',
  'legal.returnPolicy',
]

describe('gb-site-settings: argumentos e plano', () => {
  it.each([
    [[]],
    [['--apply']],
    [['--slug=gb', '--slug=gb']],
    [['--slug=GB']],
    [['--slug=gb', '--apply', '--apply']],
    [['--slug=gb', '--force']],
  ])('recusa argumentos inválidos: %j', (args) => {
    expect(() => parseGbSettingsArguments(args)).toThrow(
      'GB_SETTINGS_ARGUMENTS_INVALID'
    )
  })

  it('simulação por padrão; --apply só explícito', () => {
    expect(parseGbSettingsArguments(['--slug=gb-locacoes'])).toEqual({
      apply: false,
      slug: 'gb-locacoes',
    })
    expect(parseGbSettingsArguments(['--apply', '--slug=gb'])).toEqual({
      apply: true,
      slug: 'gb',
    })
  })

  it('sem linha de configurações: cria com todos os valores da GB e os três textos legais', () => {
    const plan = planGbSettings(null)
    expect(plan.create).toBe(true)
    expect(plan.data).toEqual({
      ...GB_PUBLIC_SETTINGS,
      socialLinks: { ...GB_SOCIAL_LINKS },
      businessHours: { ...GB_BUSINESS_HOURS },
      siteContent: GB_SITE_CONTENT,
    })
    expect(plan.siteContentKeys).toEqual(Object.keys(GB_SITE_CONTENT).sort())
    expect(plan.legalDocuments).toEqual(['terms', 'privacy', 'returnPolicy'])
    // Tudo conferido nesta execução, e tudo gravado (os textos legais entram na auditoria um a um).
    expect(plan.checked).toEqual(TODOS_OS_CAMPOS)
    expect(plan.written).toEqual(
      TODOS_OS_CAMPOS.filter((nome) => !nome.startsWith('legal.'))
    )
  })

  it('conteúdo institucional chave a chave: o que o dono gravou fica, só a chave ausente entra', () => {
    const doDono = {
      experienceYears: 3,
      commitments: { support24h: false },
      history: 'História escrita pelo dono.',
    }
    const plan = planGbSettings({
      ...GB_PUBLIC_SETTINGS,
      socialLinks: { ...GB_SOCIAL_LINKS },
      businessHours: { ...GB_BUSINESS_HOURS },
      siteContent: doDono,
      termsPublishedAt: new Date(),
      privacyPublishedAt: new Date(),
      returnPolicyPublishedAt: new Date(),
    })
    expect(plan.data).toEqual({
      siteContent: { ...GB_SITE_CONTENT, ...doDono },
    })
    expect(plan.siteContentKeys).toEqual(
      Object.keys(GB_SITE_CONTENT)
        .filter((key) => !(key in doDono))
        .sort()
    )
    // Compromissos são uma chave só: o dono declarou os dele, nenhum da GB entra.
    expect(
      (plan.data.siteContent as Record<string, unknown>).commitments
    ).toEqual({ support24h: false })
    expect(plan.legalDocuments).toEqual([])
  })

  it('nunca grava a frota (D-B) nem a nota de avaliações (D-A), e as lista como pendentes', () => {
    expect(GB_SITE_CONTENT).not.toHaveProperty('fleetSize')
    expect(GB_SITE_CONTENT).not.toHaveProperty('reviews')
    expect([...GB_SITE_CONTENT_PENDING]).toEqual([
      'siteContent.fleetSize (D-B)',
      'siteContent.reviews (D-A)',
      // Onda 135 (D4): os códigos de verificação vinham do ambiente da produção, nunca do código.
      'siteContent.googleSiteVerification (D4)',
      'siteContent.facebookDomainVerification (D4)',
    ])
    const content = planGbSettings(null).data.siteContent as Record<
      string,
      unknown
    >
    expect(content).not.toHaveProperty('fleetSize')
    expect(content).not.toHaveProperty('reviews')
  })

  // Onda 135, A11 (decisão do dono D4): a medição da GB tirada da produção histórica (eb4c0098, antiga app/layout.tsx retirada em F) entra
  // uma vez por campo, como o resto do conteúdo; os códigos de verificação, que vinham do ambiente, nunca.
  it('medição da GB: GA4 e Google Ads da produção, uma vez por campo; verificação nunca inventada', () => {
    const plan = planGbSettings(null)
    const content = plan.data.siteContent as Record<string, unknown>
    expect(content.googleAnalyticsId).toBe('G-5S49T61C7N')
    expect(content.googleAdsId).toBe('AW-17933178077')
    expect(content).not.toHaveProperty('googleSiteVerification')
    expect(content).not.toHaveProperty('facebookDomainVerification')
    expect(plan.checked).toEqual(
      expect.arrayContaining([
        'siteContent.googleAnalyticsId',
        'siteContent.googleAdsId',
      ])
    )
    // O ID que o dono gravou fica; depois de conferido, o campo não volta.
    const doDono = planGbSettings(
      { siteContent: { googleAnalyticsId: 'G-DONO123456' } },
      new Set(['siteContent.googleAdsId'])
    )
    expect(
      (doDono.data.siteContent as Record<string, unknown>).googleAnalyticsId
    ).toBe('G-DONO123456')
    expect(doDono.written).not.toContain('siteContent.googleAnalyticsId')
    expect(doDono.checked).not.toContain('siteContent.googleAdsId')
    expect(
      (doDono.data.siteContent as Record<string, unknown>).googleAdsId
    ).toBeUndefined()
  })

  it('o hash da auditoria do script é o mesmo do painel (JSON canônico do documento)', () => {
    for (const document of Object.values(GB_LEGAL_DOCUMENTS))
      expect(gbLegalDigest(document)).toEqual(
        storefrontLegalDigest(document as never)
      )
  })

  it('só preenche campo vazio: nada do dono muda e as outras redes ficam', () => {
    const plan = planGbSettings({
      companyAddress: '  ',
      aboutUsText: 'Texto do dono',
      companyPhone: '(51) 3000-0000',
      whatsappNumber: '',
      contactEmail: 'dono@gb.example.test',
      socialLinks: {
        linkedin: 'https://linkedin.example.test/gb',
        instagram: 'https://instagram.example.test/dono',
      },
      businessHours: {
        monday: { open: '07:00', close: '17:00', closed: false },
      },
    })
    expect(plan.create).toBe(false)
    expect(plan.data).toEqual({
      companyAddress: GB_PUBLIC_SETTINGS.companyAddress,
      whatsappNumber: GB_PUBLIC_SETTINGS.whatsappNumber,
      socialLinks: {
        linkedin: 'https://linkedin.example.test/gb',
        instagram: 'https://instagram.example.test/dono',
        facebook: GB_SOCIAL_LINKS.facebook,
      },
      siteContent: GB_SITE_CONTENT,
    })
    expect(plan.fields).toEqual([
      'companyAddress',
      'siteContent',
      'socialLinks',
      'whatsappNumber',
    ])
  })

  it('tudo preenchido: nenhum campo nem documento (idempotente)', () => {
    const plan = planGbSettings({
      ...GB_PUBLIC_SETTINGS,
      socialLinks: { ...GB_SOCIAL_LINKS },
      businessHours: { ...GB_BUSINESS_HOURS },
      siteContent: { ...GB_SITE_CONTENT },
      termsPublishedAt: new Date(),
      privacyPublishedAt: new Date(),
      returnPolicyPublishedAt: new Date(),
    })
    expect(plan.fields).toEqual([])
    expect(plan.legalDocuments).toEqual([])
    // Nada a gravar, mas tudo conferido: o --apply registra os campos, que o dono pode apagar depois sem o script voltar.
    expect(plan.checked).toEqual(TODOS_OS_CAMPOS)
    expect(plan.written).toEqual([])
  })

  it('uma vez por campo: o que um --apply anterior conferiu não volta, nem o que o dono apagou, desligou ou retirou depois', () => {
    // O dono, no painel, depois do corte: compromissos desligados (o painel grava a ausência), anos e texto do rodapé
    // apagados e a Privacidade retirada.
    const depoisDoDono = {
      ...GB_PUBLIC_SETTINGS,
      aboutUsText: '',
      socialLinks: { ...GB_SOCIAL_LINKS },
      businessHours: { ...GB_BUSINESS_HOURS },
      siteContent: Object.fromEntries(
        Object.entries(GB_SITE_CONTENT).filter(
          ([chave]) => chave !== 'commitments' && chave !== 'experienceYears'
        )
      ),
      termsPublishedAt: new Date(),
      privacyPublishedAt: null,
      returnPolicyPublishedAt: new Date(),
    }
    // Sem a auditoria do --apply anterior, o plano desfaria as quatro decisões do dono.
    expect(planGbSettings(depoisDoDono)).toMatchObject({
      fields: ['aboutUsText', 'siteContent'],
      siteContentKeys: ['commitments', 'experienceYears'],
      legalDocuments: ['privacy'],
    })
    const conferidos = handledGbFields([
      {
        action: GB_SETTINGS_APPLIED_ACTION,
        changes: { source: 'tools/gb-site-settings', checked: TODOS_OS_CAMPOS },
      },
    ])
    expect(planGbSettings(depoisDoDono, conferidos)).toEqual({
      create: false,
      data: {},
      fields: [],
      siteContentKeys: [],
      legalDocuments: [],
      checked: [],
      written: [],
    })
  })

  it('só o campo nunca conferido entra numa execução seguinte (chave nova dos dados da GB)', () => {
    const conferidos = handledGbFields([
      {
        action: GB_SETTINGS_APPLIED_ACTION,
        changes: {
          source: 'tools/gb-site-settings',
          checked: TODOS_OS_CAMPOS.filter(
            (nome) => nome !== 'siteContent.googleMerchantId'
          ),
        },
      },
    ])
    const plan = planGbSettings(
      {
        ...GB_PUBLIC_SETTINGS,
        aboutUsText: '',
        socialLinks: {},
        businessHours: {},
        siteContent: { experienceYears: 3 },
      },
      conferidos
    )
    expect(plan.checked).toEqual(['siteContent.googleMerchantId'])
    expect(plan.written).toEqual(['siteContent.googleMerchantId'])
    expect(plan.data).toEqual({
      siteContent: {
        googleMerchantId: GB_SITE_CONTENT.googleMerchantId,
        experienceYears: 3,
      },
    })
    expect(plan.legalDocuments).toEqual([])
  })

  it('texto legal publicado ou retirado pelo painel (auditoria) é do dono; só linhas do script e do painel contam', () => {
    const conferidos = handledGbFields([
      {
        action: 'STOREFRONT_LEGAL_UNPUBLISHED',
        changes: { kind: 'privacy', sha256: null, bytes: null },
      },
      { action: 'STOREFRONT_LEGAL_PUBLISHED', changes: { kind: 'terms' } },
      // Não contam: outra origem, outra ação, tipo desconhecido e linha sem `changes`.
      {
        action: GB_SETTINGS_APPLIED_ACTION,
        changes: { source: 'painel', checked: ['companyAddress'] },
      },
      { action: 'SETTINGS_UPDATED', changes: { kind: 'returnPolicy' } },
      { action: 'STOREFRONT_LEGAL_PUBLISHED', changes: { kind: 'cookies' } },
      { action: 'STOREFRONT_LEGAL_UNPUBLISHED', changes: null },
    ])
    expect([...conferidos].sort()).toEqual(['legal.privacy', 'legal.terms'])
    const plan = planGbSettings(null, conferidos)
    expect(plan.legalDocuments).toEqual(['returnPolicy'])
    expect(plan.fields).toContain('companyAddress')
  })

  it('confere nome e CNPJ da organização sem alterar', () => {
    expect(
      checkGbOrganization({
        name: 'GB Locações',
        document: '34.780.330/0001-69',
      })
    ).toEqual({
      nameMatches: true,
      documentMatches: true,
    })
    expect(
      checkGbOrganization({
        name: 'Outra',
        document: null,
        documentNormalized: '00000000000191',
      })
    ).toEqual({
      nameMatches: false,
      documentMatches: false,
    })
  })

  // Onda 133 (achado 147): a vitrine mostra o CNPJ da organização (publicLegalIdentity: o normalizado da plataforma
  // antes do legado). A trava confere o mesmo documento, na mesma ordem: com ela verde, o site da GB mostra o CNPJ da
  // GB, nunca o de outra empresa ao lado do endereço e dos telefones da GB.
  it.each([
    [
      'legado da GB, normalizado de outra empresa',
      { document: '34780330000169', documentNormalized: '11222333000181' },
      false,
    ],
    [
      'normalizado da GB, legado de outra empresa',
      { document: '11.222.333/0001-81', documentNormalized: '34780330000169' },
      true,
    ],
    [
      'só o legado, com máscara',
      { document: ' 34.780.330/0001-69 ', documentNormalized: null },
      true,
    ],
    [
      'legado em branco e sem normalizado',
      { document: '   ', documentNormalized: null },
      false,
    ],
    [
      'normalizado em branco e legado da GB',
      { document: '34780330000169', documentNormalized: '  ' },
      true,
    ],
    [
      'legado com caractere a mais',
      { document: '34780330000169X', documentNormalized: null },
      false,
    ],
  ])(
    'trava pelo CNPJ que a vitrine mostra: %s',
    (_caso, documentos, esperado) => {
      const organizacao = { name: 'GB Locações', ...documentos }
      const { documentMatches } = checkGbOrganization(organizacao)
      expect(documentMatches).toBe(esperado)
      const naVitrine = publicLegalIdentity({ legalName: null, ...documentos })
      // Trava verde implica a linha "CNPJ: 34.780.330/0001-69" no site.
      if (documentMatches) expect(naVitrine.cnpj).toBe('34.780.330/0001-69')
      else expect(naVitrine.cnpj).not.toBe('34.780.330/0001-69')
    }
  )

  /**
   * Prisma falso: a organização e a linha de configurações; a transação registra cada consulta em ordem para provar o
   * lock antes da leitura, a escrita condicional e que nada foi aberto nem escrito quando a trava recusa.
   */
  function prismaFalso(
    organization: Record<string, unknown>,
    setting: Record<string, unknown> | null = null,
    preenchidosDepoisDaLeitura: string[] = [],
    historico: Array<Record<string, unknown>> = []
  ) {
    const escritas: string[] = []
    const consultas: string[] = []
    const tx = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        consultas.push(strings.join('?').replace(/\s+/g, ' ').trim())
        return []
      }),
      setting: {
        findFirst: vi.fn(async () => {
          consultas.push('settings:read')
          return setting
        }),
        create: vi.fn(async () => {
          escritas.push('create')
          return { id: 'setting-novo' }
        }),
        update: vi.fn(async () => escritas.push('update')),
        updateMany: vi.fn(
          async (args: {
            where: Record<string, unknown>
            data: Record<string, unknown>
          }) => {
            const coluna = Object.keys(args.data).find((key) =>
              key.endsWith('Document')
            )!
            escritas.push('updateMany:' + coluna)
            // Documento gravado pelo dono entre a leitura e a escrita: a condição de nulo não acha a linha.
            return {
              count: preenchidosDepoisDaLeitura.includes(coluna) ? 0 : 1,
            }
          }
        ),
      },
      auditLog: {
        findMany: vi.fn(async () => {
          consultas.push('audit:read')
          return historico
        }),
        createMany: vi.fn(
          async (args: { data: Array<Record<string, unknown>> }) => {
            escritas.push('audit:' + args.data.length)
            return { count: args.data.length }
          }
        ),
      },
    }
    const prisma = {
      organization: { findUnique: vi.fn(async () => organization) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx)
      ),
    }
    return { prisma, tx, escritas, consultas }
  }

  const GB = {
    id: 'org-gb',
    status: 'ACTIVE',
    name: 'GB Locações',
    document: '34780330000169',
  }

  it('trava a organização (FOR UPDATE) antes de ler as configurações', async () => {
    const { prisma, tx, consultas } = prismaFalso(GB)
    await runGbSiteSettings(prisma, { slug: 'gb', apply: false })
    expect(consultas).toEqual([
      "SELECT set_config('app.tenant_id', ?, true)",
      'SELECT id FROM organizations WHERE id = ? FOR UPDATE',
      'settings:read',
      'audit:read',
    ])
    // A leitura da auditoria pede só as linhas da locadora, das execuções do script e dos textos legais.
    expect(tx.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'org-gb',
        action: {
          in: [
            GB_SETTINGS_APPLIED_ACTION,
            'STOREFRONT_LEGAL_PUBLISHED',
            'STOREFRONT_LEGAL_UNPUBLISHED',
          ],
        },
      },
      select: { action: true, changes: true },
    })
  })

  it('depois de um --apply: nada a conferir (upToDate) e nada escrito, mesmo com o dono tendo apagado campos', async () => {
    const { prisma, escritas } = prismaFalso(
      GB,
      {
        id: 'setting-gb',
        socialLinks: {},
        businessHours: {},
        siteContent: {},
        termsPublishedAt: null,
        privacyPublishedAt: null,
        returnPolicyPublishedAt: null,
      },
      [],
      [
        {
          action: GB_SETTINGS_APPLIED_ACTION,
          changes: {
            source: 'tools/gb-site-settings',
            checked: TODOS_OS_CAMPOS,
          },
        },
      ]
    )
    const report = await runGbSiteSettings(prisma, { slug: 'gb', apply: true })
    expect(report).toMatchObject({
      applied: false,
      upToDate: true,
      fields: [],
      siteContentKeys: [],
      legalDocuments: [],
    })
    expect(escritas).toEqual([])
  })

  it('sem linha de configurações e com os campos já conferidos: nenhuma linha criada e nenhum documento gravado sem linha', async () => {
    const { prisma, tx, escritas } = prismaFalso(
      GB,
      null,
      [],
      [
        {
          action: GB_SETTINGS_APPLIED_ACTION,
          changes: {
            source: 'tools/gb-site-settings',
            checked: TODOS_OS_CAMPOS.filter(
              (nome) => !nome.startsWith('legal.')
            ),
          },
        },
      ]
    )
    const report = await runGbSiteSettings(prisma, { slug: 'gb', apply: true })
    expect(report).toMatchObject({
      applied: true,
      fields: [],
      legalDocuments: ['terms', 'privacy', 'returnPolicy'],
      legalDocumentsWritten: [],
    })
    // Sem linha, a escrita condicional não roda (um `id` ausente casaria qualquer linha da locadora).
    expect(tx.setting.create).not.toHaveBeenCalled()
    expect(tx.setting.updateMany).not.toHaveBeenCalled()
    expect(escritas).toEqual(['audit:1'])
  })

  it('tudo do dono e nada a gravar: o --apply registra só a conferência (uma linha, sem campo gravado)', async () => {
    const { prisma, tx, escritas } = prismaFalso(GB, {
      id: 'setting-gb',
      ...GB_PUBLIC_SETTINGS,
      socialLinks: { ...GB_SOCIAL_LINKS },
      businessHours: { ...GB_BUSINESS_HOURS },
      siteContent: { ...GB_SITE_CONTENT },
      termsPublishedAt: new Date(),
      privacyPublishedAt: new Date(),
      returnPolicyPublishedAt: new Date(),
    })
    const report = await runGbSiteSettings(prisma, { slug: 'gb', apply: true })
    expect(report).toMatchObject({
      applied: true,
      upToDate: false,
      fields: [],
      legalDocumentsWritten: [],
    })
    expect(escritas).toEqual(['audit:1'])
    expect(tx.auditLog.createMany.mock.calls[0]![0].data[0]).toEqual({
      tenantId: 'org-gb',
      userId: null,
      action: GB_SETTINGS_APPLIED_ACTION,
      entity: 'Setting',
      entityId: 'setting-gb',
      changes: {
        source: 'tools/gb-site-settings',
        checked: TODOS_OS_CAMPOS,
        written: [],
      },
    })
  })

  it('textos legais por escrita condicional: o preenchido entre a leitura e a escrita fica, sem auditoria', async () => {
    const { prisma, tx, escritas } = prismaFalso(
      GB,
      {
        id: 'setting-gb',
        ...GB_PUBLIC_SETTINGS,
        socialLinks: { ...GB_SOCIAL_LINKS },
        businessHours: { ...GB_BUSINESS_HOURS },
        siteContent: { ...GB_SITE_CONTENT },
        termsPublishedAt: null,
        privacyPublishedAt: null,
        returnPolicyPublishedAt: null,
      },
      ['termsDocument']
    )
    const report = await runGbSiteSettings(prisma, { slug: 'gb', apply: true })
    expect(report).toMatchObject({
      applied: true,
      legalDocuments: ['terms', 'privacy', 'returnPolicy'],
      legalDocumentsWritten: ['privacy', 'returnPolicy'],
      pending: [...GB_SITE_CONTENT_PENDING],
    })
    expect(escritas).toEqual([
      'updateMany:termsDocument',
      'updateMany:privacyDocument',
      'audit:1',
      'updateMany:returnPolicyDocument',
      'audit:1',
      // A conferência da execução: os Termos do dono ficam conferidos, sem gravação.
      'audit:1',
    ])
    expect(tx.auditLog.createMany.mock.calls.at(-1)![0].data[0]).toMatchObject({
      action: GB_SETTINGS_APPLIED_ACTION,
      changes: {
        checked: TODOS_OS_CAMPOS,
        written: ['legal.privacy', 'legal.returnPolicy'],
      },
    })
    for (const [chamada] of tx.setting.updateMany.mock.calls) {
      const coluna = Object.keys(chamada.data).find((key) =>
        key.endsWith('Document')
      )!
      const data = coluna.replace('Document', 'PublishedAt')
      // Condição: só grava onde ainda não há documento publicado.
      expect(chamada.where).toEqual({
        id: 'setting-gb',
        tenantId: 'org-gb',
        [data]: null,
      })
      expect(chamada.data[data]).toBeInstanceOf(Date)
    }
    const auditoria = tx.auditLog.createMany.mock.calls.map(
      ([args]) => args.data[0]!
    )
    expect(auditoria[0]).toMatchObject({
      tenantId: 'org-gb',
      userId: null,
      action: 'STOREFRONT_LEGAL_PUBLISHED',
      entity: 'Setting',
      entityId: 'setting-gb',
      changes: {
        kind: 'privacy',
        ...gbLegalDigest(GB_LEGAL_DOCUMENTS.privacy),
        source: 'tools/gb-site-settings',
      },
    })
    // A auditoria nunca leva o texto.
    expect(JSON.stringify(auditoria)).not.toMatch(
      /privacidade é importante|Condições Gerais/
    )
  })

  it('a saída não traz valor, URL nem texto: só nomes de campos e de documentos', async () => {
    const write = vi.fn()
    const { prisma } = prismaFalso(GB)
    expect(
      await runGbSiteSettingsCli(
        ['--slug=gb'],
        { DATABASE_URL: 'postgresql://x' },
        write,
        async () => ({ prisma, close: async () => undefined })
      )
    ).toBe(0)
    const saida = String(write.mock.calls.at(-1)![0])
    expect(JSON.parse(saida)).toMatchObject({
      applied: false,
      fields: expect.arrayContaining(['siteContent']),
      legalDocuments: ['terms', 'privacy', 'returnPolicy'],
      pending: [...GB_SITE_CONTENT_PENDING],
    })
    expect(saida).not.toMatch(
      /Heinzelmann|5721491678|Melnick|Termos e Condições|https?:|postgresql/
    )
  })

  it.each([
    [
      'outra locadora (outro CNPJ)',
      { name: 'Locadora Nova', document: '11.222.333/0001-81' },
    ],
    [
      'a GB sem CNPJ cadastrado',
      { name: 'GB Locações', document: null, documentNormalized: null },
    ],
  ])(
    '--apply em %s: recusado antes de abrir a transação, nada escrito',
    async (_caso, dados) => {
      const { prisma, escritas } = prismaFalso({
        id: 'org-x',
        status: 'ACTIVE',
        ...dados,
      })
      await expect(
        runGbSiteSettings(prisma, { slug: 'locadora-nova', apply: true })
      ).rejects.toThrow('GB_SETTINGS_ORGANIZATION_MISMATCH')
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(escritas).toEqual([])
    }
  )

  it('simulação em outra locadora: mostra o plano e avisa que o --apply será recusado, sem escrever', async () => {
    const { prisma, escritas } = prismaFalso({
      id: 'org-x',
      status: 'ACTIVE',
      name: 'Locadora Nova',
      document: '11222333000181',
    })
    const report = await runGbSiteSettings(prisma, {
      slug: 'locadora-nova',
      apply: false,
    })
    expect(report).toMatchObject({
      applied: false,
      blocked: true,
      organization: { nameMatches: false, documentMatches: false },
    })
    expect(escritas).toEqual([])
  })

  it('CLI: --apply em outra locadora sai com o código da trava', async () => {
    const write = vi.fn()
    const { prisma } = prismaFalso({
      id: 'org-x',
      status: 'ACTIVE',
      name: 'Locadora Nova',
      document: '11222333000181',
    })
    const close = vi.fn(async () => undefined)
    expect(
      await runGbSiteSettingsCli(
        ['--slug=locadora-nova', '--apply'],
        { DATABASE_URL: 'postgresql://x' },
        write,
        async () => ({
          prisma,
          close,
        })
      )
    ).toBe(1)
    expect(write).toHaveBeenLastCalledWith(
      JSON.stringify({ error: 'GB_SETTINGS_ORGANIZATION_MISMATCH' })
    )
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('CLI: sem DATABASE_URL, só o código; erro do banco nunca expõe a URL', async () => {
    const write = vi.fn()
    expect(await runGbSiteSettingsCli(['--slug=gb'], {}, write)).toBe(1)
    expect(write).toHaveBeenLastCalledWith(
      JSON.stringify({ error: 'GB_SETTINGS_DATABASE_URL_MISSING' })
    )
    const url = 'postgresql://dono:segredo@db.example.test/producao'
    const connect = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED ' + url)
    })
    expect(
      await runGbSiteSettingsCli(
        ['--slug=gb'],
        { DATABASE_URL: url },
        write,
        connect
      )
    ).toBe(1)
    expect(connect).toHaveBeenCalledWith(url)
    expect(write).toHaveBeenLastCalledWith(
      JSON.stringify({ error: 'GB_SETTINGS_UNAVAILABLE' })
    )
    expect(JSON.stringify(write.mock.calls)).not.toContain('segredo')
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'gb-site-settings no banco descartável',
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const slugCompleta = 'gb-corte-' + suffix
    const slugParcial = 'gb-parcial-' + suffix
    const slugOutra = 'locadora-nova-' + suffix
    const slugSemCnpj = 'gb-sem-cnpj-' + suffix
    const role = 'gb_settings_' + suffix
    let admin: import('pg').Pool
    let adminPrisma: import('@prisma/client').PrismaClient
    let restricted: {
      pool: import('pg').Pool
      prisma: import('@prisma/client').PrismaClient
    }
    const ids: string[] = []

    beforeAll(async () => {
      const connectionString = requireTestDatabase(process.env)
      const { Pool } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { PrismaClient } = await import('@prisma/client')
      admin = new Pool({ connectionString, max: 2 })
      adminPrisma = new PrismaClient({ adapter: new PrismaPg(admin) })
      for (const [slug, name, document] of [
        [slugCompleta, 'GB Locações', '34780330000169'],
        [slugParcial, 'GB Locações', '34780330000169'],
        // Outra locadora (o verificador da segunda rodada gravou os dados da GB nela com --apply) e a GB sem CNPJ.
        [slugOutra, 'Locadora Nova', '11222333000181'],
        [slugSemCnpj, 'GB Locações', null],
      ] as const) {
        const organization = await adminPrisma.organization.create({
          data: { name, slug, document },
        })
        ids.push(organization.id)
      }
      // Papel restrito, sem BYPASSRLS: só lê organizações e lê/grava settings sob a política da locadora.
      const url = await createLoginRole(
        admin,
        connectionString,
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      // Onda 134: o lock FOR UPDATE da organização exige UPDATE em uma coluna dela, e a publicação dos textos legais
      // grava em audit_logs (INSERT, sem RETURNING); a segunda rodada lê a auditoria da locadora (SELECT, sob a RLS)
      // para não voltar ao que já conferiu. O app_runtime tem os três.
      await alterSharedAcl(admin, [
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
        `GRANT SELECT ON "organizations" TO "${role}"`,
        `GRANT UPDATE ("updatedAt") ON "organizations" TO "${role}"`,
        `GRANT SELECT, INSERT, UPDATE ON "settings" TO "${role}"`,
        `GRANT SELECT, INSERT ON "audit_logs" TO "${role}"`,
      ])
      const pool = new Pool({ connectionString: url, max: 1 })
      restricted = {
        pool,
        prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
      }
    })

    afterAll(async () => {
      await restricted?.prisma.$disconnect()
      await restricted?.pool.end()
      if (adminPrisma) {
        await adminPrisma.auditLog.deleteMany({
          where: { tenantId: { in: ids } },
        })
        await adminPrisma.setting.deleteMany({
          where: { tenantId: { in: ids } },
        })
        await adminPrisma.organization.deleteMany({
          where: { id: { in: ids } },
        })
      }
      if (admin) {
        await alterSharedAcl(
          admin,
          `REVOKE ALL ON "settings" FROM "${role}"`
        ).catch(() => undefined)
        await alterSharedAcl(
          admin,
          `REVOKE ALL ON "audit_logs" FROM "${role}"`
        ).catch(() => undefined)
        await alterSharedAcl(
          admin,
          `REVOKE ALL ON "organizations" FROM "${role}"`
        ).catch(() => undefined)
        await alterSharedAcl(
          admin,
          `REVOKE USAGE ON SCHEMA public FROM "${role}"`
        ).catch(() => undefined)
        await alterSharedAcl(admin, `DROP ROLE IF EXISTS "${role}"`).catch(
          () => undefined
        )
      }
      await adminPrisma?.$disconnect()
      await admin?.end()
    })

    const settingsOf = (tenantId: string) =>
      adminPrisma.setting.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      })

    it('simulação não escreve; --apply cria as configurações com o papel restrito; repetir não muda nada', async () => {
      const tenantId = ids[0]!
      const dry = await runGbSiteSettings(restricted.prisma, {
        slug: slugCompleta,
        apply: false,
      })
      expect(dry).toMatchObject({
        applied: false,
        upToDate: false,
        settingsRow: 'missing',
        organization: { nameMatches: true, documentMatches: true },
      })
      expect(await settingsOf(tenantId)).toHaveLength(0)

      const applied = await runGbSiteSettings(restricted.prisma, {
        slug: slugCompleta,
        apply: true,
      })
      expect(applied).toMatchObject({
        applied: true,
        settingsRow: 'missing',
        legalDocumentsWritten: ['terms', 'privacy', 'returnPolicy'],
      })
      const [row] = await settingsOf(tenantId)
      expect(row).toMatchObject({
        ...GB_PUBLIC_SETTINGS,
        socialLinks: GB_SOCIAL_LINKS,
        businessHours: GB_BUSINESS_HOURS,
        siteContent: GB_SITE_CONTENT,
        termsDocument: GB_LEGAL_DOCUMENTS.terms,
        privacyDocument: GB_LEGAL_DOCUMENTS.privacy,
        returnPolicyDocument: GB_LEGAL_DOCUMENTS.returnPolicy,
      })
      expect(row!.termsPublishedAt).toBeInstanceOf(Date)
      expect(row!.siteContent).not.toHaveProperty('fleetSize')
      const auditoria = await adminPrisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      })
      expect(
        auditoria
          .filter((linha) => linha.action === 'STOREFRONT_LEGAL_PUBLISHED')
          .map((linha) => linha.changes)
      ).toEqual(
        (['terms', 'privacy', 'returnPolicy'] as const).map((kind) => ({
          kind,
          ...gbLegalDigest(GB_LEGAL_DOCUMENTS[kind]),
          publishedAt: expect.any(String),
          source: 'tools/gb-site-settings',
        }))
      )
      // A conferência da execução: todos os campos, todos gravados (só nomes).
      expect(
        auditoria
          .filter((linha) => linha.action === GB_SETTINGS_APPLIED_ACTION)
          .map((linha) => linha.changes)
      ).toEqual([
        {
          source: 'tools/gb-site-settings',
          checked: TODOS_OS_CAMPOS,
          written: TODOS_OS_CAMPOS,
        },
      ])
      expect(auditoria).toHaveLength(4)
      expect(auditoria.every((linha) => linha.userId === null)).toBe(true)

      const again = await runGbSiteSettings(restricted.prisma, {
        slug: slugCompleta,
        apply: true,
      })
      expect(again).toMatchObject({
        applied: false,
        upToDate: true,
        settingsRow: 'existing',
        fields: [],
      })
      expect(again).toMatchObject({ legalDocuments: [] })
      const [after] = await settingsOf(tenantId)
      expect(after!.updatedAt.toISOString()).toBe(row!.updatedAt.toISOString())
      expect(await adminPrisma.auditLog.count({ where: { tenantId } })).toBe(4)

      // Depois do corte, o dono no painel: desliga os compromissos (o painel grava a ausência), apaga os anos e o texto
      // do rodapé e retira a Privacidade (documento e data zerados, com a auditoria do painel). O --apply de novo não
      // desfaz nada disso (antes, religava os 11 compromissos, regravava as chaves e republicava a Privacidade).
      const { Prisma } = await import('@prisma/client')
      const resto = Object.fromEntries(
        Object.entries(GB_SITE_CONTENT).filter(
          ([chave]) => chave !== 'commitments' && chave !== 'experienceYears'
        )
      )
      await adminPrisma.$transaction([
        adminPrisma.setting.update({
          where: { id: row!.id },
          data: {
            aboutUsText: '',
            siteContent: resto as never,
            privacyDocument: Prisma.DbNull,
            privacyPublishedAt: null,
          },
        }),
        adminPrisma.auditLog.create({
          data: {
            tenantId,
            userId: null,
            action: 'STOREFRONT_LEGAL_UNPUBLISHED',
            entity: 'Setting',
            entityId: row!.id,
            changes: { kind: 'privacy', publishedAt: null },
          },
        }),
      ])
      const doDono = (await settingsOf(tenantId))[0]!
      for (const apply of [false, true]) {
        const depois = await runGbSiteSettings(restricted.prisma, {
          slug: slugCompleta,
          apply,
        })
        expect(depois).toMatchObject({
          applied: false,
          upToDate: true,
          fields: [],
          siteContentKeys: [],
          legalDocuments: [],
        })
      }
      const [final] = await settingsOf(tenantId)
      expect(final).toEqual(doDono)
      expect(final!.siteContent).not.toHaveProperty('commitments')
      expect(final!.siteContent).not.toHaveProperty('experienceYears')
      expect(final!.privacyPublishedAt).toBeNull()
      expect(await adminPrisma.auditLog.count({ where: { tenantId } })).toBe(5)
    })

    it('configurações do dono: só os vazios são preenchidos, o resto fica intacto', async () => {
      const tenantId = ids[1]!
      await adminPrisma.setting.create({
        data: {
          tenantId,
          companyPhone: '(51) 3000-0000',
          contactEmail: 'dono@gb.example.test',
          aboutUsText: 'Texto do dono',
          socialLinks: { linkedin: 'https://linkedin.example.test/gb' },
          siteContent: { experienceYears: 3 },
          privacyDocument: { version: 1, doDono: true },
          privacyPublishedAt: new Date('2026-10-01T00:00:00Z'),
        },
      })
      const result = await runGbSiteSettings(restricted.prisma, {
        slug: slugParcial,
        apply: true,
      })
      expect(result.fields).toEqual([
        'businessHours',
        'companyAddress',
        'siteContent',
        'socialLinks',
        'whatsappNumber',
      ])
      expect(result.legalDocumentsWritten).toEqual(['terms', 'returnPolicy'])
      const [dono] = await settingsOf(tenantId)
      expect(dono!.siteContent).toEqual({
        ...GB_SITE_CONTENT,
        experienceYears: 3,
      })
      expect(dono!.privacyDocument).toEqual({ version: 1, doDono: true })
      const [row] = await settingsOf(tenantId)
      expect(row).toMatchObject({
        companyPhone: '(51) 3000-0000',
        contactEmail: 'dono@gb.example.test',
        aboutUsText: 'Texto do dono',
        companyAddress: GB_PUBLIC_SETTINGS.companyAddress,
        whatsappNumber: GB_PUBLIC_SETTINGS.whatsappNumber,
        socialLinks: {
          linkedin: 'https://linkedin.example.test/gb',
          ...GB_SOCIAL_LINKS,
        },
      })
    })

    it('--apply em outra locadora ou na GB sem CNPJ: recusado, nenhuma configuração criada', async () => {
      for (const [slug, tenantId] of [
        [slugOutra, ids[2]!],
        [slugSemCnpj, ids[3]!],
      ] as const) {
        const dry = await runGbSiteSettings(restricted.prisma, {
          slug,
          apply: false,
        })
        expect(dry).toMatchObject({ applied: false, blocked: true })
        await expect(
          runGbSiteSettings(restricted.prisma, { slug, apply: true })
        ).rejects.toThrow('GB_SETTINGS_ORGANIZATION_MISMATCH')
        expect(await settingsOf(tenantId)).toHaveLength(0)
      }
    })

    it('locadora inexistente: erro com código, nada escrito', async () => {
      await expect(
        runGbSiteSettings(restricted.prisma, {
          slug: 'nao-existe-' + suffix,
          apply: true,
        })
      ).rejects.toThrow('GB_SETTINGS_ORGANIZATION_NOT_FOUND')
    })
  }
)
