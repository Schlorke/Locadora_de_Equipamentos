/**
 * Contrato de limites e módulos do plano, do dinheiro em trânsito e dos erros
 * de acesso (ADR docs/architecture/adr-saas-subscription.md, B.3, B.10, B.11,
 * D18 e D21).
 *
 * Puro e universal: só zod e literais. O backend verifica limites e módulos na
 * transação da escrita (S8); a interface só esconde, desabilita e explica.
 * Os objetos são estritos: qualquer chave extra é rejeitada.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

/**
 * Dinheiro trafega como string decimal com duas casas (`"199.90"`), nunca como
 * `number`. Cabe em `Decimal(12, 2)`: até 10 dígitos inteiros, sem zero à
 * esquerda, sem sinal, sem expoente e sem espaços.
 */
export const MONEY_RE = /^(?:0|[1-9]\d{0,9})\.\d{2}$/

/** Valor com sinal (ex.: `mrrDelta`). `-0.00` é recusado. */
export const SIGNED_MONEY_RE =
  /^(?:-(?=[\d.]*[1-9]))?(?:0|[1-9]\d{0,9})\.\d{2}$/

export const MoneySchema = z
  .string()
  .regex(MONEY_RE, {
    message: 'Valor deve ser decimal com duas casas, ex.: 199.90.',
  })

export const SignedMoneySchema = z.string().regex(SIGNED_MONEY_RE, {
  message: 'Valor deve ser decimal com duas casas, ex.: -49.90.',
})

/** String decimal com duas casas. Converta com `Decimal`, nunca com `Number`. */
export type Money = z.infer<typeof MoneySchema>

// ---------------------------------------------------------------------------
// Limites e módulos (EntitlementsV1)
// ---------------------------------------------------------------------------

/** Módulos que um plano liga ou desliga. */
export const ENTITLEMENT_FEATURES = [
  'onlinePayments',
  'customDomain',
  'logistics',
  'maintenance',
  'contractSignature',
  'whatsapp',
  'emailInbox',
  'merchantFeed',
] as const
export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number]

/**
 * Cotas contadas pelo guarda de limites:
 * - `equipments`: modelos de `Equipment` (não unidades);
 * - `staffSeats`: `Membership` ACTIVE com papel diferente de CLIENT, incluindo
 *   o dono.
 */
export const ENTITLEMENT_LIMITS = ['equipments', 'staffSeats'] as const
export type EntitlementLimit = (typeof ENTITLEMENT_LIMITS)[number]

export const EntitlementFeatureSchema = z.enum(ENTITLEMENT_FEATURES)
export const EntitlementLimitSchema = z.enum(ENTITLEMENT_LIMITS)

/** Cota: inteiro de 1 em diante; `null` = ilimitado. */
export const QuotaSchema = z.int().positive().nullable()

function shapeOf<const K extends string, S extends z.ZodType>(
  keys: readonly K[],
  schema: S
): Record<K, S> {
  const shape = {} as Record<K, S>
  for (const key of keys) shape[key] = schema
  return shape
}

/**
 * Formato versionado guardado em `PlanVersion.entitlements` (JSON) e devolvido
 * como direitos efetivos. Todo limite e todo módulo são obrigatórios; chave a
 * mais em qualquer nível é recusada.
 */
export const EntitlementsV1Schema = z.strictObject({
  schema: z.literal(1),
  limits: z.strictObject(shapeOf(ENTITLEMENT_LIMITS, QuotaSchema)),
  features: z.strictObject(shapeOf(ENTITLEMENT_FEATURES, z.boolean())),
})
export type EntitlementsV1 = z.infer<typeof EntitlementsV1Schema>

/** Chave de `EntitlementOverride.key`: `limits.<cota>` ou `features.<módulo>`. */
export const LimitOverrideKeySchema = z.templateLiteral([
  'limits.',
  EntitlementLimitSchema,
])
export const FeatureOverrideKeySchema = z.templateLiteral([
  'features.',
  EntitlementFeatureSchema,
])
export const EntitlementOverrideKeySchema = z.union([
  LimitOverrideKeySchema,
  FeatureOverrideKeySchema,
])
export type EntitlementOverrideKey = z.infer<
  typeof EntitlementOverrideKeySchema
>

/**
 * Par chave e valor de uma exceção de plano (`EntitlementOverride`). O valor
 * segue o tipo da chave: cota para `limits.*` e booleano para `features.*`.
 */
export const EntitlementOverrideSchema = z.union([
  z.strictObject({ key: LimitOverrideKeySchema, value: QuotaSchema }),
  z.strictObject({ key: FeatureOverrideKeySchema, value: z.boolean() }),
])
export type EntitlementOverride = z.infer<typeof EntitlementOverrideSchema>

// ---------------------------------------------------------------------------
// Erros de acesso (B.10 e B.11)
// ---------------------------------------------------------------------------

/** Código de erro de acesso e o status HTTP correspondente. */
export const ACCESS_ERROR_STATUS = Object.freeze({
  SUBSCRIPTION_RESTRICTED: 402,
  PLAN_LIMIT_REACHED: 402,
  MODULE_NOT_IN_PLAN: 402,
  TENANT_ARCHIVED: 403,
  OWNER_REQUIRED: 403,
  FRESH_SESSION_REQUIRED: 403,
  PAYMENT_ACCOUNT_NOT_READY: 409,
} as const)

export type AccessCode = keyof typeof ACCESS_ERROR_STATUS

export const ACCESS_CODES = Object.freeze([
  'SUBSCRIPTION_RESTRICTED',
  'PLAN_LIMIT_REACHED',
  'MODULE_NOT_IN_PLAN',
  'TENANT_ARCHIVED',
  'OWNER_REQUIRED',
  'FRESH_SESSION_REQUIRED',
  'PAYMENT_ACCOUNT_NOT_READY',
] as const satisfies readonly AccessCode[])

export const AccessCodeSchema = z.enum(ACCESS_CODES)

/** Mensagem para a pessoa usuária (pt-BR), no campo `error` como no resto da API. */
export const ErrorMessageSchema = z.string().trim().min(1).max(500)

const simpleAccessError = <C extends AccessCode>(code: C) =>
  z.strictObject({ error: ErrorMessageSchema, code: z.literal(code) })

/**
 * 402 ao criar além da cota. `used` pode passar de `limit` depois de um
 * downgrade (nada é apagado; só a criação fica bloqueada).
 */
export const PlanLimitReachedErrorSchema = z
  .strictObject({
    error: ErrorMessageSchema,
    code: z.literal('PLAN_LIMIT_REACHED'),
    resource: EntitlementLimitSchema,
    limit: z.int().positive(),
    used: z.int().nonnegative(),
  })
  .refine((body) => body.used >= body.limit, {
    message: 'PLAN_LIMIT_REACHED exige used >= limit.',
    path: ['used'],
  })

/** 402 em mutação de módulo fora do plano; leituras continuam. */
export const ModuleNotInPlanErrorSchema = z.strictObject({
  error: ErrorMessageSchema,
  code: z.literal('MODULE_NOT_IN_PLAN'),
  feature: EntitlementFeatureSchema,
})

export const SubscriptionRestrictedErrorSchema = simpleAccessError(
  'SUBSCRIPTION_RESTRICTED'
)
export const TenantArchivedErrorSchema = simpleAccessError('TENANT_ARCHIVED')
export const OwnerRequiredErrorSchema = simpleAccessError('OWNER_REQUIRED')
export const FreshSessionRequiredErrorSchema = simpleAccessError(
  'FRESH_SESSION_REQUIRED'
)
export const PaymentAccountNotReadyErrorSchema = simpleAccessError(
  'PAYMENT_ACCOUNT_NOT_READY'
)

/** Qualquer corpo de erro de acesso, discriminado por `code`. */
export const AccessErrorSchema = z.union([
  PlanLimitReachedErrorSchema,
  ModuleNotInPlanErrorSchema,
  SubscriptionRestrictedErrorSchema,
  TenantArchivedErrorSchema,
  OwnerRequiredErrorSchema,
  FreshSessionRequiredErrorSchema,
  PaymentAccountNotReadyErrorSchema,
])
export type AccessError = z.infer<typeof AccessErrorSchema>
export type PlanLimitReachedError = z.infer<typeof PlanLimitReachedErrorSchema>
export type ModuleNotInPlanError = z.infer<typeof ModuleNotInPlanErrorSchema>
