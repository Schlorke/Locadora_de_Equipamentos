import { z } from 'zod'

export const UpdatePermissionsSchema = z
  .object({
    permissions: z
      .array(
        z.object({
          role: z.enum(['FINANCIAL', 'OPERATOR', 'CLIENT']),
          module: z.enum([
            'EQUIPMENTS',
            'QUOTES',
            'RENTALS',
            'FINANCIAL',
            'MAINTENANCE',
            'LOGISTICS',
            'CONTRACTS',
            'SETTINGS',
            'USERS',
          ]),
          action: z.enum(['READ', 'WRITE', 'DELETE', 'APPROVE', 'MANAGE']),
        })
      )
      .min(1)
      .max(100),
  })
  .refine(
    (value) =>
      value.permissions.every(
        (item) => item.role === value.permissions[0]!.role
      ),
    'Todas as permissões devem pertencer ao mesmo papel'
  )

export type PermissionReplacementInput = z.infer<
  typeof UpdatePermissionsSchema
>['permissions']
