export interface PublicEquipmentCategory {
  id: string
  name: string
  slug: string | null
  icon: string | null
  iconColor: string | null
  bgColor: string | null
  fontColor: string | null
  customIcon: unknown
}

export interface PublicEquipment {
  id: string
  name: string
  description: string | null
  pricePerDay: number
  images: string[]
  isAvailable: boolean
  category: PublicEquipmentCategory
  dailyDiscount: number
  weeklyDiscount: number
  biweeklyDiscount: number
  monthlyDiscount: number
  popularPeriod: string
  maxStock: number
  dailyDirectValue: number
  weeklyDirectValue: number
  biweeklyDirectValue: number
  monthlyDirectValue: number
  dailyUseDirectValue: boolean
  weeklyUseDirectValue: boolean
  biweeklyUseDirectValue: boolean
  monthlyUseDirectValue: boolean
  dailyRentalEnabled: boolean
  weeklyRentalEnabled: boolean
  biweeklyRentalEnabled: boolean
  monthlyRentalEnabled: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null
const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const booleanOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

export function parsePublicEquipment(body: unknown): PublicEquipment | null {
  if (!isRecord(body) || !isRecord(body.category)) return null
  const id = text(body.id),
    name = text(body.name),
    categoryId = text(body.category.id),
    categoryName = text(body.category.name)
  if (
    id === null ||
    name === null ||
    categoryId === null ||
    categoryName === null
  )
    return null
  if (
    typeof body.pricePerDay !== 'number' ||
    !Number.isFinite(body.pricePerDay)
  )
    return null
  const images = Array.isArray(body.images)
    ? body.images.filter((image): image is string => typeof image === 'string')
    : []
  const category = body.category
  return {
    id,
    name,
    description: text(body.description),
    pricePerDay: body.pricePerDay,
    images,
    isAvailable: booleanOr(body.isAvailable, true),
    category: {
      id: categoryId,
      name: categoryName,
      slug: text(category.slug),
      icon: text(category.icon),
      iconColor: text(category.iconColor),
      bgColor: text(category.bgColor),
      fontColor: text(category.fontColor),
      customIcon: category.customIcon ?? null,
    },
    dailyDiscount: numberOr(body.dailyDiscount, 0),
    weeklyDiscount: numberOr(body.weeklyDiscount, 0),
    biweeklyDiscount: numberOr(body.biweeklyDiscount, 0),
    monthlyDiscount: numberOr(body.monthlyDiscount, 0),
    popularPeriod: text(body.popularPeriod) ?? 'weekly',
    maxStock: numberOr(body.maxStock, 1),
    dailyDirectValue: numberOr(body.dailyDirectValue, 0),
    weeklyDirectValue: numberOr(body.weeklyDirectValue, 0),
    biweeklyDirectValue: numberOr(body.biweeklyDirectValue, 0),
    monthlyDirectValue: numberOr(body.monthlyDirectValue, 0),
    dailyUseDirectValue: booleanOr(body.dailyUseDirectValue, false),
    weeklyUseDirectValue: booleanOr(body.weeklyUseDirectValue, false),
    biweeklyUseDirectValue: booleanOr(body.biweeklyUseDirectValue, false),
    monthlyUseDirectValue: booleanOr(body.monthlyUseDirectValue, false),
    dailyRentalEnabled: booleanOr(body.dailyRentalEnabled, true),
    weeklyRentalEnabled: booleanOr(body.weeklyRentalEnabled, true),
    biweeklyRentalEnabled: booleanOr(body.biweeklyRentalEnabled, true),
    monthlyRentalEnabled: booleanOr(body.monthlyRentalEnabled, true),
  }
}
