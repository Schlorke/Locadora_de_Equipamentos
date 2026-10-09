// Contrato da conta de recebimentos (ADR docs/architecture/adr-saas-subscription.md,
// B.3, B.7, D9, D10 e D22).
import { describe, expect, it } from 'vitest'
import {
  ConnectAsaasAccountInputSchema,
  ConnectAsaasAccountResponseSchema,
  CreatePaymentAccountInputSchema,
  CreatePaymentAccountResponseSchema,
  DocumentsLinkResponseSchema,
  PAYMENT_ACCOUNT_KINDS,
  PAYMENT_ACCOUNT_STATUSES,
  PaymentAccountCommercialInfoInputSchema,
  PaymentAccountCreationOfferSchema,
  PaymentAccountResponseSchema,
  PaymentAccountSetupSchema,
  PaymentAccountViewSchema,
  PayoutRequestInputSchema,
  SubaccountModelSchema,
  paymentAccountKind,
} from './payment-account'

it('connection receipt contains no account, approval or credential fields', () => {
  expect(ConnectAsaasAccountResponseSchema.parse({ accepted: true })).toEqual({
    accepted: true,
  })
  expect(
    ConnectAsaasAccountResponseSchema.safeParse({
      accepted: true,
      approved: true,
    }).success
  ).toBe(false)
  expect(
    ConnectAsaasAccountResponseSchema.safeParse({
      accepted: true,
      apiKey: 'synthetic',
    }).success
  ).toBe(false)
})

describe('modos: BaaS, STANDARD e conta conectada', () => {
  it('subconta exige modelo; conta conectada não tem modelo', () => {
    const parse = (value: unknown) =>
      PaymentAccountSetupSchema.safeParse(value).success
    expect(parse({ mode: 'ASAAS_SUBACCOUNT', subaccountModel: 'BAAS' })).toBe(
      true
    )
    expect(
      parse({ mode: 'ASAAS_SUBACCOUNT', subaccountModel: 'STANDARD' })
    ).toBe(true)
    expect(
      parse({ mode: 'ASAAS_CONNECTED_ACCOUNT', subaccountModel: null })
    ).toBe(true)
    expect(parse({ mode: 'ASAAS_SUBACCOUNT', subaccountModel: null })).toBe(
      false
    )
    expect(parse({ mode: 'ASAAS_SUBACCOUNT' })).toBe(false)
    expect(
      parse({ mode: 'ASAAS_CONNECTED_ACCOUNT', subaccountModel: 'BAAS' })
    ).toBe(false)
    expect(parse({ mode: 'STRIPE_CONNECT', subaccountModel: null })).toBe(false)
  })

  it('paymentAccountKind dá o modo exibido', () => {
    expect([...PAYMENT_ACCOUNT_KINDS]).toEqual([
      'BAAS',
      'STANDARD',
      'CONNECTED',
    ])
    expect(
      paymentAccountKind({ mode: 'ASAAS_SUBACCOUNT', subaccountModel: 'BAAS' })
    ).toBe('BAAS')
    expect(
      paymentAccountKind({
        mode: 'ASAAS_SUBACCOUNT',
        subaccountModel: 'STANDARD',
      })
    ).toBe('STANDARD')
    expect(
      paymentAccountKind({
        mode: 'ASAAS_CONNECTED_ACCOUNT',
        subaccountModel: null,
      })
    ).toBe('CONNECTED')
  })

  it('PLATFORM_ASAAS_SUBACCOUNT_MODEL aceita só BAAS ou STANDARD', () => {
    expect(SubaccountModelSchema.safeParse('BAAS').success).toBe(true)
    expect(SubaccountModelSchema.safeParse('STANDARD').success).toBe(true)
    expect(SubaccountModelSchema.safeParse('baas').success).toBe(false)
  })

  it('estados espelham o enum do banco', () => {
    expect([...PAYMENT_ACCOUNT_STATUSES]).toEqual([
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
    ])
  })
})

describe('visão do dono', () => {
  const view = {
    kind: 'BAAS',
    status: 'UNDER_REVIEW',
    environment: 'sandbox',
    healthIssue: null,
    providerStatusText: null,
    commercialInfoExpiresAt: null,
    commercialInfoExpired: false,
    approvedAt: null,
    lastSyncedAt: '2026-09-26T12:00:00.000Z',
  }

  it('aceita estado, datas e saúde', () => {
    expect(PaymentAccountViewSchema.parse(view)).toEqual(view)
    expect(PaymentAccountResponseSchema.parse({ account: null })).toEqual({
      account: null,
    })
  })

  it.each([
    'apiKey',
    'accessToken',
    'authToken',
    'credentialsRef',
    'walletId',
    'providerAccountId',
    'onboardingUrl',
    'bankAccount',
    'ciphertext',
    'incomeRange',
    'incomeValue',
    'mobilePhone',
  ])('nunca carrega %s', (field) => {
    expect(
      PaymentAccountViewSchema.safeParse({ ...view, [field]: 'x' }).success
    ).toBe(false)
  })
})

describe('ações do dono', () => {
  const commercial = {
    incomeValue: '12345.67',
    mobilePhone: '+55 (41) 99876-5432',
    companyDataConfirmed: true,
  }
  const version = 'a'.repeat(64)
  const commercialOk = (value: unknown) =>
    PaymentAccountCommercialInfoInputSchema.safeParse(value).success
  const creationOk = (value: unknown) =>
    CreatePaymentAccountInputSchema.safeParse(value).success

  it('dados comerciais: faturamento mensal exato, celular e confirmação dos dados', () => {
    expect(PaymentAccountCommercialInfoInputSchema.parse(commercial)).toEqual({
      ...commercial,
      mobilePhone: '41998765432',
    })
    expect(
      CreatePaymentAccountInputSchema.parse({
        ...commercial,
        companyDataVersion: version,
      })
    ).toEqual({
      ...commercial,
      mobilePhone: '41998765432',
      companyDataVersion: version,
    })
  })

  it.each(['0.00', '12345.67', '9999999999.99', '199.90'])(
    'aceita o faturamento %s (reais com centavos exatos, sem mínimo nem teto)',
    (incomeValue) => {
      expect(commercialOk({ ...commercial, incomeValue })).toBe(true)
    }
  )

  it.each([
    12345.67,
    '12345.6',
    '12345.678',
    '-1.00',
    '1e3',
    '012.00',
    '10000000000.00',
    '12.345,67',
    ' 12345.67',
    '',
    null,
  ])(
    'recusa o faturamento %j (só string decimal com duas casas)',
    (incomeValue) => {
      expect(commercialOk({ ...commercial, incomeValue })).toBe(false)
    }
  )

  it.each(['11987654321', '(11) 98765-4321', '+55 11 98765-4321'])(
    'aceita o celular %s',
    (mobilePhone) => {
      expect(commercialOk({ ...commercial, mobilePhone })).toBe(true)
    }
  )

  it.each(['1133334444', '(11) 3333-4444', '11887654321', '0198765432', '123'])(
    'recusa %s: só celular (o campo do Asaas é mobilePhone)',
    (mobilePhone) => {
      expect(commercialOk({ ...commercial, mobilePhone })).toBe(false)
    }
  )

  it('exige a confirmação e recusa campos extras, como a faixa antiga', () => {
    const without: Record<string, unknown> = { ...commercial }
    delete without.companyDataConfirmed
    expect(commercialOk(without)).toBe(false)
    expect(commercialOk({ ...commercial, companyDataConfirmed: false })).toBe(
      false
    )
    expect(commercialOk({ ...commercial, incomeRange: 'UP_TO_10K' })).toBe(
      false
    )
    expect(commercialOk({ ...commercial, cpf: '000.000.000-00' })).toBe(false)
  })

  it('a criação exige a versão dos dados; o comercial (confirmação anual) não a aceita', () => {
    expect(commercialOk({ ...commercial, companyDataVersion: version })).toBe(
      false
    )
    expect(creationOk(commercial)).toBe(false)
    for (const companyDataVersion of [
      'A'.repeat(64),
      'a'.repeat(63),
      'g'.repeat(64),
      '',
    ])
      expect(creationOk({ ...commercial, companyDataVersion })).toBe(false)
    expect(
      creationOk({
        ...commercial,
        companyDataVersion: version,
        incomeRange: 'UP_TO_10K',
      })
    ).toBe(false)
    expect(
      creationOk({
        ...commercial,
        companyDataVersion: version,
        environment: 'production',
      })
    ).toBe(false)
  })

  it('o aceite da criação não carrega conta, aprovação nem valor', () => {
    expect(
      CreatePaymentAccountResponseSchema.parse({ accepted: true })
    ).toEqual({ accepted: true })
    for (const extra of [
      { approved: true },
      { incomeValue: '1.00' },
      { accountId: 'x' },
    ])
      expect(
        CreatePaymentAccountResponseSchema.safeParse({
          accepted: true,
          ...extra,
        }).success
      ).toBe(false)
  })

  describe('oferta de criação', () => {
    const company = {
      legalName: 'Locadora Ficticia Ltda',
      cnpj: '11.222.333/0001-81',
      companyType: 'LIMITED',
      loginEmail: 'dono@locadora.example',
      email: 'financeiro@locadora.example',
      address: {
        street: 'Rua Ficticia',
        number: '10',
        complement: null,
        district: 'Centro',
        postalCode: '01001000',
      },
      site: 'https://ficticia.example.test',
    }
    const available = {
      available: true,
      blocker: null,
      model: 'STANDARD',
      company,
      suggestedMobilePhone: '11987654321',
      companyDataVersion: version,
      lastRequestOutcome: null,
    }
    const blocked = (blocker: string) => ({
      available: false,
      blocker,
      model: null,
      company: null,
      suggestedMobilePhone: null,
      companyDataVersion: null,
      lastRequestOutcome: null,
    })
    const offerOk = (value: unknown) =>
      PaymentAccountCreationOfferSchema.safeParse(value).success
    const blockers =
      PaymentAccountCreationOfferSchema.shape.blocker.unwrap().options
    const outcomes =
      PaymentAccountCreationOfferSchema.shape.lastRequestOutcome.unwrap()
        .options

    it('nove bloqueios, na ordem de avaliação, e três desfechos do pedido anterior', () => {
      expect(blockers).toEqual([
        'CREATION_UNAVAILABLE',
        'ACCOUNT_EXISTS',
        'SUBSCRIPTION_RESTRICTED',
        'MODULE_NOT_IN_PLAN',
        'FIRST_PAYMENT_REQUIRED',
        'EMAIL_NOT_VERIFIED',
        'PAYMENTS_NOTICE_REQUIRED',
        'COMPANY_DATA_INCOMPLETE',
        'DOCUMENT_IN_USE',
      ])
      expect(outcomes).toEqual([
        'REJECTED_DATA',
        'REJECTED_PROVIDER',
        'CANCELLED',
      ])
      for (const blocker of blockers)
        expect(offerOk(blocked(blocker))).toBe(true)
      for (const lastRequestOutcome of outcomes)
        expect(offerOk({ ...available, lastRequestOutcome })).toBe(true)
      expect(offerOk({ ...available, lastRequestOutcome: 'CODE_123' })).toBe(
        false
      )
    })

    it('disponível exatamente quando não há bloqueio, com modelo, empresa e versão', () => {
      expect(offerOk(available)).toBe(true)
      expect(offerOk({ ...available, suggestedMobilePhone: null })).toBe(true)
      expect(offerOk({ ...available, blocker: 'ACCOUNT_EXISTS' })).toBe(false)
      expect(offerOk({ ...available, company: null })).toBe(false)
      expect(offerOk({ ...available, companyDataVersion: null })).toBe(false)
      expect(offerOk({ ...available, model: null })).toBe(false)
      expect(offerOk({ ...blocked('ACCOUNT_EXISTS'), available: true })).toBe(
        false
      )
      expect(offerOk({ ...blocked('ACCOUNT_EXISTS'), blocker: null })).toBe(
        false
      )
    })

    it('indisponível nunca expõe dados da empresa', () => {
      for (const extra of [
        { company },
        { companyDataVersion: version },
        { suggestedMobilePhone: '11987654321' },
        { model: 'STANDARD' },
      ])
        expect(
          offerOk({ ...blocked('FIRST_PAYMENT_REQUIRED'), ...extra })
        ).toBe(false)
    })

    it.each([
      'incomeValue',
      'mobilePhone',
      'apiKey',
      'providerAccountId',
      'walletId',
      'providerCodes',
    ])('nunca carrega %s', (field) => {
      expect(offerOk({ ...available, [field]: 'x' })).toBe(false)
    })

    it('empresa estrita: só https, CNPJ formatado e celular sugerido só de celular', () => {
      expect(
        offerOk({
          ...available,
          company: { ...company, site: 'http://ficticia.example.test' },
        })
      ).toBe(false)
      expect(
        offerOk({
          ...available,
          company: { ...company, cnpj: '11222333000181' },
        })
      ).toBe(false)
      expect(
        offerOk({
          ...available,
          company: { ...company, cpf: '00000000000' },
        })
      ).toBe(false)
      expect(
        offerOk({ ...available, suggestedMobilePhone: '1133334444' })
      ).toBe(false)
    })
  })

  it('conexão aceita os dois formatos de chave do Asaas', () => {
    // Chaves fictícias só com o formato (nunca uma chave real, nem de exemplo).
    for (const apiKey of [
      '$aact_Q0hBVkVfRklDVElDSUFfREVfVEVTVEU=',
      '$aact_hmlg_000CHAVEFICTICIADETESTE000',
      '$aact_prod_000CHAVEFICTICIADETESTE000',
    ]) {
      expect(ConnectAsaasAccountInputSchema.safeParse({ apiKey }).success).toBe(
        true
      )
    }
    for (const apiKey of [
      'aact_semcifrao0000000000000',
      '$aact_curta',
      '$aact_ com espaço 000000000000',
      'chave-de-outro-provedor-00000000',
      '',
    ]) {
      expect(ConnectAsaasAccountInputSchema.safeParse({ apiKey }).success).toBe(
        false
      )
    }
    expect(
      ConnectAsaasAccountInputSchema.safeParse({
        apiKey: '$aact_prod_000CHAVEFICTICIADETESTE000',
        environment: 'production',
      }).success
    ).toBe(false)
  })

  it('o erro de validação nunca repete a chave', () => {
    const marker = '$aact_MARCADOR_FICTICIO_NAO_VAZAR ' + 'x'.repeat(20)
    const result = ConnectAsaasAccountInputSchema.safeParse({ apiKey: marker })
    expect(result.success).toBe(false)
    const serialized = JSON.stringify(result.error) + String(result.error)
    expect(serialized).not.toContain('MARCADOR_FICTICIO')
  })

  it('link de documentos só no domínio do Asaas', () => {
    expect(
      DocumentsLinkResponseSchema.safeParse({
        url: 'https://www.asaas.com/onboarding/ficticio',
      }).success
    ).toBe(true)
    expect(
      DocumentsLinkResponseSchema.safeParse({
        url: 'https://evil.example/onboarding',
      }).success
    ).toBe(false)
  })

  it('saque: só o valor, sem destino digitado', () => {
    expect(PayoutRequestInputSchema.parse({ amount: '1500.00' })).toEqual({
      amount: '1500.00',
    })
    const parse = (value: unknown) =>
      PayoutRequestInputSchema.safeParse(value).success
    expect(parse({ amount: '0.00' })).toBe(false)
    expect(parse({ amount: 1500 })).toBe(false)
    for (const destination of [
      { bankAccount: '0000-0' },
      { pixAddressKey: 'chave-ficticia' },
      { bankAccountRef: 'ba_000' },
      { walletId: 'w_000' },
    ]) {
      expect(parse({ amount: '10.00', ...destination })).toBe(false)
    }
  })
})
