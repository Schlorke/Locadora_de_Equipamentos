import { UpdateDeliverySchema } from '@gb-locacoes/contracts/operations'
import type { DeliveryPatch } from '@gb-locacoes/contracts/operations'

export const deliveryCompletion = UpdateDeliverySchema.pick({
  status: true,
  completedAt: true,
  photos: true,
  checklist: true,
  notes: true,
})
  .strict()
  .refine((body) => body.status === 'COMPLETED')

/** Apply the same exception after the HTTP schema has decoded completedAt. */
export function isDeliveryCompletion(data: DeliveryPatch) {
  return deliveryCompletion.safeParse({
    ...data,
    ...(data.completedAt === undefined
      ? {}
      : {
          completedAt: Number.isNaN(data.completedAt.getTime())
            ? ''
            : data.completedAt.toISOString(),
        }),
  }).success
}
