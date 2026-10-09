// components/dialogs/icon-customization-data.ts
import { CUSTOM_ICONS } from '@gb-locacoes/ui'
import {
  isCustomIcon,
  type AllIconNames,
} from '../../../shared/lib/constants/all-icons'
import {
  buildIconSearchIndex,
  normalizeIconName,
} from '../../../shared/lib/icon-utils'

export type IconPickerTab = 'emoji' | 'icons' | 'custom'

export interface EmojiGroup {
  id: string
  label: string
  glyph?: string
  emojis: string[]
}

export interface IconGroup {
  id: string
  label: string
  glyph?: string
  icons: AllIconNames[]
}

export const ICON_PICKER_TABS: Array<{ value: IconPickerTab; label: string }> =
  [
    { value: 'icons', label: 'Ícones' },
    { value: 'emoji', label: 'Emoji' },
    { value: 'custom', label: 'Fazer Upload' },
  ]

export const RECENT_ICON_GROUP_ID = 'recent-icons'
export const RECENT_EMOJI_GROUP_ID = 'recent'
const MAX_RECENT_ICONS_DISPLAY = 12
const MAX_RECENT_EMOJIS_DISPLAY = 12

const BASE_EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: 'people',
    label: 'Pessoas',
    glyph: '😀',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '🙃',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😗',
      '😚',
      '😙',
      '😋',
      '😛',
      '😜',
      '🤪',
      '🤨',
      '🧐',
      '🤓',
      '😎',
      '🥸',
      '🤠',
      '🥳',
      '🥺',
      '😭',
      '😢',
      '😡',
      '🤬',
      '🤯',
      '🤗',
      '🤝',
    ],
  },
  {
    id: 'nature',
    label: 'Natureza',
    glyph: '🌿',
    emojis: [
      '🌱',
      '🌿',
      '☘️',
      '🍀',
      '🎋',
      '🍃',
      '🍂',
      '🍁',
      '🌷',
      '🌹',
      '🌺',
      '🌸',
      '🌼',
      '🌻',
      '🌞',
      '🌝',
      '🌛',
      '🌜',
      '⭐',
      '⚡',
      '🌈',
      '☔',
      '🌧️',
      '❄️',
      '🔥',
      '🌊',
    ],
  },
  {
    id: 'objects',
    label: 'Objetos',
    glyph: '🧰',
    emojis: [
      '🛠️',
      '🧰',
      '🔧',
      '🔨',
      '⚙️',
      '🪛',
      '🪚',
      '🧱',
      '🏗️',
      '⚒️',
      '🪜',
      '📦',
      '📁',
      '📄',
      '💡',
      '🔌',
      '🧲',
      '📡',
      '🖥️',
      '📱',
      '🕹️',
      '📷',
      '🎥',
      '🎧',
      '🎯',
      '🪙',
      '💳',
      '💼',
    ],
  },
  {
    id: 'symbols',
    label: 'Símbolos',
    glyph: '🔣',
    emojis: [
      '❤️',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '💯',
      '✅',
      '❌',
      '⚠️',
      '🚫',
      '⚡',
      '✔️',
      '➕',
      '➖',
      '➗',
      '✖️',
      '🔺',
      '🔻',
      '🔸',
      '🔹',
      '🔷',
      '🔶',
      '🟥',
      '🟩',
      '🟦',
    ],
  },
  {
    id: 'flags',
    label: 'Bandeiras',
    glyph: '🚩',
    emojis: [
      '🇧🇷',
      '🇵🇹',
      '🇺🇸',
      '🇨🇦',
      '🇪🇸',
      '🇫🇷',
      '🇮🇹',
      '🇩🇪',
      '🇯🇵',
      '🇨🇳',
      '🇬🇧',
      '🇦🇷',
      '🇲🇽',
      '🇦🇺',
      '🇨🇱',
      '🇵🇪',
      '🇨🇴',
      '🇺🇾',
      '🇵🇾',
      '🇧🇴',
      '🇻🇪',
      '🇵🇰',
      '🇮🇳',
      '🏳️',
      '🏴',
    ],
  },
]

type BuildEmojiGroupsOptions = {
  searchTerm: string
  recentEmojis: string[]
}

const filterEmojiList = (emojis: readonly string[], term: string) => {
  if (!term) {
    return [...emojis]
  }

  const normalizedTerm = term.toLowerCase()
  return emojis.filter((emoji) => emoji.toLowerCase().includes(normalizedTerm))
}

export function buildEmojiGroups({
  searchTerm,
  recentEmojis,
}: BuildEmojiGroupsOptions): { groups: EmojiGroup[] } {
  const term = searchTerm.trim().toLowerCase()
  const uniqueRecentEmojis = Array.from(
    new Set(
      recentEmojis.filter(
        (emoji): emoji is string =>
          typeof emoji === 'string' && emoji.trim().length > 0
      )
    )
  )
  const recentFiltered = filterEmojiList(uniqueRecentEmojis, term).slice(
    0,
    MAX_RECENT_EMOJIS_DISPLAY
  )

  const recentsGroup =
    recentFiltered.length > 0
      ? {
          id: RECENT_EMOJI_GROUP_ID,
          label: 'Recentes',
          glyph: '🕒',
          emojis: recentFiltered,
        }
      : null

  const filteredBaseGroups = BASE_EMOJI_GROUPS.map((group) => ({
    ...group,
    emojis: filterEmojiList(group.emojis, term),
  })).filter((group) => group.emojis.length > 0)

  const groups = recentsGroup
    ? [recentsGroup, ...filteredBaseGroups]
    : filteredBaseGroups

  return { groups }
}

export const LUCIDE_ICON_GROUPS: IconGroup[] = [
  {
    id: 'construction',
    label: 'Construção & Ferramentas',
    glyph: '🛠️',
    icons: [
      'Package',
      'Hammer',
      'Wrench',
      'Factory',
      'Warehouse',
      'Building',
      'Building2',
      'Home',
      'Ruler',
      'Gauge',
      'Thermometer',
      'Shield',
    ] as AllIconNames[],
  },
  {
    id: 'transport',
    label: 'Transporte & Logística',
    glyph: '🚚',
    icons: [
      'Truck',
      'Car',
      'Bus',
      'Bike',
      'Plane',
      'Ship',
      'Train',
      'Navigation',
      'Compass',
      'MapPin',
      'Route',
      'Globe',
    ] as AllIconNames[],
  },
  {
    id: 'people-status',
    label: 'Pessoas & Status',
    glyph: '👥',
    icons: [
      'Users',
      'User',
      'UserCog',
      'Contact',
      'IdCard',
      'Store',
      'Star',
      'Heart',
      'ThumbsUp',
      'CheckCircle',
      'Award',
      'Trophy',
      'Medal',
    ] as AllIconNames[],
  },
  {
    id: 'communication',
    label: 'Comunicação & Mídia',
    glyph: '💬',
    icons: [
      'Phone',
      'PhoneCall',
      'PhoneIncoming',
      'PhoneOutgoing',
      'Mail',
      'Send',
      'MessageCircle',
      'MessageSquare',
      'Inbox',
      'Image',
      'Camera',
      'Video',
      'Music',
      'Speaker',
      'Play',
    ] as AllIconNames[],
  },
  {
    id: 'analytics',
    label: 'Indicadores & Métricas',
    glyph: '📊',
    icons: [
      'TrendingUp',
      'TrendingDown',
      'Activity',
      'BarChart',
      'BarChart2',
      'BarChart3',
      'PieChart',
      'LineChart',
      'Target',
      'Percent',
      'Calculator',
      'Sigma',
      'Hash',
    ] as AllIconNames[],
  },
  {
    id: 'weather',
    label: 'Clima & Ambiente',
    glyph: '⛅',
    icons: [
      'Sun',
      'Sunrise',
      'Sunset',
      'Moon',
      'Stars',
      'Sparkles',
      'Cloud',
      'CloudRain',
      'CloudSnow',
      'CloudLightning',
      'Tornado',
      'Wind',
      'Rainbow',
      'Snowflake',
      'Droplet',
      'Umbrella',
      'Flame',
    ] as AllIconNames[],
  },
]

export const CUSTOM_ICON_GROUPS: IconGroup[] = [
  {
    id: 'custom-library',
    label: 'Personalizados',
    glyph: '✨',
    icons: Object.keys(CUSTOM_ICONS) as AllIconNames[],
  },
]

type BuildIconGroupsOptions = {
  searchTerm: string
  recentIcons: AllIconNames[]
}

const normalizeIcon = (icon: AllIconNames): AllIconNames | null => {
  const normalized = normalizeIconName(icon)
  if (normalized) return normalized
  if (isCustomIcon(icon)) return icon
  return null
}

const filterIcons = (icons: readonly AllIconNames[], term: string) => {
  const normalized = icons
    .map((icon) => normalizeIcon(icon))
    .filter((icon): icon is AllIconNames => icon !== null)

  const uniqueNormalized = Array.from(new Set(normalized))

  if (!term) {
    return uniqueNormalized
  }

  return uniqueNormalized.filter((iconName) =>
    buildIconSearchIndex(iconName).includes(term)
  )
}

export function buildIconGroups({
  searchTerm,
  recentIcons,
}: BuildIconGroupsOptions): {
  groups: IconGroup[]
  navigationOrder: string[]
} {
  const term = searchTerm.trim().toLowerCase()

  const recentIconsFiltered = filterIcons(recentIcons, term).slice(
    0,
    MAX_RECENT_ICONS_DISPLAY
  )
  const recentsGroup =
    recentIconsFiltered.length > 0
      ? {
          id: RECENT_ICON_GROUP_ID,
          label: 'Recentes',
          glyph: '🕒',
          icons: recentIconsFiltered,
        }
      : null

  const lucideGroups = LUCIDE_ICON_GROUPS.map((group) => ({
    ...group,
    icons: filterIcons(group.icons, term),
  })).filter((group) => group.icons.length > 0)

  const customGroups = CUSTOM_ICON_GROUPS.map((group) => ({
    ...group,
    icons: filterIcons(group.icons, term),
  })).filter((group) => group.icons.length > 0)

  const groups: IconGroup[] = []
  if (recentsGroup) groups.push(recentsGroup)
  groups.push(...lucideGroups)
  groups.push(...customGroups)

  const navigationOrder: string[] = []
  if (recentsGroup) navigationOrder.push(RECENT_ICON_GROUP_ID)

  return {
    groups,
    navigationOrder,
  }
}
