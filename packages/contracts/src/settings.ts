import { z } from 'zod'

// Schema para itens do carousel
const HeroCarouselItemSchema = z.object({
  id: z.string().optional(),
  imageUrl: z.string().min(1, 'URL da imagem é obrigatória'),
  title: z.string().optional(),
  description: z.string().optional(),
  link: z.string().optional(),
  order: z.number().optional(),
})

// Schema para links sociais
const SocialLinksSchema = z.object({
  facebook: z.string().url().optional().or(z.literal('')),
  instagram: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  whatsapp: z.string().optional().or(z.literal('')),
  youtube: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
})

// Schema para horário de funcionamento
const BusinessHoursSchema = z.object({
  monday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
  tuesday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
  wednesday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
  thursday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
  friday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
  saturday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
  sunday: z
    .object({
      open: z.string().optional(),
      close: z.string().optional(),
      closed: z.boolean().default(false),
    })
    .optional(),
})

// Schema para configurações SMTP
const SmtpConfigSchema = z.object({
  host: z.string().optional(),
  port: z.number().optional(),
  secure: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  fromEmail: z.string().email().optional().or(z.literal('')),
  fromName: z.string().optional(),
})

// Schema para limites de upload
const UploadLimitsSchema = z.object({
  maxFileSize: z.number().positive().optional(),
  allowedTypes: z.array(z.string()).optional(),
  maxFiles: z.number().positive().optional(),
})

// Schema para configurações de segurança
const SecurityConfigSchema = z.object({
  enableRecaptcha: z.boolean().optional(),
  recaptchaSiteKey: z.string().optional(),
  recaptchaSecretKey: z.string().optional(),
  enable2FA: z.boolean().optional(),
  sessionTimeout: z.number().positive().optional(),
  maxLoginAttempts: z.number().positive().optional(),
})

// ---- Conteúdo institucional da vitrine (`settings.siteContent`, onda 134) ----------------------------------------
//
// Decisão do dono de 2026-10-06 (ADR adr-saas-subscription, B.18, item 2): cada locadora informa no painel o conteúdo
// institucional que o modelo de site mostra. Sem o dado, o bloco não aparece (regra da onda 132). Escrita estrita
// (`SiteContentSchema`, no `PUT /api/admin/settings`); leitura tolerante chave a chave (`parsePublicSiteContent`), a
// mesma no backend e na vitrine. Texto sempre aparado e sem caractere de controle: o modelo o mostra como texto.

/**
 * Caracteres proibidos nos textos da locadora: controles C0 e C1 (inclusive quebra de linha e tabulação), DEL, os
 * separadores de linha e parágrafo do Unicode e os controles de direção (que invertem a leitura de um trecho).
 */
function isControlCharacter(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  )
}

const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index++)
    if (isControlCharacter(value.charCodeAt(index))) return true
  return false
}

/** Texto da locadora: aparado, com tamanho em caracteres e sem caractere de controle. */
export function plainText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasControlCharacter(value), {
      message: 'Caractere de controle não permitido',
    })
}

const count = (max: number) => z.number().int().min(1).max(max)

/**
 * Compromissos comerciais que o modelo de site só afirma quando a locadora os declara (§2.3 do plano da onda 134;
 * decisão do dono D-E: desligados por padrão, CDC art. 30). As frases de cada um ficam num lugar só, no frontend
 * (`entities/configuracao/model/compromissos.ts`).
 */
export const SITE_CONTENT_COMMITMENTS = [
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
] as const
export type SiteContentCommitment = (typeof SITE_CONTENT_COMMITMENTS)[number]

/** Link `https` sem credenciais, até 500 caracteres (fonte da nota de avaliações). */
const HTTPS_URL = /^https:\/\/[^\s/?#@\\]+(?:[/?#]\S*)?$/

/**
 * Medição e verificação da locadora (onda 135, A11): o formato de cada identificador. Nenhum deles admite aspas,
 * espaço, `<`, `/` ou `;`, então nenhum escapa do modelo fixo em que a vitrine o põe.
 * - `googleAnalyticsId`: ID de medição do Google Analytics 4 (`G-` e letras maiúsculas ou dígitos);
 * - `googleAdsId`: ID da conta do Google Ads para conversões (`AW-` e dígitos);
 * - `googleSiteVerification`: o código do meta `google-site-verification` do Search Console;
 * - `facebookDomainVerification`: o código do meta `facebook-domain-verification` do Gerenciador de Negócios (Meta).
 */
export const SITE_MEASUREMENT_FORMATS = Object.freeze({
  googleAnalyticsId: /^G-[A-Z0-9]{4,16}$/,
  googleAdsId: /^AW-\d{6,15}$/,
  googleSiteVerification: /^[A-Za-z0-9_-]{20,100}$/,
  facebookDomainVerification: /^[a-z0-9]{20,64}$/,
})

/** Chaves de medição e verificação dentro do conteúdo da vitrine (`settings.siteContent`). */
export const SITE_MEASUREMENT_KEYS = [
  'googleAnalyticsId',
  'googleAdsId',
  'googleSiteVerification',
  'facebookDomainVerification',
] as const
export type SiteMeasurementKey = (typeof SITE_MEASUREMENT_KEYS)[number]

/** Esquema de cada chave; `strict` recusa chave desconhecida (escrita) e o modo tolerante a ignora (leitura). */
function siteContentFields(strict: boolean) {
  const object = strict ? z.strictObject : z.object
  return {
    experienceYears: z.number().int().min(1).max(150),
    fleetSize: count(1_000_000),
    clientsServed: count(1_000_000),
    projectsCompleted: count(1_000_000),
    citiesServed: count(1_000_000),
    featuredClients: z.array(plainText(1, 80)).min(1).max(12),
    history: plainText(1, 1500),
    timeline: z
      .array(
        object({
          year: z.number().int().min(1900).max(2100),
          title: plainText(1, 80),
          description: plainText(1, 240),
        })
      )
      .min(1)
      .max(12),
    footerHighlights: z.array(plainText(1, 60)).min(1).max(8),
    commitments: object({
      certifiedEquipment: z.boolean().optional(),
      freeDelivery: z.boolean().optional(),
      fastDelivery: z.boolean().optional(),
      sameDayDelivery: z.boolean().optional(),
      ownLogistics: z.boolean().optional(),
      equipmentTracking: z.boolean().optional(),
      support24h: z.boolean().optional(),
      flexibleScheduling: z.boolean().optional(),
      freeConsulting: z.boolean().optional(),
      responseWithin24h: z.boolean().optional(),
      fastResponseGuaranteed: z.boolean().optional(),
    }),
    storeLocation: object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      placeId: z
        .string()
        .regex(/^[A-Za-z0-9_-]{16,256}$/)
        .optional(),
      addressLine1: plainText(1, 120),
      addressLine2: plainText(1, 120).optional(),
    }),
    googleMerchantId: z.string().regex(/^[1-9]\d{5,14}$/),
    // Nota com fonte (decisão do dono D-A): sem nome e link da fonte, a nota não existe. Nunca vai para o JSON-LD.
    reviews: object({
      rating: z
        .number()
        .min(1)
        .max(5)
        .refine(
          (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9,
          { message: 'Uma casa decimal' }
        ),
      count: z.number().int().min(1),
      sourceName: plainText(2, 60),
      sourceUrl: z.string().max(500).regex(HTTPS_URL),
    }),
    // Onda 135, A11 (decisão do dono D4 de 2026-10-08): medição e verificação da própria locadora. Só o identificador
    // no formato de cada serviço, nunca código: a vitrine o põe num modelo fixo (tag do Google, meta de verificação),
    // com CSP por host. Sem o dado, nada é injetado.
    googleAnalyticsId: z
      .string()
      .regex(SITE_MEASUREMENT_FORMATS.googleAnalyticsId),
    googleAdsId: z.string().regex(SITE_MEASUREMENT_FORMATS.googleAdsId),
    googleSiteVerification: z
      .string()
      .regex(SITE_MEASUREMENT_FORMATS.googleSiteVerification),
    facebookDomainVerification: z
      .string()
      .regex(SITE_MEASUREMENT_FORMATS.facebookDomainVerification),
  }
}

const WRITE_FIELDS = siteContentFields(true)
const READ_FIELDS = siteContentFields(false)
export type SiteContentKey = keyof typeof WRITE_FIELDS

/** Chaves do conteúdo institucional (inventário do §2.2 do plano da onda 134). */
export const SITE_CONTENT_KEYS = Object.freeze(
  Object.keys(WRITE_FIELDS) as SiteContentKey[]
)

/** Escrita (painel): objeto estrito, todas as chaves opcionais. */
export const SiteContentSchema = z.strictObject({
  experienceYears: WRITE_FIELDS.experienceYears.optional(),
  fleetSize: WRITE_FIELDS.fleetSize.optional(),
  clientsServed: WRITE_FIELDS.clientsServed.optional(),
  projectsCompleted: WRITE_FIELDS.projectsCompleted.optional(),
  citiesServed: WRITE_FIELDS.citiesServed.optional(),
  featuredClients: WRITE_FIELDS.featuredClients.optional(),
  history: WRITE_FIELDS.history.optional(),
  timeline: WRITE_FIELDS.timeline.optional(),
  footerHighlights: WRITE_FIELDS.footerHighlights.optional(),
  commitments: WRITE_FIELDS.commitments.optional(),
  storeLocation: WRITE_FIELDS.storeLocation.optional(),
  googleMerchantId: WRITE_FIELDS.googleMerchantId.optional(),
  reviews: WRITE_FIELDS.reviews.optional(),
  googleAnalyticsId: WRITE_FIELDS.googleAnalyticsId.optional(),
  googleAdsId: WRITE_FIELDS.googleAdsId.optional(),
  googleSiteVerification: WRITE_FIELDS.googleSiteVerification.optional(),
  facebookDomainVerification:
    WRITE_FIELDS.facebookDomainVerification.optional(),
})
export type SiteContent = z.infer<typeof SiteContentSchema>

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Leitura tolerante do conteúdo institucional: cada chave conhecida passa pelo próprio esquema e só a inválida sai
 * (com o nome em `invalidKeys`, para o registro do backend); chave desconhecida é ignorada, inclusive dentro dos
 * objetos, para que um campo novo não esconda o conteúdo num app antigo. Nos compromissos, cada um vale sozinho.
 */
export function parsePublicSiteContent(raw: unknown): {
  content: SiteContent
  invalidKeys: string[]
} {
  const content: Record<string, unknown> = {}
  const invalidKeys: string[] = []
  if (!isPlainRecord(raw)) return { content: {}, invalidKeys }
  for (const key of SITE_CONTENT_KEYS) {
    const value = raw[key]
    if (value === undefined) continue
    if (key === 'commitments') {
      if (!isPlainRecord(value)) {
        invalidKeys.push(key)
        continue
      }
      const commitments: Record<string, boolean> = {}
      for (const commitment of SITE_CONTENT_COMMITMENTS) {
        const declared = value[commitment]
        if (declared === undefined) continue
        if (typeof declared === 'boolean') commitments[commitment] = declared
        else invalidKeys.push(`${key}.${commitment}`)
      }
      if (Object.keys(commitments).length > 0) content[key] = commitments
      continue
    }
    const parsed = READ_FIELDS[key].safeParse(value)
    if (parsed.success) content[key] = parsed.data
    else invalidKeys.push(key)
  }
  return { content: content as SiteContent, invalidKeys }
}

// Schema principal para configurações
export const SettingsSchema = z.object({
  // Informações da empresa
  companyPhone: z.string().optional(),
  companyIconUrl: z.string().url().optional().or(z.literal('')),
  aboutUsText: z.string().optional(),
  companyAddress: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  marketingEmail: z.string().email().optional().or(z.literal('')),
  whatsappNumber: z.string().optional(),

  // Hero Carousel
  heroCarousel: z.array(HeroCarouselItemSchema).optional(),
  waveAnimation: z.enum(['none', 'static', 'animated']).default('animated'),

  // Redes sociais
  socialLinks: SocialLinksSchema.optional(),

  // SEO
  seoTitle: z
    .string()
    .min(1, 'Título SEO é obrigatório')
    .max(60, 'Título muito longo'),
  seoDescription: z
    .string()
    .min(1, 'Descrição SEO é obrigatória')
    .max(160, 'Máximo de 160 caracteres para SEO (ideal para Google)'),

  // Tema e aparência
  themeColorPrimary: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Cor deve ser em formato hexadecimal'),
  favicon: z.string().url().optional().or(z.literal('')),
  logoSecondary: z.string().url().optional().or(z.literal('')),

  // Manutenção
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().optional(),

  // Analytics
  analyticsTrackingId: z.string().optional(),

  // Conteúdo
  footerText: z.string().optional(),

  // Horário de funcionamento
  businessHours: BusinessHoursSchema.optional(),

  // Conteúdo institucional da vitrine (onda 134): objeto inteiro; ausente no corpo = sem mudança.
  siteContent: SiteContentSchema.optional(),

  // Suporte
  supportChat: z.boolean().default(true),

  // Localização
  defaultLanguage: z.string().default('pt-BR'),
  baseCurrency: z.string().default('BRL'),

  // Configurações técnicas
  smtpConfig: SmtpConfigSchema.optional(),
  uploadLimits: UploadLimitsSchema.optional(),
  securityConfig: SecurityConfigSchema.optional(),

  // Customização
  customCss: z.string().optional(),
  customJs: z.string().optional(),
})

export type SettingsInput = z.infer<typeof SettingsSchema>
export type HeroCarouselItem = z.infer<typeof HeroCarouselItemSchema>

// ---- Leitura pública das configurações da vitrine (`GET /api/settings/public`) ----------------------------------
//
// Contato, texto, redes e destaques da locadora, mais o horário de funcionamento e a identificação legal (nome
// empresarial e CNPJ da organização), que o rodapé e o contato da vitrine mostram (achado 147; Decreto 7.962/2013,
// art. 2º, I e II). É a leitura da própria vitrine, separada do cartão do diretório
// (`@gb-locacoes/contracts/directory`), que continua sem CNPJ.

/** Dias do horário de funcionamento, na ordem em que a vitrine os mostra (segunda a domingo). */
export const BUSINESS_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
export type BusinessDay = (typeof BUSINESS_DAYS)[number]

/** Hora no formato do painel (`HH:MM`, 00:00 a 23:59). */
export const BUSINESS_TIME_FORMAT = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** Um dia público: fechado, ou aberto com abertura e fechamento válidos. */
export const PublicBusinessDaySchema = z.discriminatedUnion('closed', [
  z.strictObject({ closed: z.literal(true) }),
  z.strictObject({
    closed: z.literal(false),
    open: z.string().regex(BUSINESS_TIME_FORMAT),
    close: z.string().regex(BUSINESS_TIME_FORMAT),
  }),
])

/** Horário público: só os dias informados (o dia sem dado fica de fora, sem valor padrão). */
export const PublicBusinessHoursSchema = z.strictObject({
  monday: PublicBusinessDaySchema.optional(),
  tuesday: PublicBusinessDaySchema.optional(),
  wednesday: PublicBusinessDaySchema.optional(),
  thursday: PublicBusinessDaySchema.optional(),
  friday: PublicBusinessDaySchema.optional(),
  saturday: PublicBusinessDaySchema.optional(),
  sunday: PublicBusinessDaySchema.optional(),
})

/** CNPJ formatado (numérico ou alfanumérico): `00.000.000/0000-00`. */
export const PUBLIC_CNPJ_FORMAT =
  /^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/

/**
 * Identificação legal da locadora na vitrine: o nome empresarial e o CNPJ da organização. `null` no que a locadora
 * não tem (nunca o dado de outra locadora, nem um CPF).
 */
export const PublicLegalIdentitySchema = z.strictObject({
  legalName: z.string().trim().min(1).max(200).nullable(),
  cnpj: z.string().regex(PUBLIC_CNPJ_FORMAT).nullable(),
})

/** Quais textos legais a locadora publicou (Termos, Privacidade e Devolução): `true` só com o documento no ar. */
export const PublicLegalAvailabilitySchema = z.strictObject({
  terms: z.boolean(),
  privacy: z.boolean(),
  returnPolicy: z.boolean(),
})

/** Campos da resposta de `GET /api/settings/public`: nenhum outro sai (SMTP, segurança, scripts...). */
export const PUBLIC_SETTINGS_FIELDS = [
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
  // Onda 134: conteúdo institucional (leitura tolerante por chave) e quais textos legais a locadora publicou. Os
  // textos em si saem só pela rota própria (`GET /api/settings/public/legal-documents/{kind}`).
  'siteContent',
  'legalDocuments',
  // Onda 135 (A4): título e descrição SEO que a própria locadora gravou no painel (texto aparado, sem caractere de
  // controle; vazio é `null`). A vitrine usa na home; sem eles, monta o título com o nome do cartão dela.
  'seoTitle',
  'seoDescription',
] as const

export type PublicBusinessDay = z.infer<typeof PublicBusinessDaySchema>
export type PublicBusinessHours = z.infer<typeof PublicBusinessHoursSchema>
export type PublicLegalIdentity = z.infer<typeof PublicLegalIdentitySchema>
export type PublicLegalAvailability = z.infer<
  typeof PublicLegalAvailabilitySchema
>
export type PublicSettingsField = (typeof PUBLIC_SETTINGS_FIELDS)[number]
