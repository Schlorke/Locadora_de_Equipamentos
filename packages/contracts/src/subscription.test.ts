// Contrato da assinatura (ADR docs/architecture/adr-saas-subscription.md, B.3,
// B.5, B.6 e D6).
import { describe, expect, it } from 'vitest'
import type { EntitlementsV1 } from './entitlements'
import {
  CLIENT_AREA_CARD_SCOPE,
  ORGANIZATION_ACCESS,
  PUBLIC_SITE_MODES,
  PUBLIC_TENANT_CARD_SCOPE_PARAM,
  PlanCodeSchema,
  PlatformInvoiceSchema,
  PublicPlanSchema,
  RESTRICTED_MUTATION_ALLOWLIST,
  RESTRICTED_MUTATION_SCOPE,
  SITE_INDEXABLE_HEADER,
  SITE_MODE_HEADER,
  SITE_PAUSED_CODE,
  SITE_PAUSED_HEADERS,
  SITE_PAUSED_MESSAGE,
  SITE_PAUSED_RETRY_AFTER_SECONDS,
  SUBSCRIPTION_ACCESS,
  SUBSCRIPTION_STATUSES,
  SubscriptionEventViewSchema,
  SubscriptionSummarySchema,
  TenantSubscriptionBriefSchema,
  accessForSubscriptionStatus,
  isRestrictedMutationAllowed,
  type SubscriptionStatus,
} from './subscription'

const entitlements: EntitlementsV1 = {
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
}

describe('estados e projeção de acesso (D6)', () => {
  it('são exatamente os seis estados, na ordem do ciclo de vida', () => {
    expect([...SUBSCRIPTION_STATUSES]).toEqual([
      'INCOMPLETE',
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'SUSPENDED',
      'CANCELED',
    ])
    expect([...ORGANIZATION_ACCESS]).toEqual([
      'SETUP',
      'FULL',
      'RESTRICTED',
      'ARCHIVED',
    ])
  })

  it('SETUP, FULL, FULL, FULL, RESTRICTED, ARCHIVED', () => {
    expect(SUBSCRIPTION_STATUSES.map(accessForSubscriptionStatus)).toEqual([
      'SETUP',
      'FULL',
      'FULL',
      'FULL',
      'RESTRICTED',
      'ARCHIVED',
    ])
    expect(Object.keys(SUBSCRIPTION_ACCESS)).toEqual([...SUBSCRIPTION_STATUSES])
    expect(Object.isFrozen(SUBSCRIPTION_ACCESS)).toBe(true)
  })
})

describe('site público por estado (S13, B.5 e B.10)', () => {
  it('três modos e o código estável do 503 da vitrine em pausa', () => {
    expect([...PUBLIC_SITE_MODES]).toEqual(['LIVE', 'PAUSED', 'OFF'])
    expect(SITE_PAUSED_CODE).toBe('SITE_PAUSED')
  })

  it('503 com Retry-After, sem cache e noindex', () => {
    expect(SITE_PAUSED_RETRY_AFTER_SECONDS).toBe(3600)
    expect(SITE_PAUSED_HEADERS).toEqual({
      'Cache-Control': 'no-store',
      'Retry-After': '3600',
      'X-Robots-Tag': 'noindex',
    })
    expect(Object.isFrozen(SITE_PAUSED_HEADERS)).toBe(true)
  })

  it('mensagem neutra: não cita assinatura, dívida, pagamento nem plataforma', () => {
    expect(SITE_PAUSED_MESSAGE).toBe(
      'Este site está temporariamente indisponível.'
    )
    expect(SITE_PAUSED_MESSAGE).not.toMatch(
      /assinatura|d[ií]vida|pagamento|plataforma|fatura|suspens/i
    )
  })

  it('cabeçalhos do modo no cartão público, em minúsculas', () => {
    expect(SITE_MODE_HEADER).toBe('x-site-mode')
    expect(SITE_INDEXABLE_HEADER).toBe('x-site-indexable')
  })

  it('escopo da área do cliente no cartão: ?scope=client-area', () => {
    expect(PUBLIC_TENANT_CARD_SCOPE_PARAM).toBe('scope')
    expect(CLIENT_AREA_CARD_SCOPE).toBe('client-area')
  })
})

describe('RESTRICTED_MUTATION_ALLOWLIST (B.5)', () => {
  it('cobre as exceções do ADR, sem repetição e imutável', () => {
    expect([...RESTRICTED_MUTATION_ALLOWLIST]).toEqual([
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
      // Decisão do dono D-D (onda 134): corrigir ou retirar o texto legal da vitrine, que segue no ar na pausa.
      'STOREFRONT_LEGAL_DOCUMENT',
    ])
    expect(Object.isFrozen(RESTRICTED_MUTATION_ALLOWLIST)).toBe(true)
    expect(Object.keys(RESTRICTED_MUTATION_SCOPE)).toEqual([
      ...RESTRICTED_MUTATION_ALLOWLIST,
    ])
    expect(Object.isFrozen(RESTRICTED_MUTATION_SCOPE)).toBe(true)
  })

  it('a troca de plano em pausa exige quitar antes', () => {
    expect(RESTRICTED_MUTATION_SCOPE.SUBSCRIPTION_CHANGE_PLAN).toMatch(/quitar/)
  })

  it('isRestrictedMutationAllowed só reconhece códigos da lista', () => {
    expect(isRestrictedMutationAllowed('DATA_EXPORT')).toBe(true)
    for (const code of [
      'CATALOG_WRITE',
      'EQUIPMENT_CREATE',
      'data_export',
      '',
      null,
      undefined,
      1,
    ]) {
      expect(isRestrictedMutationAllowed(code)).toBe(false)
    }
  })
})

describe('catálogo de planos', () => {
  const plan = {
    planVersionId: 'clx0plan0version0001',
    code: 'essencial',
    name: 'Essencial',
    version: 1,
    interval: 'MONTHLY',
    amount: '149.90',
    trialDays: 14,
    entitlements,
  }
  const parse = (value: unknown) => PublicPlanSchema.safeParse(value).success

  it('aceita um plano público válido', () => {
    expect(PublicPlanSchema.parse(plan)).toEqual(plan)
  })

  it('plano público nunca custa zero e preço é string decimal', () => {
    expect(parse({ ...plan, amount: '0.00' })).toBe(false)
    expect(parse({ ...plan, amount: 149.9 })).toBe(false)
    expect(parse({ ...plan, amount: '149.9' })).toBe(false)
  })

  it('respeita os CHECKs do banco', () => {
    expect(parse({ ...plan, trialDays: 31 })).toBe(false)
    expect(parse({ ...plan, trialDays: -1 })).toBe(false)
    expect(parse({ ...plan, trialDays: 30 })).toBe(true)
    expect(parse({ ...plan, version: 0 })).toBe(false)
    expect(parse({ ...plan, interval: 'WEEKLY' })).toBe(false)
  })

  it('valida os direitos com o contrato estrito', () => {
    expect(
      parse({
        ...plan,
        entitlements: {
          ...entitlements,
          limits: { equipments: 0, staffSeats: 1 },
        },
      })
    ).toBe(false)
    expect(parse({ ...plan, entitlements: { schema: 1 } })).toBe(false)
  })

  it('não aceita campos internos (ex.: sellableUntil, isPublic)', () => {
    expect(parse({ ...plan, sellableUntil: null })).toBe(false)
    expect(parse({ ...plan, isPublic: true })).toBe(false)
  })

  it.each([
    ['essencial', true],
    ['pro-30', true],
    ['ab', true],
    ['a', false],
    ['Pro', false],
    ['pro_30', false],
    ['x'.repeat(33), false],
  ])('Plan.code %j → %s', (code, expected) => {
    expect(PlanCodeSchema.safeParse(code).success).toBe(expected)
  })
})

describe('resumo da assinatura do dono', () => {
  const summary = {
    status: 'TRIALING' as SubscriptionStatus,
    access: 'FULL',
    billingMode: 'ASAAS',
    plan: {
      code: 'essencial',
      name: 'Essencial',
      version: 1,
      interval: 'MONTHLY',
      amount: '149.90',
    },
    scheduledPlan: null,
    scheduledChangeAt: null,
    trialEndsAt: '2026-10-10',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    pastDueSince: null,
    graceEndsAt: null,
    suspendedAt: null,
    complimentaryUntil: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    cancelReason: null,
    entitlements,
    usage: { equipments: 4, staffSeats: 1 },
  }
  const parse = (value: unknown) =>
    SubscriptionSummarySchema.safeParse(value).success

  it('aceita o resumo coerente', () => {
    expect(SubscriptionSummarySchema.parse(summary)).toEqual(summary)
  })

  it('access precisa ser a projeção do status', () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      for (const access of ORGANIZATION_ACCESS) {
        const canceled = status === 'CANCELED'
        const value = {
          ...summary,
          status,
          access,
          canceledAt: canceled ? '2026-11-01T03:00:00.000Z' : null,
          cancelReason: canceled ? 'NON_PAYMENT' : null,
        }
        expect([status, access, parse(value)]).toEqual([
          status,
          access,
          SUBSCRIPTION_ACCESS[status] === access,
        ])
      }
    }
  })

  it('plano agendado e data de troca andam juntos', () => {
    const scheduledPlan = { ...summary.plan, code: 'basico', amount: '99.90' }
    expect(
      parse({ ...summary, scheduledPlan, scheduledChangeAt: '2026-11-01' })
    ).toBe(true)
    expect(parse({ ...summary, scheduledPlan })).toBe(false)
    expect(parse({ ...summary, scheduledChangeAt: '2026-11-01' })).toBe(false)
  })

  it('canceledAt existe só em CANCELED', () => {
    expect(parse({ ...summary, canceledAt: '2026-11-01T03:00:00.000Z' })).toBe(
      false
    )
    expect(parse({ ...summary, status: 'CANCELED', access: 'ARCHIVED' })).toBe(
      false
    )
  })

  it('datas civis e instantes são validados', () => {
    expect(parse({ ...summary, trialEndsAt: '2026-02-30' })).toBe(false)
    expect(parse({ ...summary, trialEndsAt: '10/10/2026' })).toBe(false)
    expect(parse({ ...summary, trialEndsAt: '2026-10-10T00:00:00.000Z' })).toBe(
      false
    )
    expect(
      parse({
        ...summary,
        status: 'SUSPENDED',
        access: 'RESTRICTED',
        suspendedAt: '2026-10-17T12:00:00-03:00',
      })
    ).toBe(true)
    expect(
      parse({
        ...summary,
        status: 'SUSPENDED',
        access: 'RESTRICTED',
        suspendedAt: '2026-10-17 12:00',
      })
    ).toBe(false)
  })

  it('é estrito: não aceita dados do provedor nem do dono', () => {
    for (const extra of [
      { providerCustomerId: 'cus_000' },
      { providerSubscriptionId: 'sub_000' },
      { billingEmail: 'dono@locadora.example' },
      { revision: 3 },
    ]) {
      expect(parse({ ...summary, ...extra })).toBe(false)
    }
  })

  it('o resumo curto do TenantContext tem só estado e datas', () => {
    const brief = {
      status: 'PAST_DUE',
      trialEndsAt: null,
      graceEndsAt: '2026-10-17',
    }
    expect(TenantSubscriptionBriefSchema.parse(brief)).toEqual(brief)
    expect(
      TenantSubscriptionBriefSchema.safeParse({ ...brief, access: 'FULL' })
        .success
    ).toBe(false)
  })
})

describe('faturas da mensalidade', () => {
  const invoice = {
    id: 'clx0invoice0000000001',
    kind: 'CYCLE',
    status: 'PENDING',
    amount: '149.90',
    dueDate: '2026-10-10',
    periodStart: '2026-10-10',
    periodEnd: '2026-11-09',
    billingType: 'UNDEFINED',
    invoiceUrl: 'https://www.asaas.com/i/0000000000000000',
    paidAt: null,
    canceledReason: null,
  }
  const parse = (value: unknown) =>
    PlatformInvoiceSchema.safeParse(value).success

  it('aceita a fatura hospedada no Asaas', () => {
    expect(PlatformInvoiceSchema.parse(invoice)).toEqual(invoice)
    expect(
      parse({ ...invoice, invoiceUrl: 'https://sandbox.asaas.com/i/abc' })
    ).toBe(true)
    expect(parse({ ...invoice, invoiceUrl: null })).toBe(true)
  })

  it.each([
    'http://www.asaas.com/i/abc',
    'https://asaas.com.evil.example/i/abc',
    'https://evil.example/www.asaas.com/i/abc',
    'https://wwwasaas.com/i/abc',
    'https://asaas.com/i/abc',
    'https://user:senha-ficticia@www.asaas.com/i/abc',
    'javascript:alert(1)',
    '//www.asaas.com/i/abc',
    'www.asaas.com/i/abc',
  ])('recusa invoiceUrl %j', (invoiceUrl) => {
    expect(parse({ ...invoice, invoiceUrl })).toBe(false)
  })

  it('canceledReason só em fatura CANCELED', () => {
    expect(
      parse({
        ...invoice,
        status: 'CANCELED',
        canceledReason: 'FUTURE_AFTER_CANCEL',
      })
    ).toBe(true)
    expect(parse({ ...invoice, canceledReason: 'REACTIVATION_WAIVER' })).toBe(
      false
    )
    expect(
      parse({ ...invoice, status: 'CANCELED', canceledReason: 'OTHER' })
    ).toBe(false)
  })

  it('não expõe o id do pagamento no provedor', () => {
    expect(parse({ ...invoice, providerPaymentId: 'pay_000' })).toBe(false)
    expect(parse({ ...invoice, amount: 149.9 })).toBe(false)
  })
})

describe('histórico da assinatura', () => {
  it('aceita evento com variação de MRR negativa', () => {
    const event = {
      id: 'clx0event00000000001',
      fromStatus: 'ACTIVE',
      toStatus: 'CANCELED',
      reason: 'OWNER_CANCEL',
      source: 'JOB',
      mrrDelta: '-149.90',
      occurredAt: '2026-11-01T03:00:00.000Z',
    }
    expect(SubscriptionEventViewSchema.parse(event)).toEqual(event)
    expect(
      SubscriptionEventViewSchema.safeParse({
        ...event,
        reason: 'owner cancel',
      }).success
    ).toBe(false)
    expect(
      SubscriptionEventViewSchema.safeParse({ ...event, dedupeKey: 'x' })
        .success
    ).toBe(false)
  })
})
