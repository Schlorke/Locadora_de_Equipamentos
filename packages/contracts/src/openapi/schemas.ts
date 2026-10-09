import { z } from 'zod'
import { ContactSchema, QuoteRequestSchema } from '../quotations'

/**
 * Esquemas públicos da especificação OpenAPI da API compartilhada (onda 135, C5; antes em lib/openapi/schemas.ts da
 * raiz legada). `pnpm openapi:generate` (scripts/generate-openapi-zod.ts) converte cada export em JSON Schema
 * (public-schemas.json, ao lado) e as rotas de apps/services/api os citam pelo nome no JSDoc (`@query`, `@requestBody`,
 * `@response`). Só documentação e conferência de resposta (tests/api/contract.test.ts): as rotas validam a entrada
 * com os contratos de ../quotations.
 */

/**
 * Formato público de um equipamento no catálogo (o mesmo de lib/validations da raiz, que sai no bloco F). Só entra
 * na especificação por PublicEquipmentList.
 * @internal
 */
const EquipmentPublicSchema = z
  .object({
    id: z.string().describe('ID único do equipamento'),
    name: z.string().describe('Nome do equipamento'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Descrição do equipamento'),
    pricePerDay: z.number().positive().describe('Preço por dia'),
    categoryId: z.string().optional().describe('ID da categoria'),
    category: z
      .object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable().optional(),
        iconColor: z.string().optional(),
        bgColor: z.string().optional(),
        fontColor: z.string().optional(),
      })
      .optional()
      .describe('Categoria completa (quando expandida)'),
    imageUrl: z
      .string()
      .nullable()
      .optional()
      .describe('URL da imagem principal'),
    images: z.array(z.string()).optional().describe('URLs das imagens'),
    isAvailable: z.boolean().describe('Disponibilidade'),
    specifications: z
      .record(z.string(), z.string())
      .optional()
      .describe('Especificações técnicas'),
    reviews: z.array(z.any()).optional().describe('Avaliações'),
    createdAt: z.string().or(z.date()).optional().describe('Data de criação'),
    updatedAt: z
      .string()
      .or(z.date())
      .optional()
      .describe('Data de atualização'),
  })
  .refine(
    (data) => data.categoryId || data.category,
    'Deve ter categoryId ou category'
  )

/**
 * Formato público de uma categoria no catálogo (o mesmo de lib/validations da raiz, que sai no bloco F). Só entra na
 * especificação por PublicCategoryList.
 * @internal
 */
const CategoryPublicSchema = z.object({
  id: z.string().describe('ID único da categoria'),
  name: z.string().describe('Nome da categoria'),
  description: z
    .string()
    .nullable()
    .optional()
    .describe('Descrição da categoria'),
  icon: z.string().nullable().optional().describe('Ícone da categoria'),
  iconColor: z.string().optional().describe('Cor do ícone'),
  bgColor: z.string().optional().describe('Cor de fundo'),
  fontColor: z.string().optional().describe('Cor da fonte'),
  slug: z.string().optional().describe('Slug da categoria'),
  _count: z
    .object({
      equipments: z.number().optional(),
    })
    .optional()
    .describe('Contadores'),
  createdAt: z.string().or(z.date()).optional().describe('Data de criação'),
  updatedAt: z.string().or(z.date()).optional().describe('Data de atualização'),
})

export const PublicTenantQuery = z.object({
  tenantSlug: z
    .string()
    .min(1)
    .describe(
      'Slug explícito de uma locadora ativa; não existe locadora padrão'
    ),
})
export const PublicQuoteRequest = QuoteRequestSchema.extend({
  tenantSlug: z.string().min(1),
})
export const PublicContactRequest = ContactSchema.extend({
  tenantSlug: z.string().min(1),
})
export const PublicEquipmentList = z.array(EquipmentPublicSchema)
export const PublicCategoryList = z.array(CategoryPublicSchema)
export const PublicApiError = z.object({
  error: z.string(),
  code: z.string().optional(),
  field: z.string().optional(),
})
export const PublicQuoteCreated = z.object({
  id: z.string(),
  quoteCode: z.string(),
  status: z.literal('PENDING'),
  total: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      equipmentId: z.string(),
      quantity: z.number(),
      days: z.number(),
      pricePerDay: z.string(),
      total: z.string(),
    })
  ),
})
export const PublicContactAccepted = z.object({
  success: z.literal(true),
  data: z.object({
    messageId: z.string(),
    deliveryStatus: z.literal('queued'),
  }),
  message: z.string().optional(),
})
