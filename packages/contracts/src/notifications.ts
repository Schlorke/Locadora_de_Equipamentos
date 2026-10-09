import { z } from 'zod'

const notificationListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  type: z
    .enum([
      'QUOTE',
      'ORDER',
      'PAYMENT',
      'EQUIPMENT',
      'SYSTEM',
      'RENTAL',
      'DELIVERY',
      'CONTRACT',
    ])
    .optional(),
  isRead: z.enum(['true', 'false']).optional(),
})

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>

/** Preserve the legacy first-value/parseInt query contract, including empty defaults. */
export function parseNotificationListQuery(raw: {
  page: string | null
  limit: string | null
  type: string | null
  isRead: string | null
}) {
  return notificationListQuerySchema.safeParse({
    page: raw.page ? parseInt(raw.page, 10) : undefined,
    limit: raw.limit ? parseInt(raw.limit, 10) : undefined,
    type: raw.type || undefined,
    isRead: raw.isRead || undefined,
  })
}
