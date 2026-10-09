import { z } from 'zod'

export const CreateCategorySchema = z
  .object({
    name: z.string().min(1, 'O nome da categoria é obrigatório'),
    description: z.string().optional(),
    icon: z.string().optional().nullable(),
    iconColor: z.string().min(1, 'Cor do ícone é obrigatória'),
    bgColor: z.string().min(1, 'Cor de fundo é obrigatória'),
    fontColor: z.string().min(1, 'Cor da fonte é obrigatória'),
    placement: z.enum(['phases', 'types']).optional().nullable(),
    customIcon: z
      .object({
        source: z.enum(['none', 'upload', 'url', 'emoji']),
        svgContent: z.string().optional(),
        dataUrl: z.string().optional(),
        fileName: z.string().optional(),
        url: z.string().optional(),
        emoji: z.string().nullable().optional(),
        name: z.string().optional(),
      })
      .optional()
      .nullable(),
  })
  .strict()
