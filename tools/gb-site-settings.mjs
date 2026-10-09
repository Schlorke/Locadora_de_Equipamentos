// Configurações públicas da GB Locações para o corte (onda 132, achado 143; runbook docs/operations/gb-site-settings.md).
//
// O frontend deixou de completar a vitrine com os dados da GB (T12 da ADR adr-tenant-hosts): nome, endereço, texto,
// redes e WhatsApp agora vêm só do cartão público e das configurações da própria locadora. A GB usava esses padrões
// do código; este script grava os mesmos valores nas configurações (`settings`) da organização da GB para que o site
// dela não mude. Só preenche campo vazio (nunca sobrescreve o que o dono gravou) e é idempotente.
//
// Uma vez por campo (onda 134, segunda rodada): cada `--apply` registra em audit_logs (`GB_SITE_SETTINGS_APPLIED`, só
// nomes) os campos que conferiu, os gravados e os que o dono já tinha. Uma execução seguinte não volta a eles: o que o
// dono apagou, desligou ou despublicou no painel depois do corte continua como ele deixou. Texto legal com publicação
// ou despublicação na auditoria (do painel ou daqui) também é do dono. Só campo novo dos dados da GB, nunca conferido,
// entra numa execução seguinte.
//
// Padrão: simulação (lê e mostra o plano, sem escrever). `--apply` grava numa transação com o contexto da locadora
// (`app.tenant_id`, o mesmo do withTenantTransaction), sob a RLS de `settings`, e só na organização com o CNPJ da GB:
// slug errado (outra locadora, ou a GB sem CNPJ cadastrado) é recusado sem escrever nada, porque gravaria os dados da
// GB no site de outro dono, o próprio defeito do achado 143. Nunca imprime DATABASE_URL, segredo ou valor gravado pelo
// dono: só o nome dos campos e a ação; os valores da GB abaixo são públicos (o site já os mostrava).
//
// Onda 134 (lote vitrine-conteúdo; decisões do dono de 2026-10-06 e 2026-10-07): também o conteúdo institucional
// (`settings.siteContent`, chave a chave: só as ausentes) e os três textos legais (Termos, Privacidade e Devolução, só os
// não publicados), com os dados de tools/gb-site-content.mjs. A organização é travada (`SELECT … FOR UPDATE`, o mesmo
// lock do painel) antes da leitura; cada documento é gravado por escrita condicional (só onde ainda não há documento) e
// registrado em audit_logs com o hash, nunca o texto. Nunca grava a frota (D-B) nem a nota de avaliações (D-A): o
// relatório as lista em `pending`. Não edite o painel da GB durante o corte (runbook).
//
// Uso: DATABASE_URL=postgresql://... node tools/gb-site-settings.mjs --slug=<slug-da-gb> [--apply]
// Saída: JSON numa linha. Código 0 quando o plano saiu (simulação) ou foi aplicado; 1 com `{ "error": CÓDIGO }`.
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  GB_LEGAL_DOCUMENTS,
  GB_SITE_CONTENT,
  GB_SITE_CONTENT_PENDING,
} from './gb-site-content.mjs'

/** Valores públicos que o frontend usava como padrão da GB (rodapé, WhatsApp flutuante, orçamento e JSON-LD). */
export const GB_PUBLIC_SETTINGS = Object.freeze({
  companyAddress:
    'Travessa Doutor Heinzelmann, 365 - Humaitá, Porto Alegre/RS - CEP 90240-100',
  aboutUsText:
    'Locação de equipamentos para construção civil em Porto Alegre e região. Segurança, qualidade e manutenção constante.',
  companyPhone: '(51) 2313-6262',
  whatsappNumber: '(51) 99820-5163',
  contactEmail: 'contato@locacoesgb.com.br',
})

/** Redes que o rodapé completava com as da GB (as demais redes do dono ficam como estão). */
export const GB_SOCIAL_LINKS = Object.freeze({
  facebook: 'https://www.facebook.com/locacoesgb',
  instagram: 'https://www.instagram.com/locacoes_gb/',
})

/**
 * Horário que o rodapé e o contato mostravam fixo (seg a sex 8h às 18h, sáb 8h às 12h), no formato do campo
 * `businessHours` do painel (packages/contracts/src/settings.ts). Desde a onda 133 (achado 147) a vitrine lê esse
 * horário na leitura pública das configurações (`businessHours` de `GET /api/settings/public`) e o mostra no rodapé,
 * no contato da home e na página de contato.
 */
export const GB_BUSINESS_HOURS = Object.freeze({
  monday: { open: '08:00', close: '18:00', closed: false },
  tuesday: { open: '08:00', close: '18:00', closed: false },
  wednesday: { open: '08:00', close: '18:00', closed: false },
  thursday: { open: '08:00', close: '18:00', closed: false },
  friday: { open: '08:00', close: '18:00', closed: false },
  saturday: { open: '08:00', close: '12:00', closed: false },
  sunday: { closed: true },
})

/**
 * Identidade que a vitrine lê do cartão (nome) e da organização (CNPJ, na identificação legal da leitura pública desde
 * a onda 133): só conferidos, nunca alterados.
 */
export const GB_IDENTITY = Object.freeze({
  name: 'GB Locações',
  document: '34780330000169',
})

const SLUG = /^(?!.*--)[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/
const CODES = new Set([
  'GB_SETTINGS_ARGUMENTS_INVALID',
  'GB_SETTINGS_DATABASE_URL_MISSING',
  'GB_SETTINGS_ORGANIZATION_NOT_FOUND',
  'GB_SETTINGS_ORGANIZATION_NOT_ACTIVE',
  'GB_SETTINGS_ORGANIZATION_MISMATCH',
])
const fail = (code) => {
  throw new Error(code)
}

/** Origem das linhas de auditoria do script. */
const SOURCE = 'tools/gb-site-settings'
/** Linha de cada `--apply`: os campos conferidos naquela execução (`checked`) e os gravados (`written`), só nomes. */
export const GB_SETTINGS_APPLIED_ACTION = 'GB_SITE_SETTINGS_APPLIED'
/** Publicação e despublicação de texto legal (painel ou script): o documento daquele tipo passa a ser do dono. */
const LEGAL_AUDIT_ACTIONS = Object.freeze([
  'STOREFRONT_LEGAL_PUBLISHED',
  'STOREFRONT_LEGAL_UNPUBLISHED',
])

export function parseGbSettingsArguments(args) {
  const options = { apply: false, slug: null }
  for (const arg of args) {
    if (arg === '--apply') {
      if (options.apply) fail('GB_SETTINGS_ARGUMENTS_INVALID')
      options.apply = true
      continue
    }
    const match = /^--slug=(.+)$/.exec(arg)
    if (!match || options.slug !== null || !SLUG.test(match[1]))
      fail('GB_SETTINGS_ARGUMENTS_INVALID')
    options.slug = match[1]
  }
  if (options.slug === null) fail('GB_SETTINGS_ARGUMENTS_INVALID')
  return options
}

const blank = (value) => typeof value !== 'string' || value.trim() === ''
const isObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
/** Cópia simples (sem o congelamento dos dados), para gravar no banco. */
const plain = (value) => JSON.parse(JSON.stringify(value))

/** Os três textos legais, na ordem do rodapé, com as colunas de cada um em `settings`. */
const LEGAL_COLUMNS = Object.freeze({
  terms: { document: 'termsDocument', publishedAt: 'termsPublishedAt' },
  privacy: { document: 'privacyDocument', publishedAt: 'privacyPublishedAt' },
  returnPolicy: {
    document: 'returnPolicyDocument',
    publishedAt: 'returnPolicyPublishedAt',
  },
})

/** JSON canônico (chaves em ordem): o mesmo de `storefrontLegalDigest` do packages/backend. */
function canonicalJson(value) {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']'
  if (isObject(value))
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}

/** sha256 e tamanho em bytes do JSON canônico do documento: o que a auditoria guarda (nunca o texto). */
export function gbLegalDigest(document) {
  const json = canonicalJson(document)
  return {
    sha256: createHash('sha256').update(json, 'utf8').digest('hex'),
    bytes: Buffer.byteLength(json, 'utf8'),
  }
}

/**
 * Campos que o script já não toca, pela auditoria da locadora: os conferidos por um `--apply` anterior
 * (`GB_SITE_SETTINGS_APPLIED`, `changes.checked`) e os textos legais com publicação ou despublicação registrada
 * (`legal.<tipo>`). Os nomes são os de `checked`: `companyAddress`, `socialLinks.facebook`, `businessHours`,
 * `siteContent.<chave>`, `legal.<tipo>`.
 */
export function handledGbFields(history) {
  const handled = new Set()
  for (const row of history ?? []) {
    const changes = isObject(row?.changes) ? row.changes : {}
    if (
      row.action === GB_SETTINGS_APPLIED_ACTION &&
      changes.source === SOURCE &&
      Array.isArray(changes.checked)
    )
      for (const name of changes.checked)
        if (typeof name === 'string') handled.add(name)
    if (
      LEGAL_AUDIT_ACTIONS.includes(row.action) &&
      typeof changes.kind === 'string' &&
      Object.hasOwn(LEGAL_COLUMNS, changes.kind)
    )
      handled.add('legal.' + changes.kind)
  }
  return handled
}

/**
 * Plano puro: o que falta nas configurações atuais (`null` = sem linha), fora dos campos já conferidos (`handled`, de
 * `handledGbFields`). Só campo vazio entra; nada do dono muda. `data` é o que será gravado; `fields`, os nomes dos
 * campos (o que o relatório mostra). No conteúdo institucional, só as chaves ausentes (`siteContentKeys`); nos textos
 * legais, só os não publicados (`legalDocuments`). `checked` lista o que esta execução confere (gravado ou já do dono):
 * é o que o `--apply` registra para nunca mais voltar a esses campos.
 */
export function planGbSettings(current, handled = new Set()) {
  const checked = []
  const pending = (name) => {
    if (handled.has(name)) return false
    checked.push(name)
    return true
  }
  const data = {}
  for (const [field, value] of Object.entries(GB_PUBLIC_SETTINGS))
    if (pending(field) && (!current || blank(current[field])))
      data[field] = value
  const links = isObject(current?.socialLinks) ? current.socialLinks : {}
  const missingLinks = Object.entries(GB_SOCIAL_LINKS).filter(
    ([network]) => pending('socialLinks.' + network) && blank(links[network])
  )
  if (missingLinks.length > 0)
    data.socialLinks = { ...links, ...Object.fromEntries(missingLinks) }
  const hours = current?.businessHours
  if (
    pending('businessHours') &&
    (!isObject(hours) || Object.keys(hours).length === 0)
  )
    data.businessHours = { ...GB_BUSINESS_HOURS }
  const content = isObject(current?.siteContent) ? current.siteContent : {}
  const siteContentKeys = Object.keys(GB_SITE_CONTENT)
    .filter(
      (key) => pending('siteContent.' + key) && content[key] === undefined
    )
    .sort()
  if (siteContentKeys.length > 0)
    data.siteContent = {
      ...plain(
        Object.fromEntries(
          siteContentKeys.map((key) => [key, GB_SITE_CONTENT[key]])
        )
      ),
      ...content,
    }
  const legalDocuments = Object.keys(LEGAL_COLUMNS).filter(
    (kind) =>
      pending('legal.' + kind) && !current?.[LEGAL_COLUMNS[kind].publishedAt]
  )
  const fields = Object.keys(data).sort()
  const written = new Set([
    ...Object.keys(GB_PUBLIC_SETTINGS).filter((field) => field in data),
    ...missingLinks.map(([network]) => 'socialLinks.' + network),
    ...('businessHours' in data ? ['businessHours'] : []),
    ...siteContentKeys.map((key) => 'siteContent.' + key),
  ])
  return {
    // Sem linha e sem campo a gravar, nenhuma linha é criada (ela levaria os padrões do Prisma).
    create: current === null && fields.length > 0,
    data,
    fields,
    siteContentKeys,
    legalDocuments,
    checked,
    // Os nomes do que vai para `settings`, na ordem de `checked` (sem os textos legais, gravados um a um): a auditoria.
    written: checked.filter((name) => written.has(name)),
  }
}

/**
 * Máscara aceita na digitação do CNPJ (a mesma de `normalizarDocumento` do packages/domain). Só ela sai: letra ou outro
 * caractere continua no documento e faz a conferência falhar, como a validação da vitrine recusa.
 */
const CNPJ_MASK = /[./\-\s]/g

/**
 * Conferência da organização (nunca alterada aqui): nome do cartão e CNPJ que a vitrine mostra. O CNPJ é a trava do
 * `--apply` (identifica a empresa); o nome só informa se o cabeçalho e o rodapé da GB vão mostrar o mesmo nome.
 *
 * O documento conferido é o que a identificação legal da vitrine lê (`publicLegalIdentity` do packages/backend): o
 * normalizado do cadastro da plataforma antes do legado. Trava verde implica o CNPJ da GB no site, nunca o de outra
 * empresa ao lado do endereço e dos telefones da GB; normalizado preenchido e diferente trava, mesmo com o legado da GB.
 */
export function checkGbOrganization(organization) {
  const document =
    [organization.documentNormalized, organization.document]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value !== '') ?? ''
  return {
    nameMatches: organization.name === GB_IDENTITY.name,
    documentMatches: document.replace(CNPJ_MASK, '') === GB_IDENTITY.document,
  }
}

const SETTINGS_SELECT = {
  id: true,
  companyAddress: true,
  aboutUsText: true,
  companyPhone: true,
  whatsappNumber: true,
  contactEmail: true,
  socialLinks: true,
  businessHours: true,
  siteContent: true,
  termsPublishedAt: true,
  privacyPublishedAt: true,
  returnPolicyPublishedAt: true,
}

/** Lê, planeja e (com `apply`) grava numa transação com o contexto da locadora. `prisma` é um PrismaClient. */
export async function runGbSiteSettings(prisma, { slug, apply }) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      status: true,
      document: true,
      documentNormalized: true,
    },
  })
  if (!organization) fail('GB_SETTINGS_ORGANIZATION_NOT_FOUND')
  if (organization.status !== 'ACTIVE')
    fail('GB_SETTINGS_ORGANIZATION_NOT_ACTIVE')
  const check = checkGbOrganization(organization)
  // Trava antes de qualquer escrita (e antes da transação): só a organização com o CNPJ da GB recebe os dados da GB.
  if (apply && !check.documentMatches) fail('GB_SETTINGS_ORGANIZATION_MISMATCH')
  return prisma.$transaction(async (tx) => {
    // Contexto da locadora para a RLS de settings (o mesmo set_config do withTenantTransaction do backend).
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${organization.id}, true)`
    // O mesmo lock do painel (formulário e textos legais) antes de ler: nenhuma gravação do dono se perde no meio.
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organization.id} FOR UPDATE`
    const current = await tx.setting.findFirst({
      where: { tenantId: organization.id },
      orderBy: { createdAt: 'asc' },
      select: SETTINGS_SELECT,
    })
    // O que um --apply anterior já conferiu e os textos legais que o dono publicou ou retirou: nunca voltam.
    const history = await tx.auditLog.findMany({
      where: {
        tenantId: organization.id,
        action: { in: [GB_SETTINGS_APPLIED_ACTION, ...LEGAL_AUDIT_ACTIONS] },
      },
      select: { action: true, changes: true },
    })
    const plan = planGbSettings(current, handledGbFields(history))
    const report = {
      applied: false,
      // Nada a conferir: tudo já foi conferido por um --apply anterior (ou é do dono pela auditoria).
      upToDate: plan.checked.length === 0,
      slug,
      organization: check,
      // A simulação já avisa que o --apply será recusado (CNPJ diferente do da GB ou ausente).
      blocked: !check.documentMatches,
      settingsRow: current ? 'existing' : 'missing',
      fields: plan.fields,
      siteContentKeys: plan.siteContentKeys,
      legalDocuments: plan.legalDocuments,
      pending: [...GB_SITE_CONTENT_PENDING],
    }
    if (!apply || report.upToDate) return report
    let settingId = current?.id
    if (plan.create)
      settingId = (
        await tx.setting.create({
          data: { tenantId: organization.id, ...plan.data },
          select: { id: true },
        })
      ).id
    else if (plan.fields.length > 0)
      await tx.setting.update({ where: { id: current.id }, data: plan.data })
    const legalDocumentsWritten = []
    for (const kind of settingId ? plan.legalDocuments : []) {
      const columns = LEGAL_COLUMNS[kind]
      const document = plain(GB_LEGAL_DOCUMENTS[kind])
      const publishedAt = new Date()
      // Escrita condicional: só onde ainda não há documento publicado (o do dono, gravado depois da leitura, fica).
      const { count } = await tx.setting.updateMany({
        where: {
          id: settingId,
          tenantId: organization.id,
          [columns.publishedAt]: null,
        },
        data: {
          [columns.document]: document,
          [columns.publishedAt]: publishedAt,
        },
      })
      if (count !== 1) continue
      await tx.auditLog.createMany({
        data: [
          {
            tenantId: organization.id,
            userId: null,
            action: 'STOREFRONT_LEGAL_PUBLISHED',
            entity: 'Setting',
            entityId: settingId,
            changes: {
              kind,
              ...gbLegalDigest(document),
              publishedAt: publishedAt.toISOString(),
              source: SOURCE,
            },
          },
        ],
      })
      legalDocumentsWritten.push(kind)
    }
    // O registro desta execução: os campos conferidos (uma vez por campo) e os gravados, só os nomes.
    await tx.auditLog.createMany({
      data: [
        {
          tenantId: organization.id,
          userId: null,
          action: GB_SETTINGS_APPLIED_ACTION,
          entity: 'Setting',
          entityId: settingId ?? organization.id,
          changes: {
            source: SOURCE,
            checked: plan.checked,
            written: [
              ...plan.written,
              ...legalDocumentsWritten.map((kind) => 'legal.' + kind),
            ],
          },
        },
      ],
    })
    return { ...report, applied: true, legalDocumentsWritten }
  })
}

/** CLI: nunca imprime a URL do banco nem a mensagem crua de erro (só um código conhecido). */
export async function runGbSiteSettingsCli(args, env, write, connect) {
  let connection = null
  try {
    const options = parseGbSettingsArguments(args)
    if (!env.DATABASE_URL) fail('GB_SETTINGS_DATABASE_URL_MISSING')
    connection = await (connect ?? defaultConnect)(env.DATABASE_URL)
    write(JSON.stringify(await runGbSiteSettings(connection.prisma, options)))
    return 0
  } catch (error) {
    const code =
      error instanceof Error && CODES.has(error.message)
        ? error.message
        : 'GB_SETTINGS_UNAVAILABLE'
    write(JSON.stringify({ error: code }))
    return 1
  } finally {
    await connection?.close().catch(() => undefined)
  }
}

/** Um PrismaClient com uma conexão só (como os testes de banco e o runtime do backend), fechado ao final. */
async function defaultConnect(connectionString) {
  const [{ PrismaClient }, { PrismaPg }, { Pool }] = await Promise.all([
    import('@prisma/client'),
    import('@prisma/adapter-pg'),
    import('pg'),
  ])
  const pool = new Pool({ connectionString, max: 1 })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  return {
    prisma,
    close: async () => {
      await prisma.$disconnect()
      await pool.end()
    },
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(pathToFileURL(process.argv[1]))
) {
  process.exitCode = await runGbSiteSettingsCli(
    process.argv.slice(2),
    process.env,
    (line) => process.stdout.write(line + '\n')
  )
}
