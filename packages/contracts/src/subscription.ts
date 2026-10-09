/**
 * Contrato da assinatura da plataforma: catálogo de planos, estados, projeção
 * de acesso, faturas da mensalidade e escritas permitidas com a conta em pausa
 * (ADR docs/architecture/adr-saas-subscription.md, B.3, B.5, B.6, D1, D6, D13,
 * D14 e D23).
 *
 * Puro e universal: só zod e literais. A derivação do estado a partir dos
 * fatos (`derivarEstado`) e a tabela de transições ficam no domínio
 * (`packages/domain/src/assinatura`, lote S1); aqui ficam só formas e
 * constantes. Datas civis (`@db.Date`) trafegam como `AAAA-MM-DD`; instantes,
 * como ISO 8601 com fuso. Dinheiro, como string decimal (`Money`).
 */
import { z } from 'zod'
import {
  EntitlementsV1Schema,
  MoneySchema,
  SignedMoneySchema,
} from './entitlements'

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

/** Identificador opaco de linha (cuid e afins): sem espaços nem separadores. */
export const RecordIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)

/** Dia civil `AAAA-MM-DD` (America/Sao_Paulo no domínio). */
export const CivilDateSchema = z.iso.date()

/** Instante ISO 8601 com `Z` ou deslocamento explícito. */
export const InstantSchema = z.iso.datetime({ offset: true })

/** Código técnico em maiúsculas (motivo de evento, código de erro de provedor). */
export const EventCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)

// ---------------------------------------------------------------------------
// Enumerações (espelham os enums do schema Prisma da seção B.3)
// ---------------------------------------------------------------------------

export const BILLING_INTERVALS = ['MONTHLY', 'YEARLY'] as const
export const BillingIntervalSchema = z.enum(BILLING_INTERVALS)
export type BillingInterval = z.infer<typeof BillingIntervalSchema>

/** Os seis estados da assinatura (D6), na ordem do ciclo de vida. */
export const SUBSCRIPTION_STATUSES = [
  'INCOMPLETE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELED',
] as const
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES)
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>

/** Projeção gravada em `Organization.access` (D1 e D6). */
export const ORGANIZATION_ACCESS = [
  'SETUP',
  'FULL',
  'RESTRICTED',
  'ARCHIVED',
] as const
export const OrganizationAccessSchema = z.enum(ORGANIZATION_ACCESS)
export type OrganizationAccess = z.infer<typeof OrganizationAccessSchema>

export const SUBSCRIPTION_BILLING_MODES = ['ASAAS', 'COMPLIMENTARY'] as const
export const SubscriptionBillingModeSchema = z.enum(SUBSCRIPTION_BILLING_MODES)
export type SubscriptionBillingMode = z.infer<
  typeof SubscriptionBillingModeSchema
>

export const PROVIDER_SYNC_STATES = [
  'NOT_REQUIRED',
  'PENDING',
  'PROCESSING',
  'UNKNOWN',
  'SYNCED',
  'FAILED',
] as const
export const ProviderSyncStateSchema = z.enum(PROVIDER_SYNC_STATES)
export type ProviderSyncState = z.infer<typeof ProviderSyncStateSchema>

export const SUBSCRIPTION_EVENT_SOURCES = [
  'WEBHOOK',
  'JOB',
  'OWNER',
  'STAFF',
  'SYSTEM',
  'RECONCILIATION',
] as const
export const SubscriptionEventSourceSchema = z.enum(SUBSCRIPTION_EVENT_SOURCES)
export type SubscriptionEventSource = z.infer<
  typeof SubscriptionEventSourceSchema
>

/** Motivo do encerramento (`Subscription.cancelReason`, CHECK no banco). */
export const CANCEL_REASONS = [
  'OWNER_REQUEST',
  'NON_PAYMENT',
  'TRIAL_EXPIRED',
  'ABANDONED',
  'STAFF',
] as const
export const CancelReasonSchema = z.enum(CANCEL_REASONS)
export type CancelReason = z.infer<typeof CancelReasonSchema>

export const PLATFORM_INVOICE_KINDS = ['CYCLE', 'ADJUSTMENT'] as const
export const PlatformInvoiceKindSchema = z.enum(PLATFORM_INVOICE_KINDS)
export type PlatformInvoiceKind = z.infer<typeof PlatformInvoiceKindSchema>

export const PLATFORM_INVOICE_STATUSES = [
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELED',
  'REFUNDED',
  'CHARGEBACK',
] as const
export const PlatformInvoiceStatusSchema = z.enum(PLATFORM_INVOICE_STATUSES)
export type PlatformInvoiceStatus = z.infer<typeof PlatformInvoiceStatusSchema>

/** Por que uma fatura da mensalidade foi cancelada (`canceledReason`). */
export const INVOICE_CANCEL_REASONS = [
  'FUTURE_AFTER_CANCEL',
  'REACTIVATION_WAIVER',
  'PROVIDER_DELETED',
] as const
export const InvoiceCancelReasonSchema = z.enum(INVOICE_CANCEL_REASONS)
export type InvoiceCancelReason = z.infer<typeof InvoiceCancelReasonSchema>

/** Forma de pagamento da fatura hospedada (`billingType`). */
export const INVOICE_BILLING_TYPES = [
  'PIX',
  'BOLETO',
  'CREDIT_CARD',
  'UNDEFINED',
  'RECEIVED_IN_CASH',
] as const
export const InvoiceBillingTypeSchema = z.enum(INVOICE_BILLING_TYPES)
export type InvoiceBillingType = z.infer<typeof InvoiceBillingTypeSchema>

/** Modo do site público derivado de `sitePublishedAt`, `access` e `siteIndexable` (B.10). */
export const PUBLIC_SITE_MODES = ['LIVE', 'PAUSED', 'OFF'] as const
export const PublicSiteModeSchema = z.enum(PUBLIC_SITE_MODES)
export type PublicSiteMode = z.infer<typeof PublicSiteModeSchema>

// ---------------------------------------------------------------------------
// Site público por estado (S13; B.5, linha "Site público"; B.10, linha "Público")
// ---------------------------------------------------------------------------

/**
 * Código estável das APIs públicas da vitrine (catálogo, busca, disponibilidade,
 * orçamento e contato) com o site em pausa (`PAUSED`). A resposta é sempre
 * `503 { error: SITE_PAUSED_MESSAGE, code: 'SITE_PAUSED' }` com
 * `SITE_PAUSED_HEADERS`. O site desligado (`OFF`) responde o 404 neutro de
 * locadora desconhecida (D10 da ADR de hosts), nunca este código.
 */
export const SITE_PAUSED_CODE = 'SITE_PAUSED' as const
/** Texto neutro: não cita assinatura, dívida nem plataforma. */
export const SITE_PAUSED_MESSAGE =
  'Este site está temporariamente indisponível.'
/** Segundos do `Retry-After` do 503 da vitrine em pausa (API e página). */
export const SITE_PAUSED_RETRY_AFTER_SECONDS = 3600
/** Cabeçalhos de toda resposta 503 da vitrine em pausa, da API e da página. */
export const SITE_PAUSED_HEADERS: Readonly<Record<string, string>> =
  Object.freeze({
    'Cache-Control': 'no-store',
    'Retry-After': String(SITE_PAUSED_RETRY_AFTER_SECONDS),
    'X-Robots-Tag': 'noindex',
  })

/**
 * Cabeçalhos do cartão público (`GET /api/public/tenants/{slug}`), que continua
 * respondendo com o site em pausa: o modo (`LIVE` ou `PAUSED`) e se as páginas
 * podem ser indexadas (`true` ou `false`). O host web lê os dois para escolher
 * a página de pausa, o 503 e o `noindex`; o corpo do cartão não muda.
 */
export const SITE_MODE_HEADER = 'x-site-mode'
export const SITE_INDEXABLE_HEADER = 'x-site-indexable'

/**
 * Cartão no escopo da área do cliente (B.5, linha "Área do cliente final"):
 * `GET /api/public/tenants/{slug}?scope=client-area`. Responde enquanto a área
 * do cliente existe, inclusive com o site desligado por falta de publicação, e
 * então leva `x-site-mode: OFF`; sem a área (locadora desconhecida, bloqueio
 * administrativo, SETUP ou ARCHIVED com a fiscalização `on`), o mesmo 404
 * neutro do D10. Sem o parâmetro, o cartão segue a vitrine: OFF é 404. O host
 * web usa este escopo no layout da locadora, pai da vitrine e da área do cliente.
 */
export const PUBLIC_TENANT_CARD_SCOPE_PARAM = 'scope'
export const CLIENT_AREA_CARD_SCOPE = 'client-area'

/** `PLATFORM_SUBSCRIPTION_ENFORCEMENT` (D23): `off` trata tudo como FULL. */
export const SUBSCRIPTION_ENFORCEMENT_MODES = ['off', 'shadow', 'on'] as const
export const SubscriptionEnforcementSchema = z.enum(
  SUBSCRIPTION_ENFORCEMENT_MODES
)
export type SubscriptionEnforcement = z.infer<
  typeof SubscriptionEnforcementSchema
>

// ---------------------------------------------------------------------------
// Projeção de acesso (D6)
// ---------------------------------------------------------------------------

/**
 * Estado da assinatura → `Organization.access`. Nenhum estado apaga dados.
 * INCOMPLETE: SETUP; TRIALING, ACTIVE e PAST_DUE: FULL; SUSPENDED: RESTRICTED;
 * CANCELED: ARCHIVED.
 */
export const SUBSCRIPTION_ACCESS: Readonly<
  Record<SubscriptionStatus, OrganizationAccess>
> = Object.freeze({
  INCOMPLETE: 'SETUP',
  TRIALING: 'FULL',
  ACTIVE: 'FULL',
  PAST_DUE: 'FULL',
  SUSPENDED: 'RESTRICTED',
  CANCELED: 'ARCHIVED',
})

export function accessForSubscriptionStatus(
  status: SubscriptionStatus
): OrganizationAccess {
  return SUBSCRIPTION_ACCESS[status]
}

// ---------------------------------------------------------------------------
// Escritas permitidas em RESTRICTED (B.5)
// ---------------------------------------------------------------------------

/**
 * Exceções que uma rota de mutação declara em `allowWhenRestricted` para
 * continuar funcionando com a conta em pausa. Todo o resto responde 402
 * `SUBSCRIPTION_RESTRICTED`. O inventário de rotas (T-E1) confere a lista.
 */
export const RESTRICTED_MUTATION_ALLOWLIST = Object.freeze([
  'SUBSCRIPTION_PAY',
  'SUBSCRIPTION_CHANGE_PLAN',
  'SUBSCRIPTION_CANCEL',
  'SUBSCRIPTION_REACTIVATE',
  'DATA_EXPORT',
  'PAYMENT_ACCOUNT_RECONNECT',
  'SUPPORT_ACCESS_GRANT',
  'RENTAL_RETURN',
  'RENTAL_CLOSE',
  'DELIVERY_COMPLETE',
  'PAYMENT_MANUAL_SETTLEMENT',
  'PAYMENT_REISSUE',
  'PAYMENT_CANCEL',
  'OWN_PROFILE',
  'OWN_PASSWORD',
  'STOREFRONT_LEGAL_DOCUMENT',
] as const)
export type RestrictedMutationCode =
  (typeof RESTRICTED_MUTATION_ALLOWLIST)[number]
export const RestrictedMutationCodeSchema = z.enum(
  RESTRICTED_MUTATION_ALLOWLIST
)

/** O que cada exceção cobre, para o inventário e a revisão humana. */
export const RESTRICTED_MUTATION_SCOPE: Readonly<
  Record<RestrictedMutationCode, string>
> = Object.freeze({
  SUBSCRIPTION_PAY: 'Pagar a assinatura (ativar e quitar faturas).',
  SUBSCRIPTION_CHANGE_PLAN: 'Trocar de plano, só depois de quitar a dívida.',
  SUBSCRIPTION_CANCEL: 'Cancelar a assinatura ou desfazer o cancelamento.',
  SUBSCRIPTION_REACTIVATE: 'Reativar a assinatura.',
  DATA_EXPORT: 'Exportar os dados da locadora.',
  PAYMENT_ACCOUNT_RECONNECT: 'Reconectar a conta de recebimentos.',
  SUPPORT_ACCESS_GRANT: 'Conceder ou revogar acesso de suporte.',
  RENTAL_RETURN: 'Registrar devolução de locação.',
  RENTAL_CLOSE: 'Encerrar locação.',
  DELIVERY_COMPLETE: 'Concluir entrega agendada.',
  PAYMENT_MANUAL_SETTLEMENT: 'Dar baixa manual em cobrança existente.',
  PAYMENT_REISSUE: 'Reemitir cobrança existente.',
  PAYMENT_CANCEL: 'Cancelar cobrança existente.',
  OWN_PROFILE: 'Editar o perfil do próprio usuário.',
  OWN_PASSWORD: 'Trocar a senha do próprio usuário.',
  // Decisão do dono D-D (2026-10-07, onda 134): as páginas legais continuam no ar na pausa, então o texto pode ser
  // corrigido ou retirado. Só PUT e DELETE de /api/admin/settings/legal-documents/{terms|privacy|return-policy}.
  STOREFRONT_LEGAL_DOCUMENT:
    'Corrigir ou despublicar os textos legais da vitrine (Termos, Privacidade e Devolução), que seguem no ar na pausa.',
})

export function isRestrictedMutationAllowed(
  code: unknown
): code is RestrictedMutationCode {
  return RestrictedMutationCodeSchema.safeParse(code).success
}

// ---------------------------------------------------------------------------
// Catálogo de planos
// ---------------------------------------------------------------------------

/** `Plan.code` (CHECK `^[a-z0-9-]{2,32}$`). */
export const PlanCodeSchema = z.string().regex(/^[a-z0-9-]{2,32}$/)
export const PlanNameSchema = z.string().trim().min(1).max(80)

/** Prazos de uma `PlanVersion` (CHECKs do banco). */
export const TrialDaysSchema = z.int().min(0).max(30)
export const GraceDaysSchema = z.int().min(0).max(15)
export const SuspendDaysSchema = z.int().min(7).max(90)
export const IncompleteDaysSchema = z.int().positive()

/**
 * Plano à venda em `GET /api/public/plans` e no passo "Escolha seu plano".
 * Plano público nunca custa zero (valor 0 só em plano interno).
 */
export const PublicPlanSchema = z
  .strictObject({
    planVersionId: RecordIdSchema,
    code: PlanCodeSchema,
    name: PlanNameSchema,
    version: z.int().positive(),
    interval: BillingIntervalSchema,
    amount: MoneySchema,
    trialDays: TrialDaysSchema,
    entitlements: EntitlementsV1Schema,
  })
  .refine((plan) => plan.amount !== '0.00', {
    message: 'Plano público não pode custar zero.',
    path: ['amount'],
  })
export type PublicPlan = z.infer<typeof PublicPlanSchema>

export const PublicPlansResponseSchema = z.strictObject({
  plans: z.array(PublicPlanSchema).max(10),
})
export type PublicPlansResponse = z.infer<typeof PublicPlansResponseSchema>

/** Plano vigente ou agendado, como o dono vê. */
export const SubscriptionPlanSchema = z.strictObject({
  code: PlanCodeSchema,
  name: PlanNameSchema,
  version: z.int().positive(),
  interval: BillingIntervalSchema,
  amount: MoneySchema,
})
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>

// ---------------------------------------------------------------------------
// Assinatura vista pela locadora
// ---------------------------------------------------------------------------

/**
 * Resumo curto anexado ao contexto da locadora (`TenantContext.subscription`,
 * campo opcional para manter o app mobile antigo compatível).
 */
export const TenantSubscriptionBriefSchema = z.strictObject({
  status: SubscriptionStatusSchema,
  trialEndsAt: CivilDateSchema.nullable(),
  graceEndsAt: CivilDateSchema.nullable(),
})
export type TenantSubscriptionBrief = z.infer<
  typeof TenantSubscriptionBriefSchema
>

/** Uso atual contado pelo guarda de limites. */
export const QuotaUsageSchema = z.strictObject({
  equipments: z.int().nonnegative(),
  staffSeats: z.int().nonnegative(),
})
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>

/**
 * `GET /api/admin/subscription` (só o dono). `access` precisa ser a projeção
 * de `status`; `entitlements` já inclui as exceções vigentes.
 */
export const SubscriptionSummarySchema = z
  .strictObject({
    status: SubscriptionStatusSchema,
    access: OrganizationAccessSchema,
    billingMode: SubscriptionBillingModeSchema,
    plan: SubscriptionPlanSchema,
    scheduledPlan: SubscriptionPlanSchema.nullable(),
    scheduledChangeAt: CivilDateSchema.nullable(),
    trialEndsAt: CivilDateSchema.nullable(),
    currentPeriodStart: CivilDateSchema.nullable(),
    currentPeriodEnd: CivilDateSchema.nullable(),
    pastDueSince: CivilDateSchema.nullable(),
    graceEndsAt: CivilDateSchema.nullable(),
    suspendedAt: InstantSchema.nullable(),
    complimentaryUntil: CivilDateSchema.nullable(),
    cancelAtPeriodEnd: z.boolean(),
    canceledAt: InstantSchema.nullable(),
    cancelReason: CancelReasonSchema.nullable(),
    entitlements: EntitlementsV1Schema,
    usage: QuotaUsageSchema,
  })
  .refine((summary) => summary.access === SUBSCRIPTION_ACCESS[summary.status], {
    message: 'access deve ser a projeção de status (D6).',
    path: ['access'],
  })
  .refine(
    (summary) =>
      (summary.scheduledPlan === null) === (summary.scheduledChangeAt === null),
    {
      message: 'scheduledPlan e scheduledChangeAt andam juntos.',
      path: ['scheduledChangeAt'],
    }
  )
  .refine(
    (summary) =>
      (summary.status === 'CANCELED') === (summary.canceledAt !== null),
    { message: 'canceledAt existe só em CANCELED.', path: ['canceledAt'] }
  )
export type SubscriptionSummary = z.infer<typeof SubscriptionSummarySchema>

/** Faturas vêm só de `https://*.asaas.com`, sem credenciais na URL. */
export const ASAAS_HOSTNAME_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+asaas\.com$/

export const AsaasHostedUrlSchema = z
  .url({ protocol: /^https$/, hostname: ASAAS_HOSTNAME_RE })
  .max(2048)
  .refine((value) => !value.includes('@'), {
    message: 'Endereço com credenciais não é aceito.',
  })

/** Fatura da mensalidade (`GET /api/admin/subscription/invoices`). */
export const PlatformInvoiceSchema = z
  .strictObject({
    id: RecordIdSchema,
    kind: PlatformInvoiceKindSchema,
    status: PlatformInvoiceStatusSchema,
    amount: MoneySchema,
    dueDate: CivilDateSchema,
    periodStart: CivilDateSchema.nullable(),
    periodEnd: CivilDateSchema.nullable(),
    billingType: InvoiceBillingTypeSchema.nullable(),
    invoiceUrl: AsaasHostedUrlSchema.nullable(),
    paidAt: InstantSchema.nullable(),
    canceledReason: InvoiceCancelReasonSchema.nullable(),
  })
  .refine(
    (invoice) =>
      invoice.canceledReason === null || invoice.status === 'CANCELED',
    {
      message: 'canceledReason existe só em fatura CANCELED.',
      path: ['canceledReason'],
    }
  )
export type PlatformInvoice = z.infer<typeof PlatformInvoiceSchema>

export const PlatformInvoicesResponseSchema = z.strictObject({
  invoices: z.array(PlatformInvoiceSchema).max(100),
})
export type PlatformInvoicesResponse = z.infer<
  typeof PlatformInvoicesResponseSchema
>

/** Linha do histórico da assinatura (`SubscriptionEvent`, só acréscimo). */
export const SubscriptionEventViewSchema = z.strictObject({
  id: RecordIdSchema,
  fromStatus: SubscriptionStatusSchema.nullable(),
  toStatus: SubscriptionStatusSchema,
  reason: EventCodeSchema,
  source: SubscriptionEventSourceSchema,
  mrrDelta: SignedMoneySchema.nullable(),
  occurredAt: InstantSchema,
})
export type SubscriptionEventView = z.infer<typeof SubscriptionEventViewSchema>

// ---------------------------------------------------------------------------
// Ações do dono (sessão fresca; sem pró-rata, D14)
// ---------------------------------------------------------------------------

/** `POST /api/admin/subscription/change-plan`. */
export const ChangePlanInputSchema = z.strictObject({
  planVersionId: RecordIdSchema,
})
export type ChangePlanInput = z.infer<typeof ChangePlanInputSchema>

/** `POST /api/admin/subscription/reactivate`: nova assinatura, sem teste. */
export const ReactivateSubscriptionInputSchema = z.strictObject({
  planVersionId: RecordIdSchema,
})
export type ReactivateSubscriptionInput = z.infer<
  typeof ReactivateSubscriptionInputSchema
>

/** `activate`, `cancel` e `undo-cancel` não aceitam corpo além de `{}`. */
export const EmptyActionInputSchema = z.strictObject({})

/** Durable owner command key; distinct actions cannot reuse the same key. */
export const OwnerSubscriptionCommandKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/)
/** Receipt of an accepted command; current commercial state is read separately. */
export const OwnerSubscriptionActionResponseSchema = z.strictObject({
  accepted: z.literal(true),
})
