// Contrato do cadastro self-service (ADR docs/architecture/adr-saas-subscription.md,
// B.8, D19, D20 e D21). Só forma: o dígito verificador do CNPJ é do domínio (S1).
import { describe, expect, it } from 'vitest'
import {
  BRAZILIAN_STATES,
  BrazilianPhoneSchema,
  CNPJ_NORMALIZED_RE,
  CnpjSchema,
  CompanyDataSchema,
  CreateOrganizationInputSchema,
  CreateOrganizationResponseSchema,
  IdempotencyKeySchema,
  LEGAL_DOCUMENT_KINDS,
  ONBOARDING_STEPS,
  OnboardingStatusResponseSchema,
  PostalCodeSchema,
  REQUIRED_SIGNUP_DOCUMENTS,
  SignupAcceptancesSchema,
  SlugAvailabilityResponseSchema,
  normalizeCnpjInput,
  type CompanyDataInput,
  type LegalAcceptanceInput,
} from './onboarding'

const HASH = 'a'.repeat(64)
const acceptances: LegalAcceptanceInput[] = REQUIRED_SIGNUP_DOCUMENTS.map(
  (kind) => ({ kind, version: '2026-10-01', textSha256: HASH })
)

const company: CompanyDataInput = {
  cnpj: '12.ABC.345/01DE-35',
  legalName: 'Acme Locação de Equipamentos Ltda',
  tradeName: 'Acme Locações',
  companyType: 'LIMITED',
  phone: '(41) 99876-5432',
  postalCode: '80000-000',
  addressLine: 'Rua Exemplo',
  addressNumber: '100',
  addressComplement: null,
  district: 'Centro',
  city: 'Curitiba',
  state: 'PR',
  representationDeclared: true,
}

describe('etapas', () => {
  it('seguem a ordem da tela', () => {
    expect([...ONBOARDING_STEPS]).toEqual([
      'ACCOUNT',
      'EMAIL_VERIFICATION',
      'COMPANY',
      'SITE_ADDRESS',
      'PLAN',
      'TERMS',
      'CREATE',
    ])
  })
})

describe('CNPJ: forma numérica e alfanumérica (T-D2)', () => {
  it.each([
    ['11222333000181', '11222333000181'],
    ['11.222.333/0001-81', '11222333000181'],
    ['12ABC34501DE35', '12ABC34501DE35'],
    ['12.ABC.345/01DE-35', '12ABC34501DE35'],
    ['12.abc.345/01de-35', '12ABC34501DE35'],
    ['  12.ABC.345/01DE-35 ', '12ABC34501DE35'],
    ['ZZZZZZZZZZZZ00', 'ZZZZZZZZZZZZ00'],
  ])('%j → %j', (input, normalized) => {
    expect(normalizeCnpjInput(input)).toBe(normalized)
    expect(CnpjSchema.parse(input)).toBe(normalized)
    expect(CNPJ_NORMALIZED_RE.test(normalized)).toBe(true)
  })

  it.each([
    '12ABC34501DEA5',
    '12ABC34501DE3X',
    '1122233300018',
    '112223330001811',
    '11.222.333.0001-81',
    '11-222-333/0001-81',
    '11.222.333/0001.81',
    '11 222 333 0001 81',
    '12ÁBC34501DE35',
    '12ABC34501DE3５',
    '',
    '..//--',
  ])('recusa %j', (input) => {
    expect(normalizeCnpjInput(input)).toBeNull()
    expect(CnpjSchema.safeParse(input).success).toBe(false)
  })

  it('não apaga letras (D21) nem aceita número', () => {
    expect(CnpjSchema.parse('AB.CDE.FGH/IJKL-12')).toBe('ABCDEFGHIJKL12')
    expect(CnpjSchema.safeParse(11222333000181).success).toBe(false)
  })
})

describe('telefone, CEP e UF', () => {
  it.each([
    ['(41) 99876-5432', '41998765432'],
    ['+55 41 99876-5432', '41998765432'],
    ['5541998765432', '41998765432'],
    ['41 3333-4444', '4133334444'],
    ['55 99999-9999', '55999999999'],
    ['+55 55 99999-9999', '55999999999'],
  ])('telefone %j → %j', (input, normalized) => {
    expect(BrazilianPhoneSchema.parse(input)).toBe(normalized)
  })

  it.each([
    '(01) 99876-5432',
    '41 1234-5678',
    '41 8876-54321',
    '999',
    '+1 415 555 0100',
    '41 99876-5432 ramal 2',
    '',
  ])('recusa telefone %j', (input) => {
    expect(BrazilianPhoneSchema.safeParse(input).success).toBe(false)
  })

  it('CEP sai com 8 dígitos', () => {
    expect(PostalCodeSchema.parse('80000-000')).toBe('80000000')
    expect(PostalCodeSchema.parse('80000000')).toBe('80000000')
    for (const input of ['8000-000', '80000-0000', 'ABCDE-FGH', '80.000-000'])
      expect(PostalCodeSchema.safeParse(input).success).toBe(false)
  })

  it('UF é uma das 27', () => {
    expect(BRAZILIAN_STATES).toHaveLength(27)
    expect(new Set(BRAZILIAN_STATES).size).toBe(27)
    expect(
      CompanyDataSchema.safeParse({ ...company, state: 'XX' }).success
    ).toBe(false)
    expect(
      CompanyDataSchema.safeParse({ ...company, state: 'pr' }).success
    ).toBe(false)
  })
})

describe('dados da empresa', () => {
  const parse = (value: unknown) => CompanyDataSchema.safeParse(value).success

  it('normaliza CNPJ, telefone e CEP', () => {
    expect(CompanyDataSchema.parse(company)).toEqual({
      ...company,
      cnpj: '12ABC34501DE35',
      phone: '41998765432',
      postalCode: '80000000',
    })
  })

  it('exige a declaração de representação marcada', () => {
    expect(parse({ ...company, representationDeclared: false })).toBe(false)
    const without: Record<string, unknown> = { ...company }
    delete without.representationDeclared
    expect(parse(without)).toBe(false)
  })

  it('recusa dado pessoal ou de cobrança que o cadastro não pede', () => {
    for (const extra of [
      { cpf: '000.000.000-00' },
      { birthDate: '1990-01-01' },
      { ownerEmail: 'dono@locadora.example' },
      { billingEmail: 'financeiro@locadora.example' },
      { incomeValue: '25000.00' },
      { bankAccount: '0000' },
    ]) {
      expect(parse({ ...company, ...extra })).toBe(false)
    }
  })

  it('recusa tipo de empresa desconhecido e textos vazios', () => {
    expect(parse({ ...company, companyType: 'SA' })).toBe(false)
    expect(parse({ ...company, legalName: '   ' })).toBe(false)
    expect(parse({ ...company, addressNumber: '' })).toBe(false)
    expect(parse({ ...company, addressComplement: 'Sala 2' })).toBe(true)
  })
})

describe('termos', () => {
  const parse = (value: unknown) =>
    SignupAcceptancesSchema.safeParse(value).success

  it('exige os quatro documentos; marketing é opcional', () => {
    expect([...REQUIRED_SIGNUP_DOCUMENTS]).toEqual([
      'PLATFORM_TERMS',
      'PRIVACY_POLICY',
      'DATA_PROCESSING_AGREEMENT',
      'PAYMENTS_PARTNER_NOTICE',
    ])
    expect(parse(acceptances)).toBe(true)
    expect(
      parse([
        ...acceptances,
        { kind: 'MARKETING_OPT_IN', version: '2026-10-01', textSha256: HASH },
      ])
    ).toBe(true)
    for (const kind of REQUIRED_SIGNUP_DOCUMENTS) {
      expect([
        kind,
        parse([
          ...acceptances.filter((acceptance) => acceptance.kind !== kind),
          { kind: 'MARKETING_OPT_IN', version: '2026-10-01', textSha256: HASH },
        ]),
      ]).toEqual([kind, false])
    }
  })

  it('recusa aceite repetido, hash fora do formato e versão que não é data', () => {
    const first = acceptances[0]
    if (!first) throw new Error('lista vazia')
    expect(parse([...acceptances, first])).toBe(false)
    expect(
      parse([{ ...first, textSha256: 'A'.repeat(64) }, ...acceptances.slice(1)])
    ).toBe(false)
    expect(
      parse([{ ...first, textSha256: 'a'.repeat(63) }, ...acceptances.slice(1)])
    ).toBe(false)
    expect(parse([{ ...first, version: 'v1' }, ...acceptances.slice(1)])).toBe(
      false
    )
    expect(parse([{ ...first, ipHash: 'x' }, ...acceptances.slice(1)])).toBe(
      false
    )
    expect(LEGAL_DOCUMENT_KINDS).toContain('MARKETING_OPT_IN')
  })
})

describe('endereço do site', () => {
  it('disponibilidade responde só sim ou não com sugestões, sem motivo', () => {
    expect(SlugAvailabilityResponseSchema.parse({ available: true })).toEqual({
      available: true,
    })
    expect(
      SlugAvailabilityResponseSchema.parse({
        available: false,
        suggestions: ['acme-locacoes', 'acme-2'],
      })
    ).toEqual({ available: false, suggestions: ['acme-locacoes', 'acme-2'] })
    for (const body of [
      { available: false, suggestions: [], reason: 'RESERVED' },
      { available: false, suggestions: [], reason: 'TAKEN' },
      { available: true, suggestions: [] },
      { available: false },
      { available: false, suggestions: ['a--b'] },
      { available: false, suggestions: Array(6).fill('acme') },
    ]) {
      expect(SlugAvailabilityResponseSchema.safeParse(body).success).toBe(false)
    }
  })

  it('o pedido de criação só confere a sintaxe do slug', () => {
    const input = {
      company,
      slug: 'acme',
      planVersionId: 'clx0plan0version0001',
      acceptances,
    }
    const parse = (slug: string) =>
      CreateOrganizationInputSchema.safeParse({ ...input, slug }).success
    expect(parse('acme')).toBe(true)
    // Reservado e bloqueado passam aqui e recebem 409 SLUG_UNAVAILABLE no servidor.
    expect(parse('admin')).toBe(true)
    expect(parse('pix-locacoes')).toBe(true)
    for (const slug of [
      'a--b',
      'Acme',
      'a',
      '-acme',
      'acme.x',
      'x'.repeat(64),
    ]) {
      expect([slug, parse(slug)]).toEqual([slug, false])
    }
    expect(
      CreateOrganizationInputSchema.safeParse({ ...input, tenantId: 'x' })
        .success
    ).toBe(false)
  })
})

describe('criação e idempotência', () => {
  it('Idempotency-Key de 16 a 128 caracteres seguros', () => {
    expect(
      IdempotencyKeySchema.safeParse('3f0e8c1a-2b4d-4e6f-8a9b-0c1d2e3f4a5b')
        .success
    ).toBe(true)
    for (const key of [
      'curta',
      'x'.repeat(129),
      'chave com espaço 123456',
      '',
    ]) {
      expect(IdempotencyKeySchema.safeParse(key).success).toBe(false)
    }
  })

  const response = {
    organization: {
      id: 'clx0org0000000000001',
      slug: 'acme',
      name: 'Acme Locações',
    },
    subscription: { status: 'TRIALING', trialEndsAt: '2026-10-10' },
    notices: [],
  }

  it('teste repetido nasce INCOMPLETE com aviso', () => {
    expect(CreateOrganizationResponseSchema.parse(response)).toEqual(response)
    expect(
      CreateOrganizationResponseSchema.safeParse({
        ...response,
        subscription: { status: 'INCOMPLETE', trialEndsAt: null },
        notices: ['TRIAL_ALREADY_USED'],
      }).success
    ).toBe(true)
    expect(
      CreateOrganizationResponseSchema.safeParse({
        ...response,
        subscription: { status: 'INCOMPLETE', trialEndsAt: '2026-10-10' },
      }).success
    ).toBe(false)
    expect(
      CreateOrganizationResponseSchema.safeParse({
        ...response,
        subscription: { status: 'ACTIVE', trialEndsAt: null },
      }).success
    ).toBe(false)
  })
})

describe('checklist "Primeiros passos"', () => {
  const base = [
    { id: 'ACCOUNT_CREATED', done: true },
    { id: 'FIRST_EQUIPMENT', done: false },
    { id: 'CUSTOMIZE_SITE', done: false },
    { id: 'PUBLISH_SITE', done: false },
    { id: 'ACTIVATE_ONLINE_PAYMENTS', done: false },
  ]
  const parse = (subscriptionStatus: string, items: unknown[]) =>
    OnboardingStatusResponseSchema.safeParse({ subscriptionStatus, items })
      .success

  it('SUBSCRIBE aparece só no teste', () => {
    expect(parse('TRIALING', [...base, { id: 'SUBSCRIBE', done: false }])).toBe(
      true
    )
    expect(parse('TRIALING', base)).toBe(false)
    expect(parse('ACTIVE', base)).toBe(true)
    expect(parse('ACTIVE', [...base, { id: 'SUBSCRIBE', done: true }])).toBe(
      false
    )
  })

  it('confirmação anual é opcional, mas na ordem', () => {
    expect(
      parse('ACTIVE', [...base, { id: 'CONFIRM_COMMERCIAL_INFO', done: false }])
    ).toBe(true)
    expect(
      parse('ACTIVE', [{ id: 'CONFIRM_COMMERCIAL_INFO', done: false }, ...base])
    ).toBe(false)
  })

  it('recusa itens faltando, repetidos ou fora de ordem', () => {
    expect(parse('ACTIVE', base.slice(1))).toBe(false)
    expect(parse('ACTIVE', [...base, base[0]])).toBe(false)
    expect(parse('ACTIVE', [base[1], base[0], ...base.slice(2)])).toBe(false)
  })
})
