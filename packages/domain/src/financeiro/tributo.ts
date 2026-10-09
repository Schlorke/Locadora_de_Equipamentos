import Decimal from 'decimal.js'

export type TaxRegime = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
export type OperationType = 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE'
export type TaxDocumentType = 'CPF' | 'CNPJ' | 'CNI'

export type TaxSettings = {
  taxRegime: TaxRegime
  issRate: Decimal
  issExemptRental: boolean

  // Retenção por tipo de documento (legado, mantido)
  cpfRate: Decimal
  cnpjRate: Decimal
  cniRate: Decimal

  // Lucro Presumido
  irpjPresumidoRate: Decimal | null
  csllPresumidoRate: Decimal | null
  pisCofinsRate: Decimal | null

  // Simples Nacional
  simplesAliquota: Decimal | null

  // Reforma Tributária
  ibsCbsRate: Decimal | null
  ibsCbsActive: boolean
}

export type TaxCalculationInput = {
  grossAmount: Decimal
  operationType: OperationType
  rentalAmount: Decimal
  serviceAmount: Decimal
  taxDocumentType: TaxDocumentType
  settings: TaxSettings
}

export type TaxBreakdownLine = {
  label: string
  baseAmount: string // Serialised Decimal for JSON safety
  rate: string
  amount: string
  exempt: boolean
}

export type TaxBreakdown = {
  grossAmount: Decimal
  netAmount: Decimal
  effectiveTaxRate: Decimal

  operationType: OperationType
  rentalAmount: Decimal
  serviceAmount: Decimal

  issAmount: Decimal
  irpjAmount: Decimal
  csllAmount: Decimal
  pisCofinsAmount: Decimal
  simplesAmount: Decimal
  retentionAmount: Decimal

  taxRegime: TaxRegime
  summary: TaxBreakdownLine[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function line(
  label: string,
  baseAmount: Decimal,
  rate: Decimal,
  amount: Decimal,
  exempt: boolean
): TaxBreakdownLine {
  return {
    label,
    baseAmount: baseAmount.toFixed(2),
    rate: rate.toFixed(4),
    amount: amount.toFixed(2),
    exempt,
  }
}

// ---------------------------------------------------------------------------
// Core: getRetentionRate
// ---------------------------------------------------------------------------

export function getRetentionRate(
  docType: TaxDocumentType,
  settings: TaxSettings
): Decimal {
  switch (docType) {
    case 'CNPJ':
      return settings.cnpjRate
    case 'CNI':
      return settings.cniRate
    case 'CPF':
      return settings.cpfRate
    default: {
      const unexpected: never = docType
      void unexpected
      return settings.cpfRate
    }
  }
}

// ---------------------------------------------------------------------------
// Core: calculateTaxBreakdown
// ---------------------------------------------------------------------------

export function calculateTaxBreakdown(
  input: TaxCalculationInput
): TaxBreakdown {
  const { grossAmount, operationType, rentalAmount, serviceAmount, settings } =
    input

  const summary: TaxBreakdownLine[] = []

  // --- ISS ---
  let issAmount = new Decimal(0)
  if (
    operationType === 'RENTAL_WITH_SERVICE' &&
    serviceAmount.gt(0) &&
    !settings.ibsCbsActive
  ) {
    issAmount = serviceAmount.mul(settings.issRate).div(100).toDecimalPlaces(2)
    summary.push(
      line(
        `ISS (${settings.issRate.toFixed(1)}% sobre serviços)`,
        serviceAmount,
        settings.issRate,
        issAmount,
        false
      )
    )
  } else {
    summary.push(
      line(
        'ISS (Isento - Súmula Vinculante 31)',
        rentalAmount,
        new Decimal(0),
        new Decimal(0),
        true
      )
    )
  }

  // --- ICMS (always exempt for rental) ---
  summary.push(
    line(
      'ICMS (Isento - Não há circulação de mercadoria)',
      grossAmount,
      new Decimal(0),
      new Decimal(0),
      true
    )
  )

  // --- Regime-specific taxes ---
  let irpjAmount = new Decimal(0)
  let csllAmount = new Decimal(0)
  let pisCofinsAmount = new Decimal(0)
  let simplesAmount = new Decimal(0)

  if (
    settings.ibsCbsActive &&
    settings.ibsCbsRate &&
    settings.ibsCbsRate.gt(0)
  ) {
    // Reforma Tributária: IBS+CBS substitui ISS, PIS, COFINS
    const ibsCbs = grossAmount
      .mul(settings.ibsCbsRate)
      .div(100)
      .toDecimalPlaces(2)
    pisCofinsAmount = ibsCbs // Stored as PIS/COFINS replacement
    summary.push(
      line(
        `IBS+CBS (${settings.ibsCbsRate.toFixed(1)}%)`,
        grossAmount,
        settings.ibsCbsRate,
        ibsCbs,
        false
      )
    )
  } else {
    switch (settings.taxRegime) {
      case 'SIMPLES_NACIONAL': {
        const aliquota = settings.simplesAliquota ?? new Decimal(0)
        if (aliquota.gt(0)) {
          // Simples — ISS portion excluded for exempt rental
          const simplesBase =
            settings.issExemptRental && operationType === 'PURE_RENTAL'
              ? rentalAmount
              : grossAmount
          simplesAmount = simplesBase.mul(aliquota).div(100).toDecimalPlaces(2)
          summary.push(
            line(
              `Simples Nacional - Anexo III (${aliquota.toFixed(2)}%)`,
              simplesBase,
              aliquota,
              simplesAmount,
              false
            )
          )
        }
        break
      }

      case 'LUCRO_PRESUMIDO': {
        const irpjRate = settings.irpjPresumidoRate ?? new Decimal(4.8)
        const csllRate = settings.csllPresumidoRate ?? new Decimal(2.88)
        const pcRate = settings.pisCofinsRate ?? new Decimal(3.65)

        irpjAmount = grossAmount.mul(irpjRate).div(100).toDecimalPlaces(2)
        csllAmount = grossAmount.mul(csllRate).div(100).toDecimalPlaces(2)
        pisCofinsAmount = grossAmount.mul(pcRate).div(100).toDecimalPlaces(2)

        summary.push(
          line(
            `IRPJ (${irpjRate.toFixed(2)}% presumido)`,
            grossAmount,
            irpjRate,
            irpjAmount,
            false
          ),
          line(
            `CSLL (${csllRate.toFixed(2)}% presumido)`,
            grossAmount,
            csllRate,
            csllAmount,
            false
          ),
          line(
            `PIS/COFINS (${pcRate.toFixed(2)}%)`,
            grossAmount,
            pcRate,
            pisCofinsAmount,
            false
          )
        )
        break
      }

      case 'LUCRO_REAL': {
        const pcRate = settings.pisCofinsRate ?? new Decimal(9.25)
        pisCofinsAmount = grossAmount.mul(pcRate).div(100).toDecimalPlaces(2)

        summary.push(
          line(
            `PIS/COFINS não-cumulativo (${pcRate.toFixed(2)}% - sujeito a créditos)`,
            grossAmount,
            pcRate,
            pisCofinsAmount,
            false
          ),
          line(
            'IRPJ/CSLL (apurado sobre lucro real)',
            new Decimal(0),
            new Decimal(0),
            new Decimal(0),
            true
          )
        )
        break
      }
      default: {
        const unexpected: never = settings.taxRegime
        void unexpected
        break
      }
    }
  }

  // --- Retenção na fonte (por documento) ---
  const retentionRate = getRetentionRate(input.taxDocumentType, settings)
  const retentionAmount = grossAmount
    .mul(retentionRate)
    .div(100)
    .toDecimalPlaces(2)

  if (retentionAmount.gt(0)) {
    summary.push(
      line(
        `Retenção ${input.taxDocumentType} (${retentionRate.toFixed(1)}%)`,
        grossAmount,
        retentionRate,
        retentionAmount,
        false
      )
    )
  }

  // Net = gross - retention (o que chega na conta da empresa)
  const netAmount = grossAmount.minus(retentionAmount).toDecimalPlaces(2)

  const effectiveTaxRate = grossAmount.gt(0)
    ? retentionAmount.div(grossAmount).mul(100).toDecimalPlaces(4)
    : new Decimal(0)

  return {
    grossAmount,
    netAmount,
    effectiveTaxRate,
    operationType,
    rentalAmount,
    serviceAmount,
    issAmount,
    irpjAmount,
    csllAmount,
    pisCofinsAmount,
    simplesAmount,
    retentionAmount,
    taxRegime: settings.taxRegime,
    summary,
  }
}

export function calculateNetAmountWithBreakdown(
  grossAmount: number,
  taxDocumentType: TaxDocumentType,
  settings: TaxSettings,
  operationType: OperationType = 'PURE_RENTAL',
  serviceAmountNum: number = 0
): TaxBreakdown {
  const gross = new Decimal(grossAmount)
  const service = new Decimal(serviceAmountNum)
  const rental = gross.minus(service).clampedTo(0, gross)

  return calculateTaxBreakdown({
    grossAmount: gross,
    operationType,
    rentalAmount: rental,
    serviceAmount: service,
    taxDocumentType,
    settings,
  })
}
