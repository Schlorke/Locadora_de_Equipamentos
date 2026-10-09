// Contrato do backoffice e do acesso de suporte (ADR
// docs/architecture/adr-saas-subscription.md, B.9, D16 e D17).
import { describe, expect, it } from 'vitest'
import {
  AdminHoldInputSchema,
  BACKOFFICE_ACTIONS,
  BACKOFFICE_ERROR_CODES,
  BACKOFFICE_ERROR_STATUS,
  BACKOFFICE_PERMISSIONS,
  BackofficeErrorSchema,
  BackofficeTenantSchema,
  BreakGlassRequestInputSchema,
  ExtendTrialInputSchema,
  GrantEntitlementOverrideInputSchema,
  GrantSupportAccessInputSchema,
  PLATFORM_STAFF_ROLES,
  PlatformAuditEntrySchema,
  PlatformMetricsSchema,
  PublishPlanVersionInputSchema,
  SUPPORT_ACCESS_DURATIONS_HOURS,
  SupportAccessGrantViewSchema,
  TenantUsageSnapshotSchema,
  staffCan,
  type BackofficeAction,
  type PlatformStaffRole,
} from './backoffice'

const REASON = 'Pedido do dono no chamado 123.'

describe('papéis e permissões (tabela B.9)', () => {
  it('quatro papéis da equipe', () => {
    expect([...PLATFORM_STAFF_ROLES]).toEqual([
      'PLATFORM_ADMIN',
      'PLATFORM_FINANCE',
      'PLATFORM_SUPPORT',
      'PLATFORM_VIEWER',
    ])
  })

  it('matriz exata do ADR', () => {
    const A = 'PLATFORM_ADMIN'
    const F = 'PLATFORM_FINANCE'
    const S = 'PLATFORM_SUPPORT'
    const V = 'PLATFORM_VIEWER'
    const expected: Record<BackofficeAction, PlatformStaffRole[]> = {
      VIEW_TENANTS: [A, F, S, V],
      VIEW_METRICS: [A, F, V],
      PUBLISH_PLAN_VERSION: [A],
      GRANT_COMPLIMENTARY: [A, F],
      EXTEND_TRIAL: [A, F],
      GRANT_ENTITLEMENT_OVERRIDE: [A, F],
      REFUND_INVOICE: [A, F],
      ADMIN_HOLD: [A],
      RETRY_PROVISIONING: [A, S],
      RUN_KEY_WEBHOOK_RUNBOOK: [A, S],
      REPROCESS_INBOX: [A, S],
      SUPPORT_SESSION: [A, S],
      BREAK_GLASS: [A],
    }
    expect(Object.keys(BACKOFFICE_PERMISSIONS)).toEqual([...BACKOFFICE_ACTIONS])
    for (const action of BACKOFFICE_ACTIONS) {
      for (const role of PLATFORM_STAFF_ROLES) {
        expect([action, role, staffCan(role, action)]).toEqual([
          action,
          role,
          expected[action].includes(role),
        ])
      }
    }
  })

  it('VIEWER só lê e SUPPORT não vê métricas', () => {
    const viewer = BACKOFFICE_ACTIONS.filter((action) =>
      staffCan('PLATFORM_VIEWER', action)
    )
    expect(viewer).toEqual(['VIEW_TENANTS', 'VIEW_METRICS'])
    expect(staffCan('PLATFORM_SUPPORT', 'VIEW_METRICS')).toBe(false)
  })

  it('a matriz é imutável', () => {
    expect(Object.isFrozen(BACKOFFICE_PERMISSIONS)).toBe(true)
    for (const action of BACKOFFICE_ACTIONS) {
      expect(Object.isFrozen(BACKOFFICE_PERMISSIONS[action])).toBe(true)
    }
  })
})

describe('ações exigem motivo', () => {
  it.each([
    [AdminHoldInputSchema, { hold: true }],
    [ExtendTrialInputSchema, { days: 7 }],
  ] as const)('motivo de 10 a 500 caracteres', (schema, base) => {
    expect(schema.safeParse({ ...base, reason: REASON }).success).toBe(true)
    expect(schema.safeParse(base).success).toBe(false)
    expect(schema.safeParse({ ...base, reason: 'curto' }).success).toBe(false)
    expect(schema.safeParse({ ...base, reason: '   curto    ' }).success).toBe(
      false
    )
    expect(schema.safeParse({ ...base, reason: 'x'.repeat(501) }).success).toBe(
      false
    )
  })

  it('estender teste: de 1 a 30 dias', () => {
    const parse = (days: unknown) =>
      ExtendTrialInputSchema.safeParse({ days, reason: REASON }).success
    expect(parse(1)).toBe(true)
    expect(parse(30)).toBe(true)
    expect(parse(0)).toBe(false)
    expect(parse(31)).toBe(false)
    expect(parse(1.5)).toBe(false)
  })

  it('exceção de plano: valor segue a chave, com motivo e validade', () => {
    const parse = (value: unknown) =>
      GrantEntitlementOverrideInputSchema.safeParse(value).success
    expect(
      parse({
        key: 'limits.equipments',
        value: 100,
        reason: REASON,
        expiresAt: '2026-12-31T23:59:59-03:00',
      })
    ).toBe(true)
    expect(
      parse({
        key: 'features.customDomain',
        value: true,
        reason: REASON,
        expiresAt: null,
      })
    ).toBe(true)
    expect(
      parse({
        key: 'features.customDomain',
        value: 100,
        reason: REASON,
        expiresAt: null,
      })
    ).toBe(false)
    expect(
      parse({ key: 'limits.equipments', value: 100, expiresAt: null })
    ).toBe(false)
    expect(
      parse({
        key: 'limits.equipments',
        value: 100,
        reason: REASON,
        expiresAt: null,
        tenantId: 'x',
      })
    ).toBe(false)
  })

  it('publicar versão de plano: só mensal no MVP e direitos estritos', () => {
    const input = {
      planCode: 'essencial',
      interval: 'MONTHLY',
      amount: '149.90',
      trialDays: 14,
      graceDays: 7,
      suspendDays: 30,
      incompleteDays: 30,
      entitlements: {
        schema: 1,
        limits: { equipments: 30, staffSeats: 3 },
        features: {
          onlinePayments: true,
          customDomain: false,
          logistics: false,
          maintenance: true,
          contractSignature: false,
          whatsapp: false,
          emailInbox: false,
          merchantFeed: false,
        },
      },
      sellableFrom: null,
      reason: REASON,
    }
    const parse = (value: unknown) =>
      PublishPlanVersionInputSchema.safeParse(value).success
    expect(parse(input)).toBe(true)
    expect(parse({ ...input, interval: 'YEARLY' })).toBe(false)
    expect(parse({ ...input, graceDays: 16 })).toBe(false)
    expect(parse({ ...input, suspendDays: 6 })).toBe(false)
    expect(parse({ ...input, suspendDays: 91 })).toBe(false)
    expect(parse({ ...input, amount: 149.9 })).toBe(false)
    expect(
      parse({ ...input, entitlements: { ...input.entitlements, schema: 2 } })
    ).toBe(false)
  })

  it('break-glass: categoria obrigatória e até 4 horas', () => {
    const input = {
      tenantId: 'clx0org0000000000001',
      reasonCategory: 'INCIDENT',
      reason: 'Incidente de segurança em análise.',
      ticketRef: null,
      hours: 4,
    }
    const parse = (value: unknown) =>
      BreakGlassRequestInputSchema.safeParse(value).success
    expect(parse(input)).toBe(true)
    expect(parse({ ...input, hours: 5 })).toBe(false)
    expect(parse({ ...input, reasonCategory: 'CURIOSITY' })).toBe(false)
    expect(parse({ ...input, reasonCategory: undefined })).toBe(false)
  })
})

describe('acesso de suporte concedido pelo dono', () => {
  it('só 1, 24 ou 72 horas, com motivo', () => {
    expect([...SUPPORT_ACCESS_DURATIONS_HOURS]).toEqual([1, 24, 72])
    const parse = (durationHours: unknown) =>
      GrantSupportAccessInputSchema.safeParse({ durationHours, reason: REASON })
        .success
    for (const hours of [1, 24, 72]) expect(parse(hours)).toBe(true)
    for (const hours of [0, 2, 48, 73, 96, '24'])
      expect(parse(hours)).toBe(false)
    expect(
      GrantSupportAccessInputSchema.safeParse({ durationHours: 24 }).success
    ).toBe(false)
  })

  it('somente leitura e sem escopo de escrita', () => {
    const grant = {
      id: 'clx0grant00000000001',
      scope: 'READ_ONLY',
      reason: REASON,
      breakGlass: false,
      startsAt: '2026-09-26T12:00:00.000Z',
      expiresAt: '2026-09-27T12:00:00.000Z',
      revokedAt: null,
    }
    expect(SupportAccessGrantViewSchema.parse(grant)).toEqual(grant)
    expect(
      SupportAccessGrantViewSchema.safeParse({ ...grant, scope: 'READ_WRITE' })
        .success
    ).toBe(false)
    expect(
      GrantSupportAccessInputSchema.safeParse({
        durationHours: 24,
        reason: REASON,
        scope: 'READ_WRITE',
      }).success
    ).toBe(false)
  })
})

describe('leituras do backoffice: só dados de plataforma', () => {
  const tenant = {
    id: 'clx0org0000000000001',
    name: 'Acme Locações',
    slug: 'acme',
    status: 'ACTIVE',
    access: 'FULL',
    subscriptionStatus: 'ACTIVE',
    planCode: 'essencial',
    owner: { name: 'Pessoa Dona', email: 'dono@locadora.example' },
    paymentAccount: { kind: 'BAAS', status: 'APPROVED', healthIssue: null },
  }

  it('locadora com assinatura, dono e saúde da conta', () => {
    expect(BackofficeTenantSchema.parse(tenant)).toEqual(tenant)
  })

  it.each([
    { equipments: [] },
    { clients: [] },
    { quotes: [] },
    { cnpj: '00000000000000' },
    { phone: '41999999999' },
  ])('não carrega dado de negócio: %j', (extra) => {
    expect(
      BackofficeTenantSchema.safeParse({ ...tenant, ...extra }).success
    ).toBe(false)
  })

  it('conta de recebimentos sem segredo nem id do provedor', () => {
    for (const extra of [{ walletId: 'w' }, { apiKey: 'k' }]) {
      expect(
        BackofficeTenantSchema.safeParse({
          ...tenant,
          paymentAccount: { ...tenant.paymentAccount, ...extra },
        }).success
      ).toBe(false)
    }
  })

  it('uso: só contagens; bytes como inteiro em string', () => {
    const usage = {
      equipments: 12,
      staffSeats: 3,
      storageBytes: '104857600',
      lastActivityAt: null,
      capturedAt: '2026-09-26T03:00:00.000Z',
    }
    expect(TenantUsageSnapshotSchema.parse(usage)).toEqual(usage)
    expect(
      TenantUsageSnapshotSchema.safeParse({ ...usage, storageBytes: 104857600 })
        .success
    ).toBe(false)
    expect(
      TenantUsageSnapshotSchema.safeParse({ ...usage, storageBytes: '-1' })
        .success
    ).toBe(false)
  })

  it('métricas em string decimal', () => {
    const metrics = {
      month: '2026-09',
      mrr: '14990.00',
      trialMrr: '1499.00',
      atRiskMrr: '299.80',
      logoChurn: '0.02',
      revenueChurn: '0.015',
      trialConversion: null,
      delinquency: { count: 2, amount: '299.80' },
      collected: '13840.10',
    }
    expect(PlatformMetricsSchema.parse(metrics)).toEqual(metrics)
    expect(
      PlatformMetricsSchema.safeParse({ ...metrics, mrr: 14990 }).success
    ).toBe(false)
    expect(
      PlatformMetricsSchema.safeParse({ ...metrics, month: '2026-13' }).success
    ).toBe(false)
    expect(
      PlatformMetricsSchema.safeParse({ ...metrics, logoChurn: '-0.1' }).success
    ).toBe(false)
  })

  it('auditoria sem IP nem metadata', () => {
    const entry = {
      id: 'clx0audit00000000001',
      actorKind: 'STAFF',
      action: 'support.grant.created',
      tenantId: 'clx0org0000000000001',
      targetType: 'SupportAccessGrant',
      targetId: 'clx0grant00000000001',
      reasonCategory: null,
      reason: REASON,
      createdAt: '2026-09-26T12:00:00.000Z',
    }
    expect(PlatformAuditEntrySchema.parse(entry)).toEqual(entry)
    for (const extra of [{ ipHash: 'x' }, { metadata: {} }]) {
      expect(
        PlatformAuditEntrySchema.safeParse({ ...entry, ...extra }).success
      ).toBe(false)
    }
    expect(
      PlatformAuditEntrySchema.safeParse({ ...entry, action: 'Suspended' })
        .success
    ).toBe(false)
  })
})

describe('erros do backoffice', () => {
  it('403 para equipe sem 2FA, papel insuficiente e suporte sem concessão', () => {
    expect(BACKOFFICE_ERROR_STATUS).toEqual({
      STAFF_TWO_FACTOR_REQUIRED: 403,
      STAFF_ROLE_FORBIDDEN: 403,
      SUPPORT_GRANT_REQUIRED: 403,
      SUPPORT_READ_ONLY: 403,
    })
    expect(Object.keys(BACKOFFICE_ERROR_STATUS)).toEqual([
      ...BACKOFFICE_ERROR_CODES,
    ])
    expect(Object.isFrozen(BACKOFFICE_ERROR_STATUS)).toBe(true)
  })

  it('corpo com mensagem e código, nada além', () => {
    const body = {
      error: 'Ative a verificação em duas etapas.',
      code: 'STAFF_TWO_FACTOR_REQUIRED',
    }
    expect(BackofficeErrorSchema.parse(body)).toEqual(body)
    expect(
      BackofficeErrorSchema.safeParse({ ...body, code: 'TENANT_NOT_FOUND' })
        .success
    ).toBe(false)
    expect(
      BackofficeErrorSchema.safeParse({ ...body, staffId: 'x' }).success
    ).toBe(false)
  })
})
