// Contrato de limites, dinheiro e erros de acesso (ADR
// docs/architecture/adr-saas-subscription.md, B.3, B.10, B.11 e T-D2).
import { describe, expect, it } from 'vitest'
import {
  ACCESS_CODES,
  ACCESS_ERROR_STATUS,
  AccessErrorSchema,
  ENTITLEMENT_FEATURES,
  ENTITLEMENT_LIMITS,
  EntitlementOverrideKeySchema,
  EntitlementOverrideSchema,
  EntitlementsV1Schema,
  ModuleNotInPlanErrorSchema,
  MoneySchema,
  PlanLimitReachedErrorSchema,
  SignedMoneySchema,
  type EntitlementsV1,
} from './entitlements'

const entitlements: EntitlementsV1 = {
  schema: 1,
  limits: { equipments: 30, staffSeats: null },
  features: {
    onlinePayments: true,
    customDomain: false,
    logistics: true,
    maintenance: true,
    contractSignature: false,
    whatsapp: false,
    emailInbox: false,
    merchantFeed: false,
  },
}

const ok = (value: unknown) => EntitlementsV1Schema.safeParse(value).success

describe('EntitlementsV1 estrito', () => {
  it('aceita o formato completo, com null como ilimitado', () => {
    expect(EntitlementsV1Schema.parse(entitlements)).toEqual(entitlements)
    expect(
      ok({ ...entitlements, limits: { equipments: null, staffSeats: 1 } })
    ).toBe(true)
  })

  it('lista exatamente os módulos e as cotas do ADR', () => {
    expect([...ENTITLEMENT_FEATURES]).toEqual([
      'onlinePayments',
      'customDomain',
      'logistics',
      'maintenance',
      'contractSignature',
      'whatsapp',
      'emailInbox',
      'merchantFeed',
    ])
    expect([...ENTITLEMENT_LIMITS]).toEqual(['equipments', 'staffSeats'])
    expect(Object.keys(EntitlementsV1Schema.shape.features.shape)).toEqual([
      ...ENTITLEMENT_FEATURES,
    ])
    expect(Object.keys(EntitlementsV1Schema.shape.limits.shape)).toEqual([
      ...ENTITLEMENT_LIMITS,
    ])
  })

  it('recusa chave a mais em qualquer nível', () => {
    expect(ok({ ...entitlements, extra: true })).toBe(false)
    expect(
      ok({ ...entitlements, limits: { ...entitlements.limits, storage: 1 } })
    ).toBe(false)
    expect(
      ok({
        ...entitlements,
        features: { ...entitlements.features, analytics: true },
      })
    ).toBe(false)
  })

  it('exige todos os módulos e cotas', () => {
    for (const feature of ENTITLEMENT_FEATURES) {
      const features: Record<string, boolean> = { ...entitlements.features }
      delete features[feature]
      expect([feature, ok({ ...entitlements, features })]).toEqual([
        feature,
        false,
      ])
    }
    for (const limit of ENTITLEMENT_LIMITS) {
      const limits: Record<string, number | null> = { ...entitlements.limits }
      delete limits[limit]
      expect([limit, ok({ ...entitlements, limits })]).toEqual([limit, false])
    }
  })

  it('só aceita a versão 1 do formato', () => {
    expect(ok({ ...entitlements, schema: 2 })).toBe(false)
    expect(ok({ ...entitlements, schema: '1' })).toBe(false)
    const withoutSchema: Record<string, unknown> = { ...entitlements }
    delete withoutSchema.schema
    expect(ok(withoutSchema)).toBe(false)
  })

  it.each([0, -1, 1.5, '30', Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    'recusa cota %s',
    (equipments) => {
      expect(
        ok({ ...entitlements, limits: { equipments, staffSeats: null } })
      ).toBe(false)
    }
  )

  it('recusa módulo que não é booleano', () => {
    expect(
      ok({
        ...entitlements,
        features: { ...entitlements.features, whatsapp: 'true' },
      })
    ).toBe(false)
    expect(
      ok({
        ...entitlements,
        features: { ...entitlements.features, whatsapp: 1 },
      })
    ).toBe(false)
  })
})

describe('Money: string decimal, nunca number (T-D2)', () => {
  it.each(['0.00', '0.01', '149.90', '199.90', '9999999999.99'])(
    'aceita %s',
    (value) => {
      expect(MoneySchema.parse(value)).toBe(value)
    }
  )

  it.each([
    199.9,
    0,
    '199.9',
    '199',
    '199.900',
    '-1.00',
    '01.00',
    '1e3',
    ' 1.00',
    '1.00 ',
    '1,00',
    '10000000000.00',
    'NaN',
    '',
    null,
  ])('recusa %j', (value) => {
    expect(MoneySchema.safeParse(value).success).toBe(false)
  })

  it('SignedMoney aceita negativo, mas não -0.00', () => {
    for (const value of ['-49.90', '-0.01', '0.00', '12.00']) {
      expect([value, SignedMoneySchema.safeParse(value).success]).toEqual([
        value,
        true,
      ])
    }
    for (const value of ['-0.00', '--1.00', '+1.00', '-1', -1]) {
      expect([value, SignedMoneySchema.safeParse(value).success]).toEqual([
        value,
        false,
      ])
    }
  })
})

describe('exceções de plano (EntitlementOverride)', () => {
  it('chave é limits.<cota> ou features.<módulo>', () => {
    for (const key of [
      'limits.equipments',
      'limits.staffSeats',
      'features.customDomain',
      'features.merchantFeed',
    ]) {
      expect([
        key,
        EntitlementOverrideKeySchema.safeParse(key).success,
      ]).toEqual([key, true])
    }
    for (const key of [
      'limits.storage',
      'features.analytics',
      'equipments',
      'limits.',
      'features.customDomain.x',
      'Limits.equipments',
    ]) {
      expect([
        key,
        EntitlementOverrideKeySchema.safeParse(key).success,
      ]).toEqual([key, false])
    }
  })

  it('o valor segue o tipo da chave', () => {
    const parse = (value: unknown) =>
      EntitlementOverrideSchema.safeParse(value).success
    expect(parse({ key: 'limits.equipments', value: 100 })).toBe(true)
    expect(parse({ key: 'limits.equipments', value: null })).toBe(true)
    expect(parse({ key: 'features.whatsapp', value: true })).toBe(true)
    expect(parse({ key: 'limits.equipments', value: true })).toBe(false)
    expect(parse({ key: 'limits.equipments', value: 0 })).toBe(false)
    expect(parse({ key: 'features.whatsapp', value: 1 })).toBe(false)
    expect(parse({ key: 'features.whatsapp', value: null })).toBe(false)
    expect(
      parse({ key: 'features.whatsapp', value: true, tenantId: 'x' })
    ).toBe(false)
  })
})

describe('erros de acesso', () => {
  it('cada código tem o status HTTP do ADR (B.11)', () => {
    expect(ACCESS_ERROR_STATUS).toEqual({
      SUBSCRIPTION_RESTRICTED: 402,
      PLAN_LIMIT_REACHED: 402,
      MODULE_NOT_IN_PLAN: 402,
      TENANT_ARCHIVED: 403,
      OWNER_REQUIRED: 403,
      FRESH_SESSION_REQUIRED: 403,
      PAYMENT_ACCOUNT_NOT_READY: 409,
    })
    expect([...ACCESS_CODES].sort()).toEqual(
      Object.keys(ACCESS_ERROR_STATUS).sort()
    )
    expect(Object.isFrozen(ACCESS_ERROR_STATUS)).toBe(true)
    expect(Object.isFrozen(ACCESS_CODES)).toBe(true)
  })

  const limitError = {
    error:
      'Seu plano permite até 30 equipamentos (você tem 30). Nada foi apagado.',
    code: 'PLAN_LIMIT_REACHED',
    resource: 'equipments',
    limit: 30,
    used: 30,
  }

  it('PLAN_LIMIT_REACHED leva recurso, limite e uso', () => {
    expect(PlanLimitReachedErrorSchema.parse(limitError)).toEqual(limitError)
    // Depois de um downgrade o uso pode passar do limite.
    expect(
      PlanLimitReachedErrorSchema.safeParse({ ...limitError, used: 45 }).success
    ).toBe(true)
    expect(
      PlanLimitReachedErrorSchema.safeParse({ ...limitError, used: 29 }).success
    ).toBe(false)
    expect(
      PlanLimitReachedErrorSchema.safeParse({ ...limitError, resource: 'x' })
        .success
    ).toBe(false)
    const withoutUsed: Record<string, unknown> = { ...limitError }
    delete withoutUsed.used
    expect(PlanLimitReachedErrorSchema.safeParse(withoutUsed).success).toBe(
      false
    )
    expect(
      PlanLimitReachedErrorSchema.safeParse({ ...limitError, tenantId: 'x' })
        .success
    ).toBe(false)
  })

  it('MODULE_NOT_IN_PLAN nomeia o módulo', () => {
    const body = {
      error: 'Logística não faz parte do seu plano.',
      code: 'MODULE_NOT_IN_PLAN',
      feature: 'logistics',
    }
    expect(ModuleNotInPlanErrorSchema.parse(body)).toEqual(body)
    expect(
      ModuleNotInPlanErrorSchema.safeParse({ ...body, feature: 'crm' }).success
    ).toBe(false)
  })

  it('AccessErrorSchema aceita todos os códigos e recusa desconhecidos', () => {
    for (const code of ACCESS_CODES) {
      const body =
        code === 'PLAN_LIMIT_REACHED'
          ? limitError
          : code === 'MODULE_NOT_IN_PLAN'
            ? { error: 'Fora do plano.', code, feature: 'whatsapp' }
            : { error: 'Ação indisponível.', code }
      expect([code, AccessErrorSchema.safeParse(body).success]).toEqual([
        code,
        true,
      ])
    }
    expect(
      AccessErrorSchema.safeParse({ error: 'x', code: 'TENANT_REQUIRED' })
        .success
    ).toBe(false)
    expect(
      AccessErrorSchema.safeParse({ error: '', code: 'OWNER_REQUIRED' }).success
    ).toBe(false)
    expect(
      AccessErrorSchema.safeParse({
        error: 'Assinatura em pausa.',
        code: 'SUBSCRIPTION_RESTRICTED',
        stack: 'Error: ...',
      }).success
    ).toBe(false)
  })
})
