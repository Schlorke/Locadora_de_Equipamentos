/**
 * Contrato da conta de recebimentos da locadora (ADR
 * docs/architecture/adr-saas-subscription.md, B.7, D9, D10, D12 e D22).
 *
 * Três modos, um por locadora:
 * - `BAAS`: subconta Asaas BaaS, padrão de produção (documentos e saque dentro
 *   da plataforma);
 * - `STANDARD`: subconta Asaas padrão, só no piloto;
 * - `CONNECTED`: conta Asaas própria da locadora, conectada por chave (GB e
 *   plano B).
 *
 * Puro e universal: só zod e literais. Nenhuma resposta expõe chave, token,
 * `credentialsRef`, `walletId`, `onboardingUrl` gravado ou dado bancário. Na
 * tela, o nome é sempre "conta de recebimentos" (nunca "subconta", "KYC" ou
 * "webhook").
 */
import { z } from 'zod'
import { MoneySchema } from './entitlements'
import { BrazilianPhoneSchema, CompanyTypeSchema } from './onboarding'
import { AsaasHostedUrlSchema, InstantSchema } from './subscription'

// ---------------------------------------------------------------------------
// Enumerações (espelham os enums do schema Prisma da seção B.3)
// ---------------------------------------------------------------------------

export const PAYMENT_ACCOUNT_MODES = [
  'ASAAS_SUBACCOUNT',
  'ASAAS_CONNECTED_ACCOUNT',
] as const
export const PaymentAccountModeSchema = z.enum(PAYMENT_ACCOUNT_MODES)
export type PaymentAccountMode = z.infer<typeof PaymentAccountModeSchema>

/** Também é o valor de `PLATFORM_ASAAS_SUBACCOUNT_MODEL`. */
export const SUBACCOUNT_MODELS = ['STANDARD', 'BAAS'] as const
export const SubaccountModelSchema = z.enum(SUBACCOUNT_MODELS)
export type SubaccountModel = z.infer<typeof SubaccountModelSchema>

export const PAYMENT_ACCOUNT_STATUSES = [
  'DRAFT',
  'PROVISIONING',
  'UNKNOWN',
  'KEY_RECOVERY_REQUIRED',
  'AWAITING_OWNER',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RESTRICTED',
  'BLOCKED',
  'DISCONNECTED',
] as const
export const PaymentAccountStatusSchema = z.enum(PAYMENT_ACCOUNT_STATUSES)
export type PaymentAccountStatus = z.infer<typeof PaymentAccountStatusSchema>

/** Problema de saúde da chave ou do webhook (`PaymentAccount.healthIssue`). */
export const PAYMENT_ACCOUNT_HEALTH_ISSUES = [
  'KEY_DISABLED',
  'KEY_EXPIRED',
  'KEY_DELETED',
  'WEBHOOK_MISSING',
  'WEBHOOK_INTERRUPTED',
  'COMMERCIAL_INFO_EXPIRED',
] as const
export const PaymentAccountHealthIssueSchema = z.enum(
  PAYMENT_ACCOUNT_HEALTH_ISSUES
)
export type PaymentAccountHealthIssue = z.infer<
  typeof PaymentAccountHealthIssueSchema
>

export const PAYMENT_PROVIDER_ENVIRONMENTS = ['sandbox', 'production'] as const
export const PaymentProviderEnvironmentSchema = z.enum(
  PAYMENT_PROVIDER_ENVIRONMENTS
)
export type PaymentProviderEnvironment = z.infer<
  typeof PaymentProviderEnvironmentSchema
>

/** Saque (só BaaS, lote S14). */
export const PAYOUT_STATUSES = [
  'REQUESTED',
  'SUBMITTING',
  'SUBMITTED',
  'DONE',
  'REFUSED',
  'FAILED',
] as const
export const PayoutStatusSchema = z.enum(PAYOUT_STATUSES)
export type PayoutStatus = z.infer<typeof PayoutStatusSchema>

// ---------------------------------------------------------------------------
// Modo da conta
// ---------------------------------------------------------------------------

export const PAYMENT_ACCOUNT_KINDS = ['BAAS', 'STANDARD', 'CONNECTED'] as const
export const PaymentAccountKindSchema = z.enum(PAYMENT_ACCOUNT_KINDS)
export type PaymentAccountKind = z.infer<typeof PaymentAccountKindSchema>

/**
 * `mode` e `subaccountModel` como no banco: subconta exige o modelo; conta
 * conectada não tem modelo (CHECK da seção B.3).
 */
export const PaymentAccountSetupSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('ASAAS_SUBACCOUNT'),
    subaccountModel: SubaccountModelSchema,
  }),
  z.strictObject({
    mode: z.literal('ASAAS_CONNECTED_ACCOUNT'),
    subaccountModel: z.null(),
  }),
])
export type PaymentAccountSetup = z.infer<typeof PaymentAccountSetupSchema>

/** Modo exibido: `BAAS`, `STANDARD` ou `CONNECTED`. */
export function paymentAccountKind(
  setup: PaymentAccountSetup
): PaymentAccountKind {
  return setup.mode === 'ASAAS_CONNECTED_ACCOUNT'
    ? 'CONNECTED'
    : setup.subaccountModel
}

// ---------------------------------------------------------------------------
// Visão do dono (GET /api/admin/payment-account)
// ---------------------------------------------------------------------------

/**
 * Texto de status devolvido pelo Asaas para "Precisa de correção" (só o
 * código ou a frase do provedor, nunca documento nem dado bancário).
 */
const ProviderStatusTextSchema = z.string().trim().min(1).max(300)

/**
 * Só estado, datas e saúde. Sem ids do provedor, `walletId`, chave, token ou
 * link de documentos (o link é pedido na hora em `documents-link`).
 */
export const PaymentAccountViewSchema = z.strictObject({
  kind: PaymentAccountKindSchema,
  status: PaymentAccountStatusSchema,
  environment: PaymentProviderEnvironmentSchema,
  healthIssue: PaymentAccountHealthIssueSchema.nullable(),
  providerStatusText: ProviderStatusTextSchema.nullable(),
  commercialInfoExpiresAt: InstantSchema.nullable(),
  commercialInfoExpired: z.boolean(),
  approvedAt: InstantSchema.nullable(),
  lastSyncedAt: InstantSchema.nullable(),
})
export type PaymentAccountView = z.infer<typeof PaymentAccountViewSchema>

/** `null` quando a locadora ainda não pediu a conta. */
export const PaymentAccountResponseSchema = z.strictObject({
  account: PaymentAccountViewSchema.nullable(),
})
export type PaymentAccountResponse = z.infer<
  typeof PaymentAccountResponseSchema
>

// ---------------------------------------------------------------------------
// Ações do dono (sessão fresca)
// ---------------------------------------------------------------------------

const MOBILE_PHONE_RE = /^[1-9]{2}9\d{8}$/

/**
 * Celular brasileiro (DDD + 9 + 8 dígitos): o campo do Asaas é `mobilePhone`.
 * Só a forma técnica do campo, nenhuma regra de negócio.
 */
export const BrazilianMobilePhoneSchema = BrazilianPhoneSchema.refine(
  (value) => MOBILE_PHONE_RE.test(value),
  { message: 'Celular inválido.' }
)

/**
 * Dados comerciais declarados pelo dono: faturamento mensal exato (decisão de
 * 2026-10-06; reais com centavos exatos, string decimal na borda, nunca
 * `number`), celular e a confirmação dos dados da empresa exibidos. Serve à
 * confirmação anual (`confirm-commercial-info`); a criação usa
 * `CreatePaymentAccountInputSchema`, que acrescenta a versão dos dados. Sem
 * mínimo nem teto: seriam limites de negócio (o que o Asaas aceita é
 * VERIFICAR-SANDBOX, lote S15).
 */
export const PaymentAccountCommercialInfoInputSchema = z.strictObject({
  incomeValue: MoneySchema,
  mobilePhone: BrazilianMobilePhoneSchema,
  companyDataConfirmed: z.literal(true),
})
export type PaymentAccountCommercialInfoInput = z.input<
  typeof PaymentAccountCommercialInfoInputSchema
>

/** Versão (SHA-256) dos dados da empresa exibidos ao dono e confirmados por ele. */
const CompanyDataVersionSchema = z.string().regex(/^[a-f0-9]{64}$/)

/**
 * `POST /api/admin/payment-account/create`. Os dados da empresa vêm do
 * cadastro; o dono informa o faturamento e o celular, confirma os dados e
 * devolve a versão que viu (dados alterados depois disso recusam o pedido).
 */
export const CreatePaymentAccountInputSchema = z.strictObject({
  ...PaymentAccountCommercialInfoInputSchema.shape,
  companyDataVersion: CompanyDataVersionSchema,
})

/** Aceite do pedido: não certifica criação nem aprovação. Consulte a visão do dono. */
export const CreatePaymentAccountResponseSchema = z.strictObject({
  accepted: z.literal(true),
})
export type CreatePaymentAccountResponse = z.infer<
  typeof CreatePaymentAccountResponseSchema
>

/** Por que a criação não está disponível agora; avaliados nesta ordem. */
const PAYMENT_ACCOUNT_CREATION_BLOCKERS = [
  'CREATION_UNAVAILABLE',
  'ACCOUNT_EXISTS',
  'SUBSCRIPTION_RESTRICTED',
  'MODULE_NOT_IN_PLAN',
  'FIRST_PAYMENT_REQUIRED',
  'EMAIL_NOT_VERIFIED',
  'PAYMENTS_NOTICE_REQUIRED',
  'COMPANY_DATA_INCOMPLETE',
  'DOCUMENT_IN_USE',
] as const

/**
 * Desfecho do último pedido cancelado (só a categoria; os códigos do provedor
 * ficam na auditoria da plataforma).
 */
const PAYMENT_ACCOUNT_LAST_REQUEST_OUTCOMES = [
  'REJECTED_DATA',
  'REJECTED_PROVIDER',
  'CANCELLED',
] as const

const companyText = (max: number) => z.string().trim().min(1).max(max)

/** Exatamente os dados enviados à instituição de pagamentos na criação. */
const CreationCompanySchema = z.strictObject({
  legalName: companyText(128),
  cnpj: z
    .string()
    .regex(/^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/),
  companyType: CompanyTypeSchema,
  loginEmail: z.email().max(254),
  email: z.email().max(254),
  address: z.strictObject({
    street: companyText(200),
    number: companyText(32),
    complement: companyText(100).nullable(),
    district: companyText(100),
    postalCode: z.string().regex(/^\d{8}$/),
  }),
  site: z.url({ protocol: /^https$/ }).max(2048),
})

/**
 * `GET /api/admin/payment-account/create`: a oferta de criação. Disponível só
 * sem bloqueio, com os dados da empresa e a versão; indisponível nunca expõe
 * dados da empresa. Nunca carrega faturamento, chave, ids do provedor ou
 * código do provedor.
 */
export const PaymentAccountCreationOfferSchema = z
  .strictObject({
    available: z.boolean(),
    blocker: z.enum(PAYMENT_ACCOUNT_CREATION_BLOCKERS).nullable(),
    model: SubaccountModelSchema.nullable(),
    company: CreationCompanySchema.nullable(),
    suggestedMobilePhone: z.string().regex(MOBILE_PHONE_RE).nullable(),
    companyDataVersion: CompanyDataVersionSchema.nullable(),
    lastRequestOutcome: z
      .enum(PAYMENT_ACCOUNT_LAST_REQUEST_OUTCOMES)
      .nullable(),
  })
  .refine(
    (offer) =>
      offer.available
        ? offer.blocker === null &&
          offer.model !== null &&
          offer.company !== null &&
          offer.companyDataVersion !== null
        : offer.blocker !== null &&
          offer.model === null &&
          offer.company === null &&
          offer.suggestedMobilePhone === null &&
          offer.companyDataVersion === null,
    { message: 'Oferta de criação inconsistente.' }
  )
export type PaymentAccountCreationOffer = z.infer<
  typeof PaymentAccountCreationOfferSchema
>

/**
 * Chave de API do Asaas colada pelo dono (`connect`, tela `no-store`). Aceita
 * o formato antigo (`$aact_<base64>`) e o novo (`$aact_prod_…`, `$aact_hmlg_…`).
 * Nunca registre este objeto: a mensagem de erro do zod não repete o valor.
 * VERIFICAR-SANDBOX: conjunto de caracteres e tamanho máximo da chave.
 */
export const ASAAS_API_KEY_RE = /^\$aact_[A-Za-z0-9+/=_:$.-]{16,1024}$/

export const ConnectAsaasAccountInputSchema = z.strictObject({
  apiKey: z.string().regex(ASAAS_API_KEY_RE, {
    message: 'Chave de API do Asaas com formato inválido.',
  }),
})
export type ConnectAsaasAccountInput = z.infer<
  typeof ConnectAsaasAccountInputSchema
>

/** Accepted connection does not certify that online payments are ready. Consult the owner view. */
export const ConnectAsaasAccountResponseSchema = z.strictObject({
  accepted: z.literal(true),
})
export type ConnectAsaasAccountResponse = z.infer<
  typeof ConnectAsaasAccountResponseSchema
>

/** Recovery is financial verification, never permission to resume event delivery. */
export const AccountRecoveryViewSchema = z.strictObject({
  state: z.enum([
    'WAITING',
    'CHECKING',
    'REVIEW_REQUIRED',
    'SNAPSHOT_COMPLETE',
    'ACCESS_REQUIRED',
  ]),
  checked: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  lastCheckedAt: InstantSchema.nullable(),
  requestPending: z.boolean(),
  canRequest: z.boolean(),
})
export type AccountRecoveryView = z.infer<typeof AccountRecoveryViewSchema>
export const AccountRecoveryResponseSchema = z.strictObject({
  recovery: AccountRecoveryViewSchema.nullable(),
})
export const RequestAccountRecoveryInputSchema = z.strictObject({
  confirmation: z.literal(true),
})
export const RequestAccountRecoveryResponseSchema = z.strictObject({
  accepted: z.literal(true),
})

/**
 * `POST /api/admin/payment-account/documents-link` (só BaaS): o link é buscado
 * na hora, entregue só ao dono com `no-store` e nunca gravado.
 * VERIFICAR-SANDBOX: domínio do `onboardingUrl`.
 */
export const DocumentsLinkResponseSchema = z.strictObject({
  url: AsaasHostedUrlSchema,
})
export type DocumentsLinkResponse = z.infer<typeof DocumentsLinkResponseSchema>

/**
 * `POST /api/admin/payment-account/payouts` (só BaaS, dono com 2FA). O destino
 * é sempre a conta bancária do próprio CNPJ cadastrada no Asaas: nenhum campo
 * de destino é aceito.
 */
export const PayoutRequestInputSchema = z
  .strictObject({ amount: MoneySchema })
  .refine((payout) => payout.amount !== '0.00', {
    message: 'Valor do saque precisa ser maior que zero.',
    path: ['amount'],
  })
export type PayoutRequestInput = z.infer<typeof PayoutRequestInputSchema>
