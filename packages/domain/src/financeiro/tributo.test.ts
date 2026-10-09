import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'

import {
  calculateTaxBreakdown,
  getRetentionRate,
  type TaxSettings,
} from './tributo'

// ---------------------------------------------------------------------------
// Default settings factory
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<TaxSettings> = {}): TaxSettings {
  return {
    taxRegime: 'SIMPLES_NACIONAL',
    issRate: new Decimal(2.5),
    issExemptRental: true,
    cpfRate: new Decimal(6),
    cnpjRate: new Decimal(2.5),
    cniRate: new Decimal(6),
    irpjPresumidoRate: new Decimal(4.8),
    csllPresumidoRate: new Decimal(2.88),
    pisCofinsRate: new Decimal(3.65),
    simplesAliquota: new Decimal(10),
    ibsCbsRate: null,
    ibsCbsActive: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getRetentionRate
// ---------------------------------------------------------------------------

describe('getRetentionRate', () => {
  const settings = makeSettings()

  it('returns CPF rate', () => {
    expect(getRetentionRate('CPF', settings).toNumber()).toBe(6)
  })

  it('returns CNPJ rate', () => {
    expect(getRetentionRate('CNPJ', settings).toNumber()).toBe(2.5)
  })

  it('returns CNI rate', () => {
    expect(getRetentionRate('CNI', settings).toNumber()).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Pure rental — ISS exempt
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — pure rental', () => {
  it('ISS is zero for pure rental', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings(),
    })

    expect(result.issAmount.toNumber()).toBe(0)
    const issLine = result.summary.find((l) => l.label.includes('ISS'))
    expect(issLine?.exempt).toBe(true)
  })

  it('ICMS is always zero', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings(),
    })

    const icmsLine = result.summary.find((l) => l.label.includes('ICMS'))
    expect(icmsLine?.exempt).toBe(true)
    expect(icmsLine?.amount).toBe('0.00')
  })

  it('net = gross - retention (CPF 6%)', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings(),
    })

    expect(result.retentionAmount.toNumber()).toBe(60)
    expect(result.netAmount.toNumber()).toBe(940)
    expect(result.effectiveTaxRate.toNumber()).toBe(6)
  })

  it('net = gross - retention (CNPJ 2.5%)', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(2000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(2000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CNPJ',
      settings: makeSettings(),
    })

    expect(result.retentionAmount.toNumber()).toBe(50)
    expect(result.netAmount.toNumber()).toBe(1950)
  })
})

// ---------------------------------------------------------------------------
// Mixed operation — ISS on service portion only
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — rental with service', () => {
  it('ISS applies only on service portion', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'RENTAL_WITH_SERVICE',
      rentalAmount: new Decimal(800),
      serviceAmount: new Decimal(200),
      taxDocumentType: 'CNPJ',
      settings: makeSettings(),
    })

    // ISS = 200 × 2.5% = 5.00
    expect(result.issAmount.toNumber()).toBe(5)

    const issLine = result.summary.find((l) => l.label.includes('ISS'))
    expect(issLine?.exempt).toBe(false)
    expect(issLine?.amount).toBe('5.00')
    expect(issLine?.baseAmount).toBe('200.00')
  })

  it('ISS is zero when service amount is zero', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'RENTAL_WITH_SERVICE',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings(),
    })

    expect(result.issAmount.toNumber()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Simples Nacional
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — Simples Nacional', () => {
  it('calculates DAS on rental amount for pure rental', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings({ simplesAliquota: new Decimal(10) }),
    })

    // DAS = 1000 × 10% = 100
    expect(result.simplesAmount.toNumber()).toBe(100)
  })

  it('skips Simples when aliquota is null', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings({ simplesAliquota: null }),
    })

    expect(result.simplesAmount.toNumber()).toBe(0)
  })

  it('uses gross for mixed operation base', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'RENTAL_WITH_SERVICE',
      rentalAmount: new Decimal(800),
      serviceAmount: new Decimal(200),
      taxDocumentType: 'CPF',
      settings: makeSettings({ simplesAliquota: new Decimal(10) }),
    })

    // Mixed: ISS exempt flag + RENTAL_WITH_SERVICE → uses grossAmount
    expect(result.simplesAmount.toNumber()).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Lucro Presumido
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — Lucro Presumido', () => {
  const presumidoSettings = makeSettings({ taxRegime: 'LUCRO_PRESUMIDO' })

  it('calculates IRPJ + CSLL + PIS/COFINS', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(10000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(10000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CNPJ',
      settings: presumidoSettings,
    })

    // IRPJ = 10000 × 4.8% = 480
    expect(result.irpjAmount.toNumber()).toBe(480)
    // CSLL = 10000 × 2.88% = 288
    expect(result.csllAmount.toNumber()).toBe(288)
    // PIS/COFINS = 10000 × 3.65% = 365
    expect(result.pisCofinsAmount.toNumber()).toBe(365)
    // Simples not used
    expect(result.simplesAmount.toNumber()).toBe(0)
  })

  it('uses defaults when rates are null', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(10000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(10000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings({
        taxRegime: 'LUCRO_PRESUMIDO',
        irpjPresumidoRate: null,
        csllPresumidoRate: null,
        pisCofinsRate: null,
      }),
    })

    // Falls back to defaults: 4.8%, 2.88%, 3.65%
    expect(result.irpjAmount.toNumber()).toBe(480)
    expect(result.csllAmount.toNumber()).toBe(288)
    expect(result.pisCofinsAmount.toNumber()).toBe(365)
  })
})

// ---------------------------------------------------------------------------
// Lucro Real
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — Lucro Real', () => {
  it('calculates PIS/COFINS non-cumulative with default 9.25%', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(10000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(10000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CNPJ',
      settings: makeSettings({ taxRegime: 'LUCRO_REAL', pisCofinsRate: null }),
    })

    // PIS/COFINS default 9.25% for Lucro Real when pisCofinsRate is null
    expect(result.pisCofinsAmount.toNumber()).toBe(925)
    // IRPJ/CSLL are informational (zero — based on actual profit)
    expect(result.irpjAmount.toNumber()).toBe(0)
    expect(result.csllAmount.toNumber()).toBe(0)
  })

  it('uses custom PIS/COFINS rate', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(10000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(10000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings({
        taxRegime: 'LUCRO_REAL',
        pisCofinsRate: new Decimal(7.6),
      }),
    })

    expect(result.pisCofinsAmount.toNumber()).toBe(760)
  })
})

// ---------------------------------------------------------------------------
// Reforma Tributária (IBS+CBS)
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — Reforma Tributária', () => {
  it('uses IBS+CBS when active, overriding regime', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings({
        ibsCbsActive: true,
        ibsCbsRate: new Decimal(26.5),
      }),
    })

    // IBS+CBS = 1000 × 26.5% = 265
    expect(result.pisCofinsAmount.toNumber()).toBe(265)
    // ISS should be exempt (IBS replaces ISS)
    expect(result.issAmount.toNumber()).toBe(0)
    // No Simples
    expect(result.simplesAmount.toNumber()).toBe(0)
  })

  it('ISS exempt even for mixed operation when IBS/CBS active', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'RENTAL_WITH_SERVICE',
      rentalAmount: new Decimal(800),
      serviceAmount: new Decimal(200),
      taxDocumentType: 'CPF',
      settings: makeSettings({
        ibsCbsActive: true,
        ibsCbsRate: new Decimal(26.5),
      }),
    })

    // IBS+CBS replaces ISS, so ISS = 0
    expect(result.issAmount.toNumber()).toBe(0)
    // IBS+CBS on full gross
    expect(result.pisCofinsAmount.toNumber()).toBe(265)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('calculateTaxBreakdown — edge cases', () => {
  it('handles zero gross amount', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(0),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(0),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings(),
    })

    expect(result.netAmount.toNumber()).toBe(0)
    expect(result.retentionAmount.toNumber()).toBe(0)
    expect(result.effectiveTaxRate.toNumber()).toBe(0)
  })

  it('preserves Decimal precision for large amounts', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal('99999.99'),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal('99999.99'),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings(),
    })

    // 99999.99 × 6% = 5999.9994 → rounds to 6000.00
    expect(result.retentionAmount.toNumber()).toBe(6000)
    expect(result.netAmount.toNumber()).toBe(93999.99)
  })

  it('summary lines have correct format', () => {
    const result = calculateTaxBreakdown({
      grossAmount: new Decimal(1000),
      operationType: 'PURE_RENTAL',
      rentalAmount: new Decimal(1000),
      serviceAmount: new Decimal(0),
      taxDocumentType: 'CPF',
      settings: makeSettings({ simplesAliquota: new Decimal(10) }),
    })

    // At minimum: ISS, ICMS, Simples, Retenção
    expect(result.summary.length).toBeGreaterThanOrEqual(4)

    for (const line of result.summary) {
      expect(typeof line.label).toBe('string')
      expect(typeof line.baseAmount).toBe('string')
      expect(typeof line.rate).toBe('string')
      expect(typeof line.amount).toBe('string')
      expect(typeof line.exempt).toBe('boolean')
    }
  })
})
