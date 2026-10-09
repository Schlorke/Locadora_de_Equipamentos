import type { EquipmentQuotePriceBlockVariant } from '../../../features/bloco-preco'
import type {
  ClientRentalDetail as Rental,
  ClientQuoteDetail as Quote,
} from './types'
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const normalizedPeriodLabel = (value: string | null | undefined) => {
  if (!value) return 'Diário'
  const normalized = value.toLowerCase()
  if (normalized === 'weekly' || normalized === 'semanal') return 'Semanal'
  if (normalized === 'biweekly' || normalized === 'quinzenal')
    return 'Quinzenal'
  if (normalized === 'monthly' || normalized === 'mensal') return 'Mensal'
  return 'Diário'
}

export const coerceNumber = (value: unknown, fallback = 0) => {
  const coerced = Number(value)
  return Number.isFinite(coerced) ? coerced : fallback
}

export const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Não definido'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Data inválida'
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Data inválida'
  }
}

export const formatDateShort = (dateString: string | null | undefined) => {
  if (!dateString) return 'Não definido'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Data inválida'
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return 'Data inválida'
  }
}
export function getRentalTotals(rental: Rental) {
  const calculatedTotal = rental.rental_items.reduce((sum, item) => {
    const pricePerDay = coerceNumber(item.priceperday, 0)
    const totalDays = coerceNumber(item.totaldays, 0)
    const quantity = coerceNumber(item.quantity, 0)
    if (pricePerDay > 0 && totalDays > 0 && quantity > 0) {
      return sum + pricePerDay * totalDays * quantity
    }
    return sum + coerceNumber(item.totalprice, 0)
  }, 0)

  const rentalTotal = coerceNumber(rental.total, 0)
  const totalDifference = Math.abs(calculatedTotal - rentalTotal)
  const percentDifference = rentalTotal > 0 ? totalDifference / rentalTotal : 1

  const fallbackTotal =
    rental.rental_items.length > 0 &&
    calculatedTotal > 0 &&
    (percentDifference > 0.1 || calculatedTotal < rentalTotal * 0.5)
      ? calculatedTotal
      : rentalTotal

  const quoteTotalRaw = rental.quote?.finalTotal ?? rental.quote?.total
  const quoteTotal =
    quoteTotalRaw !== undefined && quoteTotalRaw !== null
      ? coerceNumber(quoteTotalRaw, 0)
      : null

  const displayTotal = quoteTotal !== null ? quoteTotal : fallbackTotal
  const lateFeeValue = coerceNumber(rental.lateFee, 0)
  const rentalDeliveryFee = coerceNumber(rental.quote?.deliveryFee, 0)
  const rentalPickupFee = coerceNumber(rental.quote?.pickupFee, 0)
  const rentalShippingFee = rentalDeliveryFee + rentalPickupFee

  return {
    displayTotal,
    lateFeeValue,
    rentalDeliveryFee,
    rentalPickupFee,
    rentalShippingFee,
  }
}

export function getQuoteItemPrice(item: NonNullable<Quote['items']>[number]) {
  const quantity = coerceNumber(item.quantity, 0)
  const days = coerceNumber(item.days, 0)
  const pricePerDay = coerceNumber(item.pricePerDay, 0)
  const finalPrice = coerceNumber(item.total, 0)
  const appliedDiscount = item.appliedDiscount ?? 0
  const hasDiscount = appliedDiscount > 0 && !item.useDirectValue
  const hasDirectValue =
    item.useDirectValue === true && (item.directValue ?? 0) > 0
  const periodLabel = normalizedPeriodLabel(item.appliedPeriod)
  const originalPrice = hasDiscount
    ? appliedDiscount >= 100
      ? finalPrice
      : finalPrice / (1 - appliedDiscount / 100)
    : pricePerDay * days * quantity
  const discountAmount = originalPrice - finalPrice
  const variantEquip: EquipmentQuotePriceBlockVariant = hasDiscount
    ? {
        kind: 'discount' as const,
        periodLabel,
        appliedDiscount,
        discountAmount,
      }
    : hasDirectValue
      ? {
          kind: 'direct' as const,
          directValue: item.directValue ?? 0,
        }
      : { kind: 'simple' as const }
  return {
    quantity,
    days,
    pricePerDay,
    finalPrice,
    originalPrice,
    variant: variantEquip,
  }
}

export function getRentalQuoteItemPrice(
  quoteItem: NonNullable<NonNullable<Rental['quote']>['items']>[number]
) {
  const quantity = coerceNumber(quoteItem.quantity, 0)
  const days = coerceNumber(quoteItem.days, 0)
  const pricePerDay = coerceNumber(quoteItem.pricePerDay, 0)
  const finalPrice = coerceNumber(quoteItem.total, 0)
  const appliedDiscount = coerceNumber(quoteItem.appliedDiscount, 0)
  const hasDiscount = appliedDiscount > 0 && !quoteItem.useDirectValue
  const hasDirectValue =
    quoteItem.useDirectValue === true &&
    coerceNumber(quoteItem.directValue, 0) > 0
  const periodLabel = normalizedPeriodLabel(quoteItem.appliedPeriod || '')
  // Calcular valor original baseado no valor final e desconto
  // Se desconto é 70%, valor final = 30% do original
  // Então: original = final / (1 - desconto/100)
  // Proteção contra divisão por zero quando desconto é 100%
  const originalPrice = hasDiscount
    ? appliedDiscount >= 100
      ? finalPrice
      : finalPrice / (1 - appliedDiscount / 100)
    : pricePerDay * days * quantity
  // Calcular desconto em reais (só usado quando hasDiscount é true)
  const discountAmount = originalPrice - finalPrice

  const itemLabel =
    quantity > 1
      ? `${quoteItem.equipment.name} (${quantity}x)`
      : quoteItem.equipment.name
  const variantRental: EquipmentQuotePriceBlockVariant = hasDiscount
    ? {
        kind: 'discount' as const,
        periodLabel,
        appliedDiscount,
        discountAmount,
      }
    : hasDirectValue
      ? {
          kind: 'direct' as const,
          directValue: quoteItem.directValue ?? 0,
        }
      : { kind: 'simple' as const }
  return {
    quantity,
    days,
    pricePerDay,
    finalPrice,
    originalPrice,
    variant: variantRental,
    itemLabel,
  }
}
