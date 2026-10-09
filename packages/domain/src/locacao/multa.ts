import Decimal from 'decimal.js'
import { roundToCents } from './saldo'

export interface RentalLateFeeInput {
  total: number | string | Decimal
  startDate: Date
  endDate: Date
  currentDate?: Date
}

export interface RentalLateFeeResult {
  /** Multa em centavos (2 casas, ROUND_HALF_UP), como o provedor cobra. */
  lateFee: number
  daysOverdue: number
  overdue: boolean
}

export function calculateRentalLateFee(
  input: RentalLateFeeInput
): RentalLateFeeResult {
  const currentDate = input.currentDate ?? new Date()

  if (currentDate.getTime() <= input.endDate.getTime()) {
    return { lateFee: 0, daysOverdue: 0, overdue: false }
  }

  const dayMs = 1000 * 60 * 60 * 24
  const daysOverdue = Math.ceil(
    (currentDate.getTime() - input.endDate.getTime()) / dayMs
  )
  const totalDays = Math.ceil(
    (input.endDate.getTime() - input.startDate.getTime()) / dayMs
  )
  const dailyRate = new Decimal(input.total).div(totalDays || 1)
  // Arredondada na origem: a multa é gravada e cobrada como está (em centavos).
  const lateFee = roundToCents(
    dailyRate.times(daysOverdue).times('0.05')
  ).toNumber()

  return { lateFee, daysOverdue, overdue: true }
}
