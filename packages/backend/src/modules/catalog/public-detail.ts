import type { PrismaClient } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { withTenantTransaction } from '../identity/index'

/** Leitura e projeção transplantadas do detalhe público legado. */
export function createPublicEquipmentDetail(prisma: PrismaClient) {
  return async function getPublicEquipment(context: TenantContext, id: string) {
    const { tenantId } = context
    const equipment = await withTenantTransaction(prisma, context, (tx) =>
      tx.equipment.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          name: true,
          description: true,
          pricePerDay: true,
          images: true,
          available: true,
          maxStock: true,
          dailyDiscount: true,
          weeklyDiscount: true,
          biweeklyDiscount: true,
          monthlyDiscount: true,
          popularPeriod: true,
          dailyDirectValue: true,
          weeklyDirectValue: true,
          biweeklyDirectValue: true,
          monthlyDirectValue: true,
          dailyUseDirectValue: true,
          weeklyUseDirectValue: true,
          biweeklyUseDirectValue: true,
          monthlyUseDirectValue: true,
          dailyRentalEnabled: true,
          weeklyRentalEnabled: true,
          biweeklyRentalEnabled: true,
          monthlyRentalEnabled: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              iconColor: true,
              bgColor: true,
              fontColor: true,
              customIcon: true,
            },
          },
        },
      })
    )
    if (!equipment) return null
    const images = equipment.images ?? []
    return {
      id: equipment.id,
      name: equipment.name,
      description: equipment.description,
      pricePerDay: Number(equipment.pricePerDay),
      imageUrl: images[0] ?? null,
      images,
      isAvailable: equipment.available ?? true,
      category: equipment.category,
      dailyDiscount: equipment.dailyDiscount || 0,
      weeklyDiscount: equipment.weeklyDiscount || 0,
      biweeklyDiscount: equipment.biweeklyDiscount || 0,
      monthlyDiscount: equipment.monthlyDiscount || 0,
      popularPeriod: equipment.popularPeriod || 'weekly',
      maxStock: equipment.maxStock ?? 1,
      dailyDirectValue: Number(equipment.dailyDirectValue) || 0,
      weeklyDirectValue: Number(equipment.weeklyDirectValue) || 0,
      biweeklyDirectValue: Number(equipment.biweeklyDirectValue) || 0,
      monthlyDirectValue: Number(equipment.monthlyDirectValue) || 0,
      dailyUseDirectValue: equipment.dailyUseDirectValue || false,
      weeklyUseDirectValue: equipment.weeklyUseDirectValue || false,
      biweeklyUseDirectValue: equipment.biweeklyUseDirectValue || false,
      monthlyUseDirectValue: equipment.monthlyUseDirectValue || false,
      dailyRentalEnabled: equipment.dailyRentalEnabled,
      weeklyRentalEnabled: equipment.weeklyRentalEnabled,
      biweeklyRentalEnabled: equipment.biweeklyRentalEnabled,
      monthlyRentalEnabled: equipment.monthlyRentalEnabled,
      updatedAt: equipment.updatedAt.toISOString(),
    }
  }
}
