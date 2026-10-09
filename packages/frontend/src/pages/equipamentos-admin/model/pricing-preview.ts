export function standardPeriodPrice(
  pricePerDay: number,
  option: {
    useDirectValue?: boolean
    directValue?: number
    multiplier: number
    discount: number
  }
) {
  if (
    option.useDirectValue &&
    option.directValue !== undefined &&
    option.directValue !== null
  )
    return option.directValue
  const basePrice = pricePerDay * option.multiplier
  return basePrice - basePrice * (option.discount / 100)
}
