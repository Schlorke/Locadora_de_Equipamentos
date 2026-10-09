import type { AllIconNames } from './constants/all-icons';
export type CategoryDialogMode = 'create' | 'edit'
export type CategoryPlacement = 'phases' | 'types'
export type CustomIconSource = 'none' | 'upload' | 'url' | 'emoji'

export interface CustomIconConfig {
  source: CustomIconSource
  svgContent?: string
  dataUrl?: string
  fileName?: string
  url?: string
  emoji?: string | null
  name?: string
}

export interface CategoryDetails {
  name: string
  description: string
}

export interface CategoryDesign {
  backgroundColor: string
  fontColor: string
  iconColor: string
  icon: AllIconNames
  customIcon: CustomIconConfig
  placement: CategoryPlacement
}

export const MAX_SVG_FILE_SIZE_KB = 64

export const DEFAULT_ICON = 'Tag' as AllIconNames

export const DEFAULT_CUSTOM_ICON: CustomIconConfig = {
  source: 'none',
  svgContent: undefined,
  dataUrl: undefined,
  fileName: undefined,
  url: undefined,
  emoji: null,
  name: undefined,
}

export const DEFAULT_DESIGN: CategoryDesign = {
  backgroundColor: '#3b82f6', // token-check-allow: defaults legados de categoria
  fontColor: '#ffffff', // token-check-allow: defaults legados de categoria
  iconColor: '#ffffff', // token-check-allow: defaults legados de categoria
  icon: DEFAULT_ICON,
  customIcon: { ...DEFAULT_CUSTOM_ICON },
  placement: 'types',
}

export const CATEGORY_PREVIEW_TABS: ReadonlyArray<{
  value: CategoryPlacement
  label: string
}> = [
  { value: 'phases', label: 'Fases da obra' },
  { value: 'types', label: 'Tipo de trabalho' },
]

export type RenderIconOptions = {
  size?: number
  className?: string
  color?: string
}

export function cloneDesign(design: CategoryDesign): CategoryDesign {
  return {
    ...design,
    icon: design.icon,
    customIcon: { ...design.customIcon },
  }
}

export function sanitizeSvg(raw: string): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  const svgIndex = trimmed.toLowerCase().indexOf('<svg')

  if (svgIndex === -1) {
    return null
  }

  const normalized = trimmed.slice(svgIndex)
  const withoutScript = normalized.replace(
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    ''
  )
  const withoutForeignObject = withoutScript.replace(
    /<foreignObject[\s\S]*?<\/foreignObject>/gi,
    ''
  )
  const withoutEvents = withoutForeignObject
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/xlink:href="javascript:[^"]*"/gi, '')
    .replace(/href="javascript:[^"]*"/gi, '')

  return withoutEvents
}

export function isValidSvgFile(file: { type: string; name: string; size: number }) {
  const isSvg =
    file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
  const isUnderLimit = file.size <= MAX_SVG_FILE_SIZE_KB * 1024
  return isSvg && isUnderLimit
}

export function isValidSvgUrl(value: string) {
  try {
    const parsed = new URL(value)
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:'
    const endsWithSvg = parsed.pathname.toLowerCase().endsWith('.svg')
    return isHttp && endsWithSvg
  } catch (_error) {
    return false
  }
}

