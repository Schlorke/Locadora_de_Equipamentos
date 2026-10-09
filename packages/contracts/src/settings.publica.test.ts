import { describe, expect, it } from 'vitest'
import {
  BUSINESS_DAYS,
  PUBLIC_SETTINGS_FIELDS,
  PublicBusinessDaySchema,
  PublicBusinessHoursSchema,
  PublicLegalAvailabilitySchema,
  PublicLegalIdentitySchema,
} from './settings'

// Contrato da leitura pública da vitrine (achado 147): horário de funcionamento e identificação legal da própria
// locadora, sem campos privados.
describe('horário público', () => {
  it('aceita dia fechado e dia aberto com HH:MM; recusa hora inválida e chave extra', () => {
    expect(PublicBusinessDaySchema.parse({ closed: true })).toEqual({
      closed: true,
    })
    expect(
      PublicBusinessDaySchema.parse({
        closed: false,
        open: '08:00',
        close: '18:00',
      })
    ).toEqual({ closed: false, open: '08:00', close: '18:00' })
    for (const invalid of [
      { closed: false, open: '8:00', close: '18:00' },
      { closed: false, open: '08:00', close: '24:00' },
      { closed: false, open: '08:00' },
      { closed: true, open: '08:00', close: '18:00' },
      { open: '08:00', close: '18:00' },
    ])
      expect(
        PublicBusinessDaySchema.safeParse(invalid).success,
        JSON.stringify(invalid)
      ).toBe(false)
  })

  it('só os sete dias, de segunda a domingo; dia desconhecido é recusado', () => {
    expect(BUSINESS_DAYS).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ])
    expect(PublicBusinessHoursSchema.safeParse({}).success).toBe(true)
    expect(
      PublicBusinessHoursSchema.safeParse({ holiday: { closed: true } }).success
    ).toBe(false)
  })
})

describe('identificação legal pública', () => {
  it('aceita nome empresarial e CNPJ formatado, numérico ou alfanumérico, e a ausência de cada um', () => {
    for (const cnpj of ['12.345.678/0001-95', '12.ABC.345/01DE-35', null])
      expect(
        PublicLegalIdentitySchema.safeParse({
          legalName: 'Locadora Nova Ltda',
          cnpj,
        }).success,
        String(cnpj)
      ).toBe(true)
    expect(
      PublicLegalIdentitySchema.parse({ legalName: null, cnpj: null })
    ).toEqual({
      legalName: null,
      cnpj: null,
    })
  })

  it('recusa CNPJ sem máscara, CPF, nome vazio e os campos internos da organização', () => {
    for (const invalid of [
      { legalName: null, cnpj: '12345678000195' },
      { legalName: null, cnpj: '123.456.789-09' },
      { legalName: '   ', cnpj: null },
      { legalName: null, cnpj: null, document: '12345678000195' },
      { legalName: null, cnpj: null, documentNormalized: '12345678000195' },
    ])
      expect(
        PublicLegalIdentitySchema.safeParse(invalid).success,
        JSON.stringify(invalid)
      ).toBe(false)
  })
})

describe('disponibilidade dos textos legais (onda 134)', () => {
  it('três booleanos, um por documento; nada além disso', () => {
    expect(
      PublicLegalAvailabilitySchema.parse({
        terms: true,
        privacy: false,
        returnPolicy: true,
      })
    ).toEqual({ terms: true, privacy: false, returnPolicy: true })
    for (const invalido of [
      { terms: true, privacy: false },
      { terms: 'sim', privacy: false, returnPolicy: false },
      { terms: true, privacy: true, returnPolicy: true, cookies: true },
    ])
      expect(
        PublicLegalAvailabilitySchema.safeParse(invalido).success,
        JSON.stringify(invalido)
      ).toBe(false)
  })
})

describe('campos da resposta pública', () => {
  it('são os dez de contato e destaque, o horário, a identificação legal, o conteúdo, a disponibilidade dos textos legais e o SEO; nenhum privado', () => {
    expect(PUBLIC_SETTINGS_FIELDS).toHaveLength(16)
    expect(PUBLIC_SETTINGS_FIELDS).toEqual(
      expect.arrayContaining([
        'businessHours',
        'legalIdentity',
        'siteContent',
        'legalDocuments',
        // Onda 135 (A4): o SEO da própria locadora, aditivo no fim da lista.
        'seoTitle',
        'seoDescription',
      ])
    )
    expect(PUBLIC_SETTINGS_FIELDS.slice(-2)).toEqual([
      'seoTitle',
      'seoDescription',
    ])
    // Os textos legais nunca saem na leitura geral (só a disponibilidade): a rota própria entrega cada um.
    for (const texto of [
      'termsDocument',
      'privacyDocument',
      'returnPolicyDocument',
    ])
      expect(PUBLIC_SETTINGS_FIELDS as readonly string[]).not.toContain(texto)
    for (const privado of [
      'smtpConfig',
      'securityConfig',
      'customJs',
      'customCss',
      'analyticsTrackingId',
      'document',
      'documentNormalized',
      'tenantId',
    ])
      expect(PUBLIC_SETTINGS_FIELDS as readonly string[]).not.toContain(privado)
  })
})
