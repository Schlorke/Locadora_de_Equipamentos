/**
 * Contrato do backoffice da plataforma e do acesso de suporte (ADR
 * docs/architecture/adr-saas-subscription.md, B.9, D16 e D17).
 *
 * O backoffice fica em `app.<raiz>/backoffice` e só lê tabelas de plataforma:
 * nunca equipamentos, orçamentos, clientes, cobranças de clientes finais nem
 * segredos. Toda ação exige motivo e é auditada. Puro e universal: só zod e
 * literais; os objetos são estritos.
 */
import { z } from 'zod'
import {
  EntitlementsV1Schema,
  ErrorMessageSchema,
  FeatureOverrideKeySchema,
  LimitOverrideKeySchema,
  MoneySchema,
  QuotaSchema,
} from './entitlements'
import {
  PaymentAccountHealthIssueSchema,
  PaymentAccountKindSchema,
  PaymentAccountStatusSchema,
} from './payment-account'
import { TENANT_SLUG_RE } from './platform'
import {
  CivilDateSchema,
  EventCodeSchema,
  GraceDaysSchema,
  IncompleteDaysSchema,
  InstantSchema,
  OrganizationAccessSchema,
  PlanCodeSchema,
  RecordIdSchema,
  SubscriptionStatusSchema,
  SuspendDaysSchema,
  TrialDaysSchema,
} from './subscription'

// ---------------------------------------------------------------------------
// Equipe e permissões
// ---------------------------------------------------------------------------

export const PLATFORM_STAFF_ROLES = [
  'PLATFORM_ADMIN',
  'PLATFORM_FINANCE',
  'PLATFORM_SUPPORT',
  'PLATFORM_VIEWER',
] as const
export const PlatformStaffRoleSchema = z.enum(PLATFORM_STAFF_ROLES)
export type PlatformStaffRole = z.infer<typeof PlatformStaffRoleSchema>

/** Ações do backoffice, na ordem da tabela da seção B.9. */
export const BACKOFFICE_ACTIONS = [
  'VIEW_TENANTS',
  'VIEW_METRICS',
  'PUBLISH_PLAN_VERSION',
  'GRANT_COMPLIMENTARY',
  'EXTEND_TRIAL',
  'GRANT_ENTITLEMENT_OVERRIDE',
  'REFUND_INVOICE',
  'ADMIN_HOLD',
  'RETRY_PROVISIONING',
  'RUN_KEY_WEBHOOK_RUNBOOK',
  'REPROCESS_INBOX',
  'SUPPORT_SESSION',
  'BREAK_GLASS',
] as const
export const BackofficeActionSchema = z.enum(BACKOFFICE_ACTIONS)
export type BackofficeAction = z.infer<typeof BackofficeActionSchema>

const ADMIN: PlatformStaffRole = 'PLATFORM_ADMIN'
const FINANCE: PlatformStaffRole = 'PLATFORM_FINANCE'
const SUPPORT: PlatformStaffRole = 'PLATFORM_SUPPORT'
const VIEWER: PlatformStaffRole = 'PLATFORM_VIEWER'
const roles = (...list: PlatformStaffRole[]): readonly PlatformStaffRole[] =>
  Object.freeze(list)

/**
 * Quem pode o quê (tabela da seção B.9). SUPPORT vê locadoras, mas não
 * métricas. Break-glass exige ainda um segundo ADMIN distinto.
 */
export const BACKOFFICE_PERMISSIONS: Readonly<
  Record<BackofficeAction, readonly PlatformStaffRole[]>
> = Object.freeze({
  VIEW_TENANTS: roles(ADMIN, FINANCE, SUPPORT, VIEWER),
  VIEW_METRICS: roles(ADMIN, FINANCE, VIEWER),
  PUBLISH_PLAN_VERSION: roles(ADMIN),
  GRANT_COMPLIMENTARY: roles(ADMIN, FINANCE),
  EXTEND_TRIAL: roles(ADMIN, FINANCE),
  GRANT_ENTITLEMENT_OVERRIDE: roles(ADMIN, FINANCE),
  REFUND_INVOICE: roles(ADMIN, FINANCE),
  ADMIN_HOLD: roles(ADMIN),
  RETRY_PROVISIONING: roles(ADMIN, SUPPORT),
  RUN_KEY_WEBHOOK_RUNBOOK: roles(ADMIN, SUPPORT),
  REPROCESS_INBOX: roles(ADMIN, SUPPORT),
  SUPPORT_SESSION: roles(ADMIN, SUPPORT),
  BREAK_GLASS: roles(ADMIN),
})

export function staffCan(
  role: PlatformStaffRole,
  action: BackofficeAction
): boolean {
  return BACKOFFICE_PERMISSIONS[action].includes(role)
}

/** Motivo obrigatório de toda ação (mesmo limite do CHECK de `SupportAccessGrant`). */
export const StaffReasonSchema = z.string().trim().min(10).max(500)

/** Referência opcional de chamado ou incidente. */
export const TicketRefSchema = z.string().trim().min(1).max(100)

// ---------------------------------------------------------------------------
// Ações da equipe
// ---------------------------------------------------------------------------

/**
 * Publicar uma nova `PlanVersion` (imutável). O MVP vende só mensal; se o
 * plano é público, o valor precisa ser maior que zero (conferido no servidor,
 * que conhece o `Plan`).
 */
export const PublishPlanVersionInputSchema = z.strictObject({
  planCode: PlanCodeSchema,
  interval: z.literal('MONTHLY'),
  amount: MoneySchema,
  trialDays: TrialDaysSchema,
  graceDays: GraceDaysSchema,
  suspendDays: SuspendDaysSchema,
  incompleteDays: IncompleteDaysSchema,
  entitlements: EntitlementsV1Schema,
  sellableFrom: InstantSchema.nullable(),
  reason: StaffReasonSchema,
})
export type PublishPlanVersionInput = z.infer<
  typeof PublishPlanVersionInputSchema
>

/** Cortesia: `until = null` é sem prazo. */
export const GrantComplimentaryInputSchema = z.strictObject({
  until: CivilDateSchema.nullable(),
  reason: StaffReasonSchema,
})

/** Estender o teste; a soma das extensões não passa de 30 dias (servidor). */
export const EXTEND_TRIAL_MAX_DAYS = 30
export const ExtendTrialInputSchema = z.strictObject({
  days: z.int().min(1).max(EXTEND_TRIAL_MAX_DAYS),
  reason: StaffReasonSchema,
})

const overrideGrantMeta = {
  reason: StaffReasonSchema,
  expiresAt: InstantSchema.nullable(),
}

/**
 * Exceção de plano para uma locadora (`EntitlementOverride`): cota para
 * `limits.*`, booleano para `features.*`; `expiresAt = null` é sem prazo.
 */
export const GrantEntitlementOverrideInputSchema = z.union([
  z.strictObject({
    key: LimitOverrideKeySchema,
    value: QuotaSchema,
    ...overrideGrantMeta,
  }),
  z.strictObject({
    key: FeatureOverrideKeySchema,
    value: z.boolean(),
    ...overrideGrantMeta,
  }),
])
export type GrantEntitlementOverrideInput = z.infer<
  typeof GrantEntitlementOverrideInputSchema
>

/** Estorno manual (`voluntaryRefund = true`, não vira dívida). */
export const RefundInvoiceInputSchema = z.strictObject({
  invoiceId: RecordIdSchema,
  reason: StaffReasonSchema,
})

/** Bloqueio administrativo (`Organization.status = SUSPENDED`, 404) e desbloqueio. */
export const AdminHoldInputSchema = z.strictObject({
  hold: z.boolean(),
  reason: StaffReasonSchema,
})

/** Categoria obrigatória do break-glass. */
export const BREAK_GLASS_REASON_CATEGORIES = [
  'INCIDENT',
  'FRAUD',
  'LEGAL_ORDER',
] as const
export const BreakGlassReasonCategorySchema = z.enum(
  BREAK_GLASS_REASON_CATEGORIES
)

export const BREAK_GLASS_MAX_HOURS = 4

/** Pedido de break-glass; só vale com a aprovação de um segundo ADMIN. */
export const BreakGlassRequestInputSchema = z.strictObject({
  tenantId: RecordIdSchema,
  reasonCategory: BreakGlassReasonCategorySchema,
  reason: StaffReasonSchema,
  ticketRef: TicketRefSchema.nullable(),
  hours: z.int().min(1).max(BREAK_GLASS_MAX_HOURS),
})

// ---------------------------------------------------------------------------
// Acesso de suporte concedido pelo dono (/api/admin/support-access)
// ---------------------------------------------------------------------------

/** Durações que o dono pode conceder, em horas. */
export const SUPPORT_ACCESS_DURATIONS_HOURS = Object.freeze([
  1, 24, 72,
] as const)
export const SUPPORT_ACCESS_MAX_HOURS = 72

export const SUPPORT_ACCESS_SCOPES = ['READ_ONLY'] as const
export const SupportAccessScopeSchema = z.enum(SUPPORT_ACCESS_SCOPES)

/** `POST /api/admin/support-access` (só o dono). Somente leitura no MVP. */
export const GrantSupportAccessInputSchema = z.strictObject({
  durationHours: z.union([z.literal(1), z.literal(24), z.literal(72)]),
  reason: StaffReasonSchema,
})
export type GrantSupportAccessInput = z.infer<
  typeof GrantSupportAccessInputSchema
>

/** Concessão como o dono e a equipe a veem. */
export const SupportAccessGrantViewSchema = z.strictObject({
  id: RecordIdSchema,
  scope: SupportAccessScopeSchema,
  reason: StaffReasonSchema,
  breakGlass: z.boolean(),
  startsAt: InstantSchema,
  expiresAt: InstantSchema,
  revokedAt: InstantSchema.nullable(),
})
export type SupportAccessGrantView = z.infer<
  typeof SupportAccessGrantViewSchema
>

// ---------------------------------------------------------------------------
// Leituras do backoffice (só tabelas de plataforma)
// ---------------------------------------------------------------------------

/** Contato do dono vindo de `platform_user_contacts`: só nome e e-mail. */
export const OwnerContactSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).nullable(),
  email: z.email().max(320),
})

/** Linha da lista de locadoras. */
export const BackofficeTenantSchema = z.strictObject({
  id: RecordIdSchema,
  name: z.string().trim().min(1).max(200),
  slug: z.string().regex(TENANT_SLUG_RE),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  access: OrganizationAccessSchema,
  subscriptionStatus: SubscriptionStatusSchema.nullable(),
  planCode: PlanCodeSchema.nullable(),
  owner: OwnerContactSchema.nullable(),
  paymentAccount: z
    .strictObject({
      kind: PaymentAccountKindSchema,
      status: PaymentAccountStatusSchema,
      healthIssue: PaymentAccountHealthIssueSchema.nullable(),
    })
    .nullable(),
})
export type BackofficeTenant = z.infer<typeof BackofficeTenantSchema>

/** Contagens de `TenantUsageSnapshot` (bytes como inteiro decimal em string). */
export const TenantUsageSnapshotSchema = z.strictObject({
  equipments: z.int().nonnegative(),
  staffSeats: z.int().nonnegative(),
  storageBytes: z.string().regex(/^(?:0|[1-9]\d{0,19})$/),
  lastActivityAt: InstantSchema.nullable(),
  capturedAt: InstantSchema,
})
export type TenantUsageSnapshot = z.infer<typeof TenantUsageSnapshotSchema>

/** Razão não negativa como string decimal (até 6 casas); `null` sem base. */
export const RatioSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,6})?$/)
  .nullable()

/**
 * Métricas do mês (`AAAA-MM`), calculadas em `Decimal` só sobre
 * `subscriptions`, `subscription_events`, `platform_invoices` e
 * `plan_versions`. MRR = valor mensalizado (anual/12) das assinaturas ACTIVE e
 * PAST_DUE cobradas pelo Asaas; teste e SUSPENDED aparecem à parte.
 */
export const PlatformMetricsSchema = z.strictObject({
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
  mrr: MoneySchema,
  trialMrr: MoneySchema,
  atRiskMrr: MoneySchema,
  logoChurn: RatioSchema,
  revenueChurn: RatioSchema,
  trialConversion: RatioSchema,
  delinquency: z.strictObject({
    count: z.int().nonnegative(),
    amount: MoneySchema,
  }),
  collected: MoneySchema,
})
export type PlatformMetrics = z.infer<typeof PlatformMetricsSchema>

export const PLATFORM_AUDIT_ACTOR_KINDS = ['STAFF', 'OWNER', 'SYSTEM'] as const
export const PlatformAuditActorKindSchema = z.enum(PLATFORM_AUDIT_ACTOR_KINDS)

/** Ação auditada, em minúsculas com pontos (ex.: `subscription.suspended`). */
export const AuditActionSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){1,4}$/)

/** Linha de `PlatformAuditLog` como o backoffice mostra (sem IP nem metadata). */
export const PlatformAuditEntrySchema = z.strictObject({
  id: RecordIdSchema,
  actorKind: PlatformAuditActorKindSchema,
  action: AuditActionSchema,
  tenantId: RecordIdSchema.nullable(),
  targetType: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/)
    .nullable(),
  targetId: RecordIdSchema.nullable(),
  reasonCategory: EventCodeSchema.nullable(),
  reason: z.string().trim().min(1).max(500).nullable(),
  createdAt: InstantSchema,
})
export type PlatformAuditEntry = z.infer<typeof PlatformAuditEntrySchema>

export const PLATFORM_WEBHOOK_SOURCES = [
  'ASAAS_ROOT',
  'ASAAS_ACCOUNT',
  'ASAAS_TRANSFER_VALIDATION',
] as const
export const PlatformWebhookSourceSchema = z.enum(PLATFORM_WEBHOOK_SOURCES)

export const PLATFORM_WEBHOOK_INBOX_STATUSES = [
  'RECEIVED',
  'PROCESSED',
  'IGNORED',
  'UNROUTED',
  'CONFLICT',
  'FAILED',
] as const
export const PlatformWebhookInboxStatusSchema = z.enum(
  PLATFORM_WEBHOOK_INBOX_STATUSES
)

/** Linha da inbox de plataforma, sem o payload. */
export const PlatformWebhookInboxEntrySchema = z.strictObject({
  id: RecordIdSchema,
  source: PlatformWebhookSourceSchema,
  eventType: z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/),
  status: PlatformWebhookInboxStatusSchema,
  tenantId: RecordIdSchema.nullable(),
  attempts: z.int().nonnegative(),
  lastError: EventCodeSchema.nullable(),
  receivedAt: InstantSchema,
  processedAt: InstantSchema.nullable(),
})
export type PlatformWebhookInboxEntry = z.infer<
  typeof PlatformWebhookInboxEntrySchema
>

// ---------------------------------------------------------------------------
// Erros do backoffice
// ---------------------------------------------------------------------------

/**
 * Quem não é da equipe recebe 404 neutro (sem corpo específico). Para a
 * equipe e para o suporte, 403 com estes códigos.
 */
export const BACKOFFICE_ERROR_CODES = [
  'STAFF_TWO_FACTOR_REQUIRED',
  'STAFF_ROLE_FORBIDDEN',
  'SUPPORT_GRANT_REQUIRED',
  'SUPPORT_READ_ONLY',
] as const
export type BackofficeErrorCode = (typeof BACKOFFICE_ERROR_CODES)[number]

export const BACKOFFICE_ERROR_STATUS: Readonly<
  Record<BackofficeErrorCode, 403>
> = Object.freeze({
  STAFF_TWO_FACTOR_REQUIRED: 403,
  STAFF_ROLE_FORBIDDEN: 403,
  SUPPORT_GRANT_REQUIRED: 403,
  SUPPORT_READ_ONLY: 403,
})

export const BackofficeErrorSchema = z.strictObject({
  error: ErrorMessageSchema,
  code: z.enum(BACKOFFICE_ERROR_CODES),
})
export type BackofficeError = z.infer<typeof BackofficeErrorSchema>
