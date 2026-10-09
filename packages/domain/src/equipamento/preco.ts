import Decimal from 'decimal.js'
import { roundToCents } from '../locacao/saldo'

export type PricingFields = {
  pricePerDay: number
  dailyDiscount?: number
  weeklyDiscount?: number
  biweeklyDiscount?: number
  monthlyDiscount?: number
  dailyDirectValue?: number
  weeklyDirectValue?: number
  biweeklyDirectValue?: number
  monthlyDirectValue?: number
  dailyUseDirectValue?: boolean
  weeklyUseDirectValue?: boolean
  biweeklyUseDirectValue?: boolean
  monthlyUseDirectValue?: boolean
}

const PERIOD_CONFIGS = [
  { key: 'monthly', threshold: 30, multiplier: 30 },
  { key: 'biweekly', threshold: 15, multiplier: 15 },
  { key: 'weekly', threshold: 7, multiplier: 7 },
  { key: 'daily', threshold: 1, multiplier: 1 },
] as const

type PeriodKey = (typeof PERIOD_CONFIGS)[number]['key']

export type EnabledPeriods = {
  daily?: boolean
  weekly?: boolean
  biweekly?: boolean
  monthly?: boolean
}

export type PricingConfig = {
  period: PeriodKey
  threshold: number
  multiplier: number
  discount: number
  directValue: number
  useDirectValue: boolean
}

const coerceNumber = (value: unknown, fallback = 0) => {
  const coerced = Number(value)
  return Number.isFinite(coerced) ? coerced : fallback
}

const coerceBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

export const sanitizeCartItemPricing = <T extends PricingFields>(
  item: T
): T => {
  return {
    ...item,
    pricePerDay: coerceNumber((item as PricingFields).pricePerDay, 0),
    dailyDiscount: coerceNumber((item as PricingFields).dailyDiscount, 0),
    weeklyDiscount: coerceNumber((item as PricingFields).weeklyDiscount, 0),
    biweeklyDiscount: coerceNumber((item as PricingFields).biweeklyDiscount, 0),
    monthlyDiscount: coerceNumber((item as PricingFields).monthlyDiscount, 0),
    dailyDirectValue: coerceNumber((item as PricingFields).dailyDirectValue, 0),
    weeklyDirectValue: coerceNumber(
      (item as PricingFields).weeklyDirectValue,
      0
    ),
    biweeklyDirectValue: coerceNumber(
      (item as PricingFields).biweeklyDirectValue,
      0
    ),
    monthlyDirectValue: coerceNumber(
      (item as PricingFields).monthlyDirectValue,
      0
    ),
    dailyUseDirectValue: coerceBool(
      (item as PricingFields).dailyUseDirectValue,
      false
    ),
    weeklyUseDirectValue: coerceBool(
      (item as PricingFields).weeklyUseDirectValue,
      false
    ),
    biweeklyUseDirectValue: coerceBool(
      (item as PricingFields).biweeklyUseDirectValue,
      false
    ),
    monthlyUseDirectValue: coerceBool(
      (item as PricingFields).monthlyUseDirectValue,
      false
    ),
  }
}

export const getPricingConfig = (
  equipment: PricingFields,
  totalDays: number,
  enabledPeriods?: EnabledPeriods
): PricingConfig => {
  const sanitized = sanitizeCartItemPricing(equipment)

  const configs =
    enabledPeriods &&
    (enabledPeriods.daily === false ||
      enabledPeriods.weekly === false ||
      enabledPeriods.biweekly === false ||
      enabledPeriods.monthly === false)
      ? PERIOD_CONFIGS.filter((config) => {
          const enabled = enabledPeriods[config.key as keyof EnabledPeriods]
          return enabled !== false
        })
      : PERIOD_CONFIGS

  const selected =
    configs.find((config) => totalDays >= config.threshold) ??
    configs[configs.length - 1]!

  const directValue =
    selected.key === 'monthly'
      ? sanitized.monthlyDirectValue
      : selected.key === 'biweekly'
        ? sanitized.biweeklyDirectValue
        : selected.key === 'weekly'
          ? sanitized.weeklyDirectValue
          : sanitized.dailyDirectValue

  const useDirectValue =
    selected.key === 'monthly'
      ? sanitized.monthlyUseDirectValue
      : selected.key === 'biweekly'
        ? sanitized.biweeklyUseDirectValue
        : selected.key === 'weekly'
          ? sanitized.weeklyUseDirectValue
          : sanitized.dailyUseDirectValue

  const discount =
    selected.key === 'monthly'
      ? sanitized.monthlyDiscount
      : selected.key === 'biweekly'
        ? sanitized.biweeklyDiscount
        : selected.key === 'weekly'
          ? sanitized.weeklyDiscount
          : sanitized.dailyDiscount

  return {
    period: selected.key,
    threshold: selected.threshold,
    multiplier: selected.multiplier,
    discount: useDirectValue ? 0 : (discount ?? 0),
    directValue: directValue ?? 0,
    useDirectValue: useDirectValue ?? false,
  }
}

/** Dinheiro como vem do banco (Decimal do Prisma), de JSON (texto) ou da tela (número). */
export type PricingMoney = number | string | { toString(): string }

/**
 * Campos de preço com o dinheiro na forma exata em que chegam: `Decimal` do Prisma ou texto no
 * orçamento, número no carrinho da tela. `PricingFields` é um caso particular.
 */
export type PricingValues = {
  pricePerDay: PricingMoney
  dailyDiscount?: number | null
  weeklyDiscount?: number | null
  biweeklyDiscount?: number | null
  monthlyDiscount?: number | null
  dailyDirectValue?: PricingMoney | null
  weeklyDirectValue?: PricingMoney | null
  biweeklyDirectValue?: PricingMoney | null
  monthlyDirectValue?: PricingMoney | null
  dailyUseDirectValue?: boolean | null
  weeklyUseDirectValue?: boolean | null
  biweeklyUseDirectValue?: boolean | null
  monthlyUseDirectValue?: boolean | null
}

/**
 * Valor como Decimal a partir do texto (Decimal do Prisma, string ou número), nunca por
 * aritmética de float; ausente ou não numérico vale 0, como na sanitização do preço.
 */
function decimalOf(value: PricingMoney | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0)
  const text = String(value).trim()
  const numeric = Number(text)
  if (!text || !Number.isFinite(numeric)) return new Decimal(0)
  try {
    return new Decimal(text)
  } catch {
    return new Decimal(numeric)
  }
}

/** Campos numéricos só para escolher o período e o desconto; o valor sai do texto exato. */
function pricingFieldsOf(equipment: PricingValues): PricingFields {
  const direct = (value: PricingMoney | null | undefined) => (value ? Number(value) : 0)
  return sanitizeCartItemPricing({
    pricePerDay: Number(equipment.pricePerDay),
    dailyDiscount: equipment.dailyDiscount ?? 0,
    weeklyDiscount: equipment.weeklyDiscount ?? 0,
    biweeklyDiscount: equipment.biweeklyDiscount ?? 0,
    monthlyDiscount: equipment.monthlyDiscount ?? 0,
    dailyDirectValue: direct(equipment.dailyDirectValue),
    weeklyDirectValue: direct(equipment.weeklyDirectValue),
    biweeklyDirectValue: direct(equipment.biweeklyDirectValue),
    monthlyDirectValue: direct(equipment.monthlyDirectValue),
    dailyUseDirectValue: equipment.dailyUseDirectValue ?? false,
    weeklyUseDirectValue: equipment.weeklyUseDirectValue ?? false,
    biweeklyUseDirectValue: equipment.biweeklyUseDirectValue ?? false,
    monthlyUseDirectValue: equipment.monthlyUseDirectValue ?? false,
  })
}

/**
 * Preço EXATO (Decimal, sem arredondar) de uma unidade por `totalDays`: a regra única do motor de
 * preço, usada pela tela (`calculateIntelligentPrice`) e pelo orçamento (`buildQuotePricing`).
 * Valor direto = períodos completos mais os dias restantes a `valor / período`, o que dá
 * `valor · dias / período` numa divisão só; senão diária · dias menos o desconto percentual do
 * período. Dias não finitos ou negativos valem 0.
 */
export function exactIntelligentPrice(
  equipment: PricingValues,
  totalDays: number,
  enabledPeriods?: EnabledPeriods
): { pricingConfig: PricingConfig; price: Decimal } {
  const pricingConfig = getPricingConfig(pricingFieldsOf(equipment), totalDays, enabledPeriods)
  const days = Number.isFinite(totalDays) ? Math.max(0, totalDays) : 0

  if (pricingConfig.useDirectValue) {
    const direct = decimalOf(
      {
        daily: equipment.dailyDirectValue,
        weekly: equipment.weeklyDirectValue,
        biweekly: equipment.biweeklyDirectValue,
        monthly: equipment.monthlyDirectValue,
      }[pricingConfig.period]
    )
    const price =
      direct.isZero() || days === 0
        ? new Decimal(0)
        : direct.times(days).div(Math.max(1, pricingConfig.multiplier))
    return { pricingConfig, price }
  }

  const base = decimalOf(equipment.pricePerDay).times(days)
  return {
    pricingConfig,
    price: base.minus(base.times(decimalOf(pricingConfig.discount)).div(100)),
  }
}

/**
 * Preço de uma unidade por `totalDays` em centavos (ROUND_HALF_UP sobre o Decimal exato): o valor
 * que o orçamento grava e o provedor cobra para quantidade 1. Para o total de um item com
 * quantidade use `buildQuotePricing(...).total`, que arredonda `preço · quantidade` uma vez só.
 */
export const calculateIntelligentPrice = (
  equipment: PricingFields,
  totalDays: number,
  enabledPeriods?: EnabledPeriods
): number =>
  roundToCents(exactIntelligentPrice(equipment, totalDays, enabledPeriods).price).toNumber()
