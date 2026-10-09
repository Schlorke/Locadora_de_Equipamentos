'use client'

/**
 * HELPERS DE CATEGORIA (native)
 *
 * Mesma API do web. Badge sem className/style (contrato @gb-locacoes/ui).
 * Sem Tailwind no selo.
 */

import * as LucideIcons from 'lucide-react-native'
import { Tag } from 'lucide-react-native'
import React from 'react'

import { palette } from '@gb-locacoes/design-tokens'
import { Badge } from '@gb-locacoes/ui'
import type { CategoryDesign, CustomIconConfig } from './category-design'
import { renderCategoryIcon as renderCategoryIconFromDesign } from './category-design'

/**
 * Interface para dados básicos de categoria
 * Compatível com tanto Category do Prisma quanto CategoryData do modal
 */
export interface CategoryBadgeData {
  id?: string
  name: string
  description?: string
  icon?: string | null
  iconColor?: string
  backgroundColor?: string
  bgColor?: string // Compatibilidade com API
  fontColor?: string
  customIcon?: CustomIconConfig | null // Ícone customizado (SVG, emoji, URL)
}

/**
 * Renderiza um ícone Lucide dinamicamente
 */
export function renderLucideIcon(
  icon?: keyof typeof LucideIcons | null,
  size: number = 20,
  color?: string
): React.ReactElement | null {
  if (!icon || !LucideIcons[icon as keyof typeof LucideIcons]) return null

  const IconComponent = LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{
    size?: number
    color?: string
  }>

  return <IconComponent size={size} color={color} />
}

/**
 * Renderiza um ícone de categoria com fallback
 */
export function renderCategoryIcon(
  iconName?: keyof typeof LucideIcons | null,
  color?: string,
  size: number = 16
): React.ReactElement {
  if (!iconName) {
    return <Tag size={16} color={palette.gray400} />
  }

  return (
    renderLucideIcon(iconName, size, color || '#3b82f6' /* token-check-allow: fallback azul Lucide de categoria */) || (
      <Tag size={16} color={palette.gray400} />
    )
  )
}

/**
 * Variantes de tamanho para badges de categoria (API compartilhada; native não aplica Tailwind)
 */
export const BADGE_SIZES = {
  xs: {
    text: 'text-[10px]',
    padding: 'px-2 py-1',
    rounded: 'rounded-full',
    gap: 'gap-1',
    icon: 12,
  },
  sm: {
    text: 'text-xs',
    padding: 'px-3 py-1.5',
    rounded: 'rounded-full',
    gap: 'gap-1.5',
    icon: 14,
  },
  md: {
    text: 'text-sm',
    padding: 'px-4 py-2',
    rounded: 'rounded-full',
    gap: 'gap-2',
    icon: 16,
  },
  lg: {
    text: 'text-sm',
    padding: 'px-6 py-3',
    rounded: 'rounded-full',
    gap: 'gap-3',
    icon: 18,
  },
} as const

export type BadgeSize = keyof typeof BADGE_SIZES

/**
 * Cria um badge preview de categoria (native: Badge sem className/style)
 */
export function getCategoryBadgePreview(
  category: CategoryBadgeData,
  size: BadgeSize = 'md',
  _hover: boolean = true
): React.ReactElement {
  const sizeConfig = BADGE_SIZES[size]

  const design: CategoryDesign = {
    backgroundColor: category.backgroundColor || category.bgColor || '#e0e7ff', // token-check-allow: fallbacks legados do badge
    fontColor: category.fontColor || '#1e40af', // token-check-allow: fallbacks legados do badge
    iconColor: category.iconColor || '#3b82f6', // token-check-allow: fallbacks legados do badge
    icon: (category.icon as CategoryDesign['icon']) || 'Tag',
    customIcon: category.customIcon || { source: 'none' },
    placement: 'types',
  }

  const hasIcon =
    category.icon ||
    (category.customIcon && category.customIcon.source !== 'none')

  return (
    <Badge variant="outline">
      {hasIcon
        ? renderCategoryIconFromDesign(design, {
            size: sizeConfig.icon,
            color: design.iconColor,
          })
        : null}
      {category.name}
    </Badge>
  )
}

/**
 * Configurações padrão para novas categorias
 */
export const DEFAULT_CATEGORY_SETTINGS = {
  backgroundColor: '#3b82f6', // token-check-allow: defaults legados Blue-500 de categoria
  fontColor: '#ffffff', // token-check-allow: defaults legados Blue-500 de categoria
  iconColor: '#ffffff', // token-check-allow: defaults legados Blue-500 de categoria
  icon: undefined as keyof typeof LucideIcons | undefined,
} as const

/**
 * Cores predefinidas populares para categorias
 * Baseadas na paleta Tailwind CSS
 */
export const POPULAR_CATEGORY_COLORS = {
  backgrounds: [
    '#3b82f6', // token-check-allow: paleta curada legada de categorias
    '#ea580c', // token-check-allow: paleta curada legada de categorias
    '#10b981', // token-check-allow: paleta curada legada de categorias
    '#8b5cf6', // token-check-allow: paleta curada legada de categorias
    '#f59e0b', // token-check-allow: paleta curada legada de categorias
    '#ef4444', // token-check-allow: paleta curada legada de categorias
    '#06b6d4', // token-check-allow: paleta curada legada de categorias
    '#84cc16', // token-check-allow: paleta curada legada de categorias
    '#ec4899', // token-check-allow: paleta curada legada de categorias
    '#6366f1', // token-check-allow: paleta curada legada de categorias
  ],
  texts: [
    '#ffffff', // token-check-allow: paleta curada legada de categorias
    '#000000', // token-check-allow: paleta curada legada de categorias
    '#1e293b', // token-check-allow: paleta curada legada de categorias
    '#374151', // token-check-allow: paleta curada legada de categorias
  ],
} as const

/**
 * Valida se um ícone existe no Lucide React
 */
export function isValidLucideIcon(
  iconName: string
): iconName is keyof typeof LucideIcons {
  return iconName in LucideIcons
}

/**
 * Filtra ícones por termo de busca
 */
export function filterIconsBySearch(
  searchTerm: string,
  icons: ReadonlyArray<keyof typeof LucideIcons>
): Array<keyof typeof LucideIcons> {
  if (!searchTerm.trim()) return [...icons]

  const term = searchTerm.toLowerCase()
  return icons.filter((iconName) => iconName.toLowerCase().includes(term))
}
