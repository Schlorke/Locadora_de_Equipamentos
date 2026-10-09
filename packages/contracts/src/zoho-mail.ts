import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reusable refinements
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Validates a comma-separated list of email addresses.
 * Trims each address and rejects invalid formats.
 */
const emailListSchema = z
  .string()
  .trim()
  .min(1, 'Pelo menos um endereço de e-mail é obrigatório')
  .refine(
    (val) => {
      const emails = val
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      if (emails.length === 0) return false
      return emails.every((email) => EMAIL_REGEX.test(email))
    },
    { message: 'Um ou mais endereços de e-mail são inválidos' }
  )

/**
 * Optional comma-separated email list.
 * Returns undefined when empty/missing.
 */
const optionalEmailListSchema = z
  .string()
  .trim()
  .transform((val) => (val.length > 0 ? val : undefined))
  .pipe(
    z
      .string()
      .refine(
        (val) => {
          const emails = val
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
          return (
            emails.length > 0 &&
            emails.every((email) => EMAIL_REGEX.test(email))
          )
        },
        { message: 'Um ou mais endereços de e-mail são inválidos' }
      )
      .optional()
  )

const mailFormatSchema = z.enum(['html', 'plaintext']).default('html')

const attachmentSchema = z.object({
  storeName: z.string().min(1),
  attachmentName: z.string().min(1),
  attachmentPath: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Route-level schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /api/admin/zoho-mail/messages/send
 */
export const SendEmailSchema = z.object({
  fromAddress: emailListSchema,
  toAddress: emailListSchema,
  subject: z.string().trim(),
  content: z.string(),
  ccAddress: optionalEmailListSchema,
  bccAddress: optionalEmailListSchema,
  mailFormat: mailFormatSchema,
  attachments: z.array(attachmentSchema).optional(),
})

/**
 * Schema for POST /api/admin/zoho-mail/messages/:messageId/reply
 */

/**
 * Schema for POST /api/admin/zoho-mail/messages/drafts
 * More lenient — most fields are optional since drafts can be partial.
 */
export const SaveDraftSchema = z.object({
  draftFolderId: z.string().trim().min(1, 'draftFolderId é obrigatório'),
  draftMessageId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  fromAddress: emailListSchema,
  toAddress: optionalEmailListSchema,
  ccAddress: optionalEmailListSchema,
  bccAddress: optionalEmailListSchema,
  subject: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined)),
  content: z.string().optional().default(''),
  mailFormat: mailFormatSchema,
  attachments: z.array(attachmentSchema).optional(),
})

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type SendEmailInput = z.infer<typeof SendEmailSchema>

export type SaveDraftInput = z.infer<typeof SaveDraftSchema>
