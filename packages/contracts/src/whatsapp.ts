import { z } from 'zod'
export const WhatsAppTextRequest = z
  .object({
    to: z.string().min(8).max(30),
    message: z.string().trim().min(1).max(4096),
    templateId: z.string().optional(),
    variables: z.record(z.string(), z.string()).optional(),
  })
  .strict()

const objectPayload = z.record(z.string(), z.unknown())
export const WhatsAppEvent = z
  .object({
    entry: z.array(
      z
        .object({
          changes: z.array(
            z
              .object({
                value: z
                  .object({
                    metadata: z.object({ phone_number_id: z.string().min(1) }),
                    messages: z.array(objectPayload).optional(),
                    statuses: z.array(objectPayload).optional(),
                    contacts: z.array(objectPayload).optional(),
                  })
                  .passthrough(),
              })
              .passthrough()
          ),
        })
        .passthrough()
    ),
  })
  .passthrough()
