/**
 * Contrato do cadastro self-service da locadora em `app.<raiz>/comecar`
 * (ADR docs/architecture/adr-saas-subscription.md, B.8, D10, D19, D20 e D21).
 *
 * Puro e universal: só zod, literais e `./platform`. Aqui fica só a FORMA dos
 * dados. O dígito verificador do CNPJ (numérico e alfanumérico), a
 * disponibilidade do slug, os termos bloqueados, o limite de organizações e o
 * rate limit são verificados no servidor (domínio no lote S1, casos de uso no
 * S10). Os objetos são estritos: chave a mais (inclusive dado pessoal que o
 * cadastro não pede, como CPF ou data de nascimento) é recusada. Os erros
 * (`{ error, code, suggestions? }`, códigos e status) são do servidor:
 * packages/backend/src/http/onboarding.ts.
 */
import { z } from 'zod'
import { TENANT_SLUG_RE } from './platform'
import {
  CivilDateSchema,
  RecordIdSchema,
  SubscriptionStatusSchema,
} from './subscription'

// ---------------------------------------------------------------------------
// Etapas e flag
// ---------------------------------------------------------------------------

/**
 * Etapas do assistente, na ordem da tela: acesso (nome, e-mail e senha),
 * confirmação do e-mail, empresa, endereço do site, plano, termos e criação.
 * Os passos 1 e 1b são do provedor de identidade; o rascunho de 2 a 5 fica só
 * no navegador.
 */
export const ONBOARDING_STEPS = [
  'ACCOUNT',
  'EMAIL_VERIFICATION',
  'COMPANY',
  'SITE_ADDRESS',
  'PLAN',
  'TERMS',
  'CREATE',
] as const
export const OnboardingStepSchema = z.enum(ONBOARDING_STEPS)
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>

// ---------------------------------------------------------------------------
// Dados da empresa (passo 2)
// ---------------------------------------------------------------------------

/**
 * CNPJ normalizado (`Organization.documentNormalized`): 12 posições
 * alfanuméricas maiúsculas e 2 dígitos verificadores numéricos. Vale para o
 * CNPJ numérico e para o alfanumérico (a partir de julho de 2026).
 */
export const CNPJ_NORMALIZED_RE = /^[0-9A-Z]{12}[0-9]{2}$/

/**
 * Entrada aceita: 14 posições, com ou sem a máscara `XX.XXX.XXX/XXXX-DD`
 * (cada separador é opcional, mas só na sua posição). Letras minúsculas são
 * convertidas para maiúsculas.
 */
const CNPJ_INPUT_RE =
  /^[0-9A-Za-z]{2}\.?[0-9A-Za-z]{3}\.?[0-9A-Za-z]{3}\/?[0-9A-Za-z]{4}-?[0-9]{2}$/

/** Remove a máscara e passa para maiúsculas; `null` se a forma não é de CNPJ. */
export function normalizeCnpjInput(value: string): string | null {
  const trimmed = value.trim()
  if (!CNPJ_INPUT_RE.test(trimmed)) return null
  const normalized = trimmed.replace(/[./-]/g, '').toUpperCase()
  return CNPJ_NORMALIZED_RE.test(normalized) ? normalized : null
}

/** Só forma; o dígito verificador é conferido no domínio (S1) e responde 422. */
export const CnpjSchema = z
  .string()
  .max(32)
  .transform((value, ctx) => {
    const normalized = normalizeCnpjInput(value)
    if (normalized === null) {
      ctx.addIssue({ code: 'custom', message: 'CNPJ com formato inválido.' })
      return z.NEVER
    }
    return normalized
  })

export const COMPANY_TYPES = [
  'MEI',
  'LIMITED',
  'INDIVIDUAL',
  'ASSOCIATION',
] as const
export const CompanyTypeSchema = z.enum(COMPANY_TYPES)

export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const
export const BrazilianStateSchema = z.enum(BRAZILIAN_STATES)

/** CEP com ou sem hífen; sai com 8 dígitos. */
export const PostalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, { message: 'CEP inválido.' })
  .transform((value) => value.replace('-', ''))

const PHONE_INPUT_RE = /^\+?[\d\s().-]{10,20}$/
const PHONE_NORMALIZED_RE = /^[1-9]{2}(?:9\d{8}|[2-5]\d{7})$/

/**
 * Celular ou WhatsApp brasileiro. Aceita `+55`, espaços, parênteses, pontos e
 * hífens; sai só com DDD e número (10 ou 11 dígitos).
 */
export const BrazilianPhoneSchema = z
  .string()
  .trim()
  .regex(PHONE_INPUT_RE, { message: 'Telefone inválido.' })
  .transform((value, ctx) => {
    let digits = value.replace(/\D/g, '')
    if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
    if (!PHONE_NORMALIZED_RE.test(digits)) {
      ctx.addIssue({ code: 'custom', message: 'Telefone inválido.' })
      return z.NEVER
    }
    return digits
  })

const text = (min: number, max: number) => z.string().trim().min(min).max(max)

/**
 * Passo "Sua empresa". Os campos têm o nome das colunas de `Organization`
 * (`tradeName` vira `Organization.name`). E-mail de cobrança, sócios e
 * documentos pessoais não fazem parte do cadastro.
 */
export const CompanyDataSchema = z.strictObject({
  cnpj: CnpjSchema,
  legalName: text(2, 200),
  tradeName: text(2, 200),
  companyType: CompanyTypeSchema,
  phone: BrazilianPhoneSchema,
  postalCode: PostalCodeSchema,
  addressLine: text(1, 200),
  addressNumber: text(1, 30),
  addressComplement: text(1, 200).nullable(),
  district: text(1, 120),
  city: text(1, 120),
  state: BrazilianStateSchema,
  /** "Tenho poderes para representar a empresa." */
  representationDeclared: z.literal(true),
})
export type CompanyDataInput = z.input<typeof CompanyDataSchema>
export type CompanyData = z.infer<typeof CompanyDataSchema>

// ---------------------------------------------------------------------------
// Endereço do site (passo 3)
// ---------------------------------------------------------------------------

/**
 * Slug pedido no cadastro: só a sintaxe de `TENANT_SLUG_RE`. Reservado,
 * bloqueado (`blockedSlugTerms`) ou já usado responde 409 `SLUG_UNAVAILABLE`,
 * sem dizer o motivo.
 */
export const SignupSlugSchema = z.string().regex(TENANT_SLUG_RE, {
  message: 'Use de 2 a 63 letras minúsculas, números ou hífens.',
})

/** `GET /api/onboarding/slug-availability?slug=`. */
export const SlugAvailabilityQuerySchema = z.strictObject({
  slug: z.string().trim().min(1).max(63),
})

export const SLUG_SUGGESTIONS_MAX = 5

/** Só disponível ou indisponível com sugestões; nunca o motivo. */
export const SlugAvailabilityResponseSchema = z.discriminatedUnion(
  'available',
  [
    z.strictObject({ available: z.literal(true) }),
    z.strictObject({
      available: z.literal(false),
      suggestions: z.array(SignupSlugSchema).max(SLUG_SUGGESTIONS_MAX),
    }),
  ]
)
export type SlugAvailabilityResponse = z.infer<
  typeof SlugAvailabilityResponseSchema
>

// ---------------------------------------------------------------------------
// Termos (passo 5)
// ---------------------------------------------------------------------------

export const LEGAL_DOCUMENT_KINDS = [
  'PLATFORM_TERMS',
  'PRIVACY_POLICY',
  'DATA_PROCESSING_AGREEMENT',
  'PAYMENTS_PARTNER_NOTICE',
  'MARKETING_OPT_IN',
] as const
export const LegalDocumentKindSchema = z.enum(LEGAL_DOCUMENT_KINDS)
export type LegalDocumentKind = z.infer<typeof LegalDocumentKindSchema>

/** Documentos que o cadastro exige, em caixas não marcadas. Marketing é à parte. */
export const REQUIRED_SIGNUP_DOCUMENTS = Object.freeze([
  'PLATFORM_TERMS',
  'PRIVACY_POLICY',
  'DATA_PROCESSING_AGREEMENT',
  'PAYMENTS_PARTNER_NOTICE',
] as const satisfies readonly LegalDocumentKind[])

/**
 * Aceite do texto que a pessoa viu: versão (data de publicação) e SHA-256 do
 * texto. O servidor confere com o documento vigente antes de gravar
 * `LegalAcceptance`; IP e agente de usuário são tomados da requisição.
 */
export const LegalAcceptanceInputSchema = z.strictObject({
  kind: LegalDocumentKindSchema,
  version: CivilDateSchema,
  textSha256: z.string().regex(/^[0-9a-f]{64}$/),
})
export type LegalAcceptanceInput = z.infer<typeof LegalAcceptanceInputSchema>

/** Exact published text shown by the assistant; never HTML or a client-supplied publication. */
const PublishedSignupDocumentSchema = LegalAcceptanceInputSchema.extend({
  text: z.string().min(1).max(32768),
})
export const OnboardingOptionsResponseSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('off') }),
  z.strictObject({
    mode: z.literal('on'),
    rootDomain: z.string().min(1).max(253),
    captchaSiteKey: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
    documents: z
      .array(PublishedSignupDocumentSchema)
      .min(4)
      .max(5)
      .superRefine((documents, ctx) => {
        const kinds = documents.map((published) => published.kind)
        if (
          new Set(kinds).size !== kinds.length ||
          !REQUIRED_SIGNUP_DOCUMENTS.every((kind) => kinds.includes(kind))
        )
          ctx.addIssue({
            code: 'custom',
            message: 'Publicação obrigatória incompleta ou repetida.',
          })
      }),
  }),
])
export type OnboardingOptionsResponse = z.infer<
  typeof OnboardingOptionsResponseSchema
>

/** Os quatro documentos obrigatórios, cada um uma vez; marketing opcional. */
export const SignupAcceptancesSchema = z
  .array(LegalAcceptanceInputSchema)
  .min(REQUIRED_SIGNUP_DOCUMENTS.length)
  .max(LEGAL_DOCUMENT_KINDS.length)
  .superRefine((acceptances, ctx) => {
    const kinds = acceptances.map((acceptance) => acceptance.kind)
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({ code: 'custom', message: 'Documento aceito em dobro.' })
    }
    for (const kind of REQUIRED_SIGNUP_DOCUMENTS) {
      if (!kinds.includes(kind)) {
        ctx.addIssue({
          code: 'custom',
          message: `Aceite obrigatório: ${kind}.`,
        })
      }
    }
  })

// ---------------------------------------------------------------------------
// Criação (passo 6)
// ---------------------------------------------------------------------------

/** Chave de idempotência gerada pelo navegador (ex.: UUID). */
export const IdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/)

/** `POST /api/onboarding/organizations`, com o cabeçalho `Idempotency-Key`. */
export const CreateOrganizationInputSchema = z.strictObject({
  company: CompanyDataSchema,
  slug: SignupSlugSchema,
  planVersionId: RecordIdSchema,
  acceptances: SignupAcceptancesSchema,
})
export type CreateOrganizationInput = z.input<
  typeof CreateOrganizationInputSchema
>

/** Avisos da criação: o teste grátis não vale para CNPJ ou e-mail que já usou. */
export const ONBOARDING_NOTICES = ['TRIAL_ALREADY_USED'] as const
export const OnboardingNoticeSchema = z.enum(ONBOARDING_NOTICES)

/** 201 da criação (e a mesma resposta ao repetir a `Idempotency-Key`). */
export const CreateOrganizationResponseSchema = z
  .strictObject({
    organization: z.strictObject({
      id: RecordIdSchema,
      slug: SignupSlugSchema,
      name: text(2, 200),
    }),
    subscription: z.strictObject({
      status: z.enum(['TRIALING', 'INCOMPLETE']),
      trialEndsAt: CivilDateSchema.nullable(),
    }),
    notices: z.array(OnboardingNoticeSchema).max(ONBOARDING_NOTICES.length),
  })
  .refine(
    (body) =>
      (body.subscription.status === 'TRIALING') ===
      (body.subscription.trialEndsAt !== null),
    {
      message: 'trialEndsAt existe só em TRIALING.',
      path: ['subscription', 'trialEndsAt'],
    }
  )
export type CreateOrganizationResponse = z.infer<
  typeof CreateOrganizationResponseSchema
>

// ---------------------------------------------------------------------------
// Checklist "Primeiros passos" (GET /api/onboarding/status)
// ---------------------------------------------------------------------------

/**
 * Itens na ordem da tela. `SUBSCRIBE` só aparece no teste;
 * `CONFIRM_COMMERCIAL_INFO`, só quando chega o pedido de confirmação anual.
 */
export const ONBOARDING_CHECKLIST_ITEMS = [
  'ACCOUNT_CREATED',
  'FIRST_EQUIPMENT',
  'CUSTOMIZE_SITE',
  'PUBLISH_SITE',
  'ACTIVATE_ONLINE_PAYMENTS',
  'SUBSCRIBE',
  'CONFIRM_COMMERCIAL_INFO',
] as const
export const OnboardingChecklistItemSchema = z.enum(ONBOARDING_CHECKLIST_ITEMS)
export type OnboardingChecklistItem = z.infer<
  typeof OnboardingChecklistItemSchema
>

const OPTIONAL_CHECKLIST_ITEMS: readonly OnboardingChecklistItem[] = [
  'SUBSCRIBE',
  'CONFIRM_COMMERCIAL_INFO',
]

export const OnboardingStatusResponseSchema = z
  .strictObject({
    subscriptionStatus: SubscriptionStatusSchema,
    items: z.array(
      z.strictObject({
        id: OnboardingChecklistItemSchema,
        done: z.boolean(),
      })
    ),
  })
  .superRefine((body, ctx) => {
    const ids = body.items.map((item) => item.id)
    const expected = ONBOARDING_CHECKLIST_ITEMS.filter(
      (id) => ids.includes(id) || !OPTIONAL_CHECKLIST_ITEMS.includes(id)
    )
    if (
      ids.length !== expected.length ||
      ids.some((id, i) => id !== expected[i])
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Itens fora de ordem, repetidos ou faltando.',
        path: ['items'],
      })
    }
    if (
      ids.includes('SUBSCRIBE') !==
      (body.subscriptionStatus === 'TRIALING')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'SUBSCRIBE aparece só no teste.',
        path: ['items'],
      })
    }
  })
export type OnboardingStatusResponse = z.infer<
  typeof OnboardingStatusResponseSchema
>

/** Receipt of explicit site publication; does not imply search indexing or payments. */
export const SitePublicationResponseSchema = z.strictObject({
  published: z.literal(true),
  publishedAt: z.string().datetime(),
})
