// lib/category-design.tsx
import type { ReactElement } from 'react'

import { renderIcon as renderLibraryIcon } from './constants/all-icons'
import { cn } from './cn.web'
import { Tag as TagIcon } from 'lucide-react'

import { normalizeIconName } from './icon-utils'

import {
  DEFAULT_ICON,
  type CategoryDesign,
  type RenderIconOptions,
} from './category-design-model'
export {
  MAX_SVG_FILE_SIZE_KB,
  DEFAULT_ICON,
  DEFAULT_CUSTOM_ICON,
  DEFAULT_DESIGN,
  CATEGORY_PREVIEW_TABS,
  cloneDesign,
  sanitizeSvg,
  isValidSvgFile,
  isValidSvgUrl,
} from './category-design-model'
export type {
  CategoryDialogMode,
  CategoryPlacement,
  CustomIconSource,
  CustomIconConfig,
  CategoryDetails,
  CategoryDesign,
  RenderIconOptions,
} from './category-design-model'
export function svgToDataUrl(svg: string): string {
  if (!svg) return ''
  if (typeof window === 'undefined' || typeof window.btoa !== 'function') {
    return ''
  }

  const utf8Svg = encodeURIComponent(svg).replace(
    /%([0-9A-F]{2})/g,
    (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16))
  )

  return `data:image/svg+xml;base64,${window.btoa(utf8Svg)}`
}

export function renderCategoryIcon(
  design: CategoryDesign,
  { size = 28, className, color }: RenderIconOptions = {}
): ReactElement {
  const { customIcon } = design

  if (customIcon.source === 'upload' && customIcon.dataUrl) {
    return (
      <img
        src={customIcon.dataUrl}
        alt=""
        className={cn('h-full w-full object-contain', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  if (customIcon.source === 'url' && customIcon.url) {
    return (
      <img
        src={customIcon.url}
        alt=""
        className={cn('h-full w-full object-contain', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  if (customIcon.source === 'emoji' && customIcon.emoji) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex h-full w-full items-center justify-center text-3xl',
          className
        )}
        style={{ fontSize: size * 0.9, lineHeight: 1 }} // token-check-allow: escala tipográfica do emoji de categoria
      >
        {customIcon.emoji}
      </span>
    )
  }

  const normalizedIcon = normalizeIconName(design.icon) ?? DEFAULT_ICON
  const iconColor = color ?? design.iconColor ?? 'currentColor'
  const renderedIcon =
    renderLibraryIcon(normalizedIcon, size, iconColor, className) ??
    renderLibraryIcon(DEFAULT_ICON, size, iconColor, className)

  if (renderedIcon) {
    return renderedIcon
  }

  return (
    <TagIcon size={size} color={iconColor} className={className} aria-hidden />
  )
}
