import { createHash } from 'node:crypto'
import {
  SettingsSchema,
  type SettingsInput,
} from '@gb-locacoes/contracts/settings'
import {
  parseStorefrontLegalDocument,
  type AdminStorefrontLegalResponse,
  type StorefrontLegalDocument,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import { primitives } from '@gb-locacoes/design-tokens'
import type { TenantPrincipal } from '../identity/index'
import { Prisma, type Setting } from '@prisma/client'
import type { TenantTransactionRunner } from '../customers/types'

/** JSON canônico (chaves em ordem, sem espaços): a mesma serialização para o mesmo documento, em qualquer ordem. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ':' +
            canonicalJson((value as Record<string, unknown>)[key])
        )
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}

/**
 * Identificação de um texto legal na auditoria (onda 134): sha256 e tamanho em bytes do JSON canônico do documento
 * validado. A linha de `audit_logs` guarda só isso, nunca o texto (o texto anterior deixa de existir ao ser
 * substituído; guardar versões é a decisão D-F, para um lote próprio).
 */
export function storefrontLegalDigest(document: StorefrontLegalDocument): {
  sha256: string
  bytes: number
} {
  const json = canonicalJson(document)
  return {
    sha256: createHash('sha256').update(json, 'utf8').digest('hex'),
    bytes: Buffer.byteLength(json, 'utf8'),
  }
}

/** Colunas de cada texto legal em `settings` (o documento e a data da publicação andam juntos, por CHECK). */
const LEGAL_COLUMNS = {
  terms: { document: 'termsDocument', publishedAt: 'termsPublishedAt' },
  privacy: { document: 'privacyDocument', publishedAt: 'privacyPublishedAt' },
  returnPolicy: {
    document: 'returnPolicyDocument',
    publishedAt: 'returnPolicyPublishedAt',
  },
} as const satisfies Record<
  StorefrontLegalKind,
  { document: keyof Setting; publishedAt: keyof Setting }
>

/**
 * Escrita de um texto legal: documento e data juntos. Remover grava o NULL do SQL (`Prisma.DbNull`), nunca o `null` do
 * JSON, que o CHECK de forma recusaria.
 */
function legalColumnsData(
  kind: StorefrontLegalKind,
  document: StorefrontLegalDocument | null,
  publishedAt: Date | null
): Prisma.SettingUpdateInput {
  const value =
    document === null
      ? Prisma.DbNull
      : (document as unknown as Prisma.InputJsonObject)
  switch (kind) {
    case 'terms':
      return { termsDocument: value, termsPublishedAt: publishedAt }
    case 'privacy':
      return { privacyDocument: value, privacyPublishedAt: publishedAt }
    case 'returnPolicy':
      return {
        returnPolicyDocument: value,
        returnPolicyPublishedAt: publishedAt,
      }
  }
}

export type StorefrontLegalWriteResult =
  | { ok: true; value: AdminStorefrontLegalResponse }
  | {
      ok: false
      code: 'SETTINGS_NOT_CONFIGURED' | 'LEGAL_DOCUMENT_NOT_PUBLISHED'
    }
export function createAdminSettings({
  withTenantTransaction,
  revalidatePath,
}: {
  withTenantTransaction: TenantTransactionRunner
  revalidatePath: (_path: string) => void
}) {
  const publicFields = [
    'id',
    'tenantId',
    'companyPhone',
    'companyIconUrl',
    'aboutUsText',
    'companyAddress',
    'heroCarousel',
    'contactEmail',
    'marketingEmail',
    'socialLinks',
    'seoTitle',
    'seoDescription',
    'themeColorPrimary',
    'maintenanceMode',
    'analyticsTrackingId',
    'footerText',
    'businessHours',
    'supportChat',
    'whatsappNumber',
    'favicon',
    'logoSecondary',
    'defaultLanguage',
    'baseCurrency',
    'maintenanceMessage',
    'uploadLimits',
    'customCss',
    'customJs',
    'waveAnimation',
    'publicBaseUrl',
    // Conteúdo institucional da vitrine (onda 134); os textos legais têm rota própria e nunca vão no formulário.
    'siteContent',
  ] as const
  const object = (value: unknown): Prisma.InputJsonObject =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Prisma.InputJsonObject)
      : {}
  const pick = (value: unknown, fields: string[]) =>
    Object.fromEntries(
      fields
        .filter((key) => key in object(value))
        .map((key) => [key, object(value)[key]])
    )
  const safeSmtp = (value: unknown) =>
    pick(value, ['host', 'port', 'secure', 'fromEmail', 'fromName'])
  const safeSecurity = (value: unknown) =>
    pick(value, [
      'enableRecaptcha',
      'recaptchaSiteKey',
      'enable2FA',
      'sessionTimeout',
      'maxLoginAttempts',
    ])
  function sanitizeSettings(settings: Setting) {
    return {
      ...Object.fromEntries(publicFields.map((key) => [key, settings[key]])),
      smtpConfig: safeSmtp(settings.smtpConfig),
      securityConfig: safeSecurity(settings.securityConfig),
    }
  }
  const defaults = (name: string) => ({
    seoTitle: name,
    seoDescription: 'Locação de equipamentos',
    themeColorPrimary: primitives.color.orange600,
    companyPhone: '',
    companyAddress: '',
    contactEmail: '',
    marketingEmail: '',
    whatsappNumber: '',
    heroCarousel: [],
    socialLinks: {},
    businessHours: {},
    siteContent: {},
    smtpConfig: {},
    securityConfig: {},
    uploadLimits: {},
    waveAnimation: 'animated',
    maintenanceMode: false,
    supportChat: true,
    defaultLanguage: 'pt-BR',
    baseCurrency: 'BRL',
  })
  async function tenantSettings(principal: TenantPrincipal) {
    return withTenantTransaction(principal, async (tx) => {
      const rows = await tx.setting.findMany({
        where: { tenantId: principal.tenantId },
        take: 2,
      })
      if (rows.length > 1)
        throw new Error(
          'Configuração duplicada da locadora. A reconciliação é necessária.'
        )
      if (rows[0]) return sanitizeSettings(rows[0])
      const tenant = await tx.organization.findUnique({
        where: { id: principal.tenantId },
        select: { name: true },
      })
      if (!tenant) throw new Error('Locadora não encontrada.')
      return { ...defaults(tenant.name), tenantId: principal.tenantId }
    })
  }
  async function getSettings(principal: TenantPrincipal) {
    try {
      return { success: true as const, data: await tenantSettings(principal) }
    } catch {
      return {
        success: false as const,
        error: 'Não foi possível carregar as configurações desta locadora.',
      }
    }
  }
  async function updateSettings(
    principal: TenantPrincipal,
    data: SettingsInput
  ) {
    const parsed = SettingsSchema.safeParse(data)
    if (!parsed.success)
      return { success: false as const, error: 'Configurações inválidas.' }
    if (
      parsed.data.smtpConfig?.password ||
      parsed.data.smtpConfig?.username ||
      parsed.data.securityConfig?.recaptchaSecretKey
    )
      return {
        success: false as const,
        error:
          'Credenciais devem ser configuradas pela integração segura da locadora.',
      }
    try {
      const settings = await withTenantTransaction(principal, async (tx) => {
        await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${principal.tenantId} FOR UPDATE`
        const rows = await tx.setting.findMany({
          where: { tenantId: principal.tenantId },
          take: 2,
        })
        if (rows.length > 1)
          throw new Error('Configuração duplicada da locadora.')
        const existing = rows[0]
        const { smtpConfig, securityConfig, ...input } = parsed.data
        const values = {
          ...input,
          smtpConfig: {
            ...object(existing?.smtpConfig),
            ...safeSmtp(smtpConfig),
          },
          securityConfig: {
            ...object(existing?.securityConfig),
            ...safeSecurity(securityConfig),
          },
        }
        return existing
          ? tx.setting.update({
              where: {
                id_tenantId: { id: existing.id, tenantId: principal.tenantId },
              },
              data: values,
            })
          : tx.setting.create({
              data: { ...values, tenantId: principal.tenantId },
            })
      })
      revalidatePath('/admin/settings')
      revalidatePath('/')
      return {
        success: true as const,
        data: sanitizeSettings(settings),
        message: 'Configurações atualizadas com sucesso!',
      }
    } catch {
      return {
        success: false as const,
        error: 'Não foi possível atualizar as configurações desta locadora.',
      }
    }
  }

  /** Linha única de configurações da locadora, com a organização travada (o mesmo lock do formulário e do script). */
  async function lockedSettings(
    tx: Prisma.TransactionClient,
    principal: TenantPrincipal
  ) {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${principal.tenantId} FOR UPDATE`
    const rows = await tx.setting.findMany({
      where: { tenantId: principal.tenantId },
      take: 2,
    })
    if (rows.length > 1) throw new Error('Configuração duplicada da locadora.')
    return rows[0] ?? null
  }

  /** Texto legal da locadora no painel: o documento atual (fora do contrato, nenhum) e a data da publicação. */
  async function getLegalDocument(
    principal: TenantPrincipal,
    kind: StorefrontLegalKind
  ): Promise<AdminStorefrontLegalResponse> {
    const columns = LEGAL_COLUMNS[kind]
    return withTenantTransaction(principal, async (tx) => {
      const rows = await tx.setting.findMany({
        where: { tenantId: principal.tenantId },
        take: 2,
      })
      if (rows.length > 1)
        throw new Error('Configuração duplicada da locadora.')
      const row = rows[0]
      const stored = row?.[columns.document] ?? null
      const publishedAt = row?.[columns.publishedAt]
      const parsed = parseStorefrontLegalDocument(stored)
      return parsed.status === 'ok' && publishedAt instanceof Date
        ? {
            kind,
            document: parsed.document,
            publishedAt: publishedAt.toISOString(),
          }
        : { kind, document: null, publishedAt: null }
    })
  }

  /**
   * Publica o texto legal (documento já validado pela rota): documento e data juntos e a linha de `audit_logs` na mesma
   * transação. Sem linha de configurações, não cria uma com os padrões do Prisma (valores que a locadora não escolheu;
   * até a onda 135, o título SEO da GB).
   */
  async function saveLegalDocument(
    principal: TenantPrincipal,
    kind: StorefrontLegalKind,
    document: StorefrontLegalDocument
  ): Promise<StorefrontLegalWriteResult> {
    return withTenantTransaction(principal, async (tx) => {
      const setting = await lockedSettings(tx, principal)
      if (!setting) return { ok: false, code: 'SETTINGS_NOT_CONFIGURED' }
      const publishedAt = new Date()
      await tx.setting.update({
        where: {
          id_tenantId: { id: setting.id, tenantId: principal.tenantId },
        },
        data: legalColumnsData(kind, document, publishedAt),
      })
      await tx.auditLog.create({
        data: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          action: 'STOREFRONT_LEGAL_PUBLISHED',
          entity: 'Setting',
          entityId: setting.id,
          changes: {
            kind,
            ...storefrontLegalDigest(document),
            publishedAt: publishedAt.toISOString(),
          },
        },
      })
      return {
        ok: true,
        value: { kind, document, publishedAt: publishedAt.toISOString() },
      }
    })
  }

  /** Despublica o texto legal: documento e data zerados juntos e a auditoria com o hash do texto retirado. */
  async function removeLegalDocument(
    principal: TenantPrincipal,
    kind: StorefrontLegalKind
  ): Promise<StorefrontLegalWriteResult> {
    const columns = LEGAL_COLUMNS[kind]
    return withTenantTransaction(principal, async (tx) => {
      const setting = await lockedSettings(tx, principal)
      const previous = setting?.[columns.publishedAt]
      if (!setting || !(previous instanceof Date))
        return { ok: false, code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' }
      const parsed = parseStorefrontLegalDocument(setting[columns.document])
      await tx.setting.update({
        where: {
          id_tenantId: { id: setting.id, tenantId: principal.tenantId },
        },
        data: legalColumnsData(kind, null, null),
      })
      await tx.auditLog.create({
        data: {
          tenantId: principal.tenantId,
          userId: principal.userId,
          action: 'STOREFRONT_LEGAL_UNPUBLISHED',
          entity: 'Setting',
          entityId: setting.id,
          changes: {
            kind,
            ...(parsed.status === 'ok'
              ? storefrontLegalDigest(parsed.document)
              : { sha256: null, bytes: null }),
            publishedAt: null,
            previousPublishedAt: previous.toISOString(),
          },
        },
      })
      return { ok: true, value: { kind, document: null, publishedAt: null } }
    })
  }

  return {
    getSettings,
    updateSettings,
    getLegalDocument,
    saveLegalDocument,
    removeLegalDocument,
  }
}
