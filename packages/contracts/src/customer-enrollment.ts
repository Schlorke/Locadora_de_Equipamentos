import { z } from 'zod'

/** Existing explicit-consent input; tenant and role come from the validated host. */
export const CustomerEnrollmentSchema = z
  .object({ consent: z.literal(true), tenantSlug: z.string().optional() })
  .strict()
