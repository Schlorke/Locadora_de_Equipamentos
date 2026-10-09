import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { CatalogError } from './errors'
import { slugify } from './slug'
import type { CatalogDependencies, DeferredInput } from './types'

/** Categoria nova já validada pelo contrato do adaptador HTTP. */
export type CategoryInput = {
  name: string
  description?: string
  icon?: string | null
  iconColor: string
  bgColor: string
  fontColor: string
  placement?: 'phases' | 'types' | null
  customIcon?: { [key: string]: unknown } | null
}

/**
 * Corpo legado do PUT, sem validação de esquema: campos ausentes não mudam;
 * valores de tipo inesperado falham como antes (erro genérico da rota).
 */
export type CategoryPatch = {
  name?: string
  description?: string | null
  icon?: string | null
  iconColor?: string | null
  bgColor?: string | null
  fontColor?: string | null
  placement?: unknown
  customIcon?: unknown
}

export function createCategoryAdmin({
  withRentalTransaction,
}: CatalogDependencies) {
  return {
    listCategories(context: TenantContext) {
      return withRentalTransaction(context, (tx) =>
        tx.category.findMany({
          where: { tenantId: context.tenantId },
          include: { _count: { select: { equipments: true } } },
          orderBy: { createdAt: 'desc' },
        })
      )
    },
    /** Nome e slug são únicos por locadora; 409 quando já existem. */
    createCategory(context: TenantContext, input: CategoryInput) {
      return withRentalTransaction(context, async (tx) => {
        const {
          name,
          description,
          icon,
          iconColor,
          bgColor,
          fontColor,
          placement,
          customIcon,
        } = input
        const slug = slugify(name)
        // Igualdade exata sem caixa: `equals` + `mode: 'insensitive'` vira
        // ILIKE, em que `_` e `%` são curingas e casariam outros nomes.
        const existingCategory = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM categories
          WHERE "tenantId" = ${context.tenantId}
            AND (lower(name) = lower(${name.trim()}) OR slug = ${slug})
          LIMIT 1`
        if (existingCategory.length > 0)
          throw new CatalogError('Categoria já existente', 409)
        return tx.category.create({
          data: {
            tenantId: context.tenantId,
            id: randomUUID(),
            name: name.trim(),
            description: description?.trim() || null,
            icon: icon?.trim() || null,
            iconColor: iconColor?.trim() || '#000000',
            bgColor: bgColor?.trim() || '#e0e0e0',
            fontColor: fontColor?.trim() || '#000000',
            slug,
            placement: placement || null,
            customIcon: customIcon
              ? (customIcon as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        })
      })
    },
    /** A posse é verificada antes de o corpo ser lido. */
    updateCategory(
      context: TenantContext,
      id: string,
      readPatch: DeferredInput<CategoryPatch>
    ) {
      return withRentalTransaction(context, async (tx) => {
        if (
          !(await tx.category.findFirst({
            where: { id, tenantId: context.tenantId },
            select: { id: true },
          }))
        )
          throw new CatalogError('Registro não encontrado', 404)
        const {
          name,
          description,
          icon,
          iconColor,
          bgColor,
          fontColor,
          placement,
          customIcon,
        } = await readPatch()

        const data: {
          name?: string
          slug?: string
          description?: string | null
          icon?: string | null
          iconColor?: string
          bgColor?: string
          fontColor?: string
          placement?: string | null
          customIcon?: Prisma.InputJsonValue | Prisma.JsonNullValueInput
        } = {}
        if (name) {
          data.name = name.trim()
          data.slug = slugify(name)
        }
        if (description !== undefined)
          data.description = description?.trim() || null
        if (icon !== undefined) data.icon = icon?.trim() || null
        if (iconColor !== undefined)
          data.iconColor = iconColor?.trim() || '#000000'
        if (bgColor !== undefined) data.bgColor = bgColor?.trim() || '#e0e0e0'
        if (fontColor !== undefined)
          data.fontColor = fontColor?.trim() || '#000000'
        if (placement !== undefined)
          data.placement =
            placement === 'phases' || placement === 'types' ? placement : null
        if (customIcon !== undefined) {
          data.customIcon = customIcon
            ? (customIcon as Prisma.InputJsonValue)
            : Prisma.JsonNull
        }

        return tx.category.update({
          where: { id, tenantId: context.tenantId },
          data,
        })
      })
    },
    deleteCategory(context: TenantContext, id: string) {
      return withRentalTransaction(context, async (tx) => {
        if (
          !(await tx.category.findFirst({
            where: { id, tenantId: context.tenantId },
            select: { id: true },
          }))
        )
          throw new CatalogError('Categoria não encontrada', 404)
        await tx.category.delete({ where: { id, tenantId: context.tenantId } })
      })
    },
  }
}
