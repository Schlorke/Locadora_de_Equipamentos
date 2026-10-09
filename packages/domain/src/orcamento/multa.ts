import Decimal from 'decimal.js'
import { roundToCents } from '../locacao/saldo'

export interface LateFeeConfig {
  dailyRate?: number
  fixedAmount?: number
  maxDays?: number
  minAmount?: number
  maxAmount?: number
}

export interface LateFeeResult {
  /** Multa em centavos (2 casas, ROUND_HALF_UP), como o provedor cobra. */
  fee: Decimal
  daysLate: number
  calculationMethod: 'daily' | 'fixed'
  config: LateFeeConfig
}

export function calculateLateFee(
  originalTotal: number | Decimal,
  endDate: Date,
  currentDate: Date = new Date(),
  config: LateFeeConfig = {}
): LateFeeResult {
  const total = new Decimal(originalTotal)
  const {
    dailyRate = 0.02,
    fixedAmount,
    maxDays,
    minAmount = 0,
    maxAmount,
  } = config

  const daysLate = Math.max(
    0,
    Math.ceil(
      (currentDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  )

  if (daysLate <= 0) {
    return {
      fee: new Decimal(0),
      daysLate: 0,
      calculationMethod: 'daily',
      config,
    }
  }

  let fee: Decimal

  if (fixedAmount !== undefined) {
    fee = new Decimal(fixedAmount)
  } else {
    const daysToCalculate = maxDays ? Math.min(daysLate, maxDays) : daysLate
    fee = total.times(dailyRate).times(daysToCalculate)
  }

  if (minAmount > 0 && fee.lt(minAmount)) {
    fee = new Decimal(minAmount)
  }

  if (maxAmount !== undefined && fee.gt(maxAmount)) {
    fee = new Decimal(maxAmount)
  }

  return {
    // Arredondada na origem: a multa entra no valor final e na cobrança em centavos.
    fee: roundToCents(fee),
    daysLate,
    calculationMethod: fixedAmount !== undefined ? 'fixed' : 'daily',
    config,
  }
}

export const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  dailyRate: 0.02,
  maxDays: 30,
  minAmount: 50,
  maxAmount: 5000,
}
