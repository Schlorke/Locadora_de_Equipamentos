import { primitives } from './primitives'

/** Existing printable A4 values; points, not CSS pixels. No screen theme is changed. */
export const documentTokens = {
  colors: {
    brand: primitives.tailwind.orange500,
    onBrand: primitives.tailwind.white,
    strong: primitives.tailwind.gray800,
    onStrong: primitives.tailwind.white,
    text: primitives.tailwind.gray900,
    textSecondary: primitives.tailwind.gray500,
    textMuted: primitives.tailwind.gray400,
    border: primitives.tailwind.gray300,
    borderLight: primitives.tailwind.gray200,
    surface: primitives.tailwind.gray50,
    success: primitives.tailwind.green600,
    danger: primitives.tailwind.red600,
    warning: primitives.tailwind.amber600,
  },
  layout: {
    pageWidth: 595.28,
    pageHeight: 841.89,
    marginTop: 42,
    marginBottom: 42,
    marginLeft: 42,
    marginRight: 42,
    titleSize: 16,
    subtitleSize: 12,
    sectionHeaderSize: 11,
    tableHeaderSize: 8.5,
    tableBodySize: 8.5,
    labelSize: 7.5,
    valueSize: 8.5,
    footerSize: 7,
    totalRowSize: 10,
    sectionGap: 16,
    lineHeight: 1.3,
  },
} as const

/** Existing financial calendar sRGB values. */
export const financialCalendarColors = {
  paid: primitives.tailwind.green600,
  unpaid: primitives.tailwind.red600,
  settled: primitives.tailwind.slate600,
  awaiting: primitives.tailwind.amber500,
} as const

function argb(hex: string) {
  const rgb = hex.slice(1)
  return (
    'FF' +
    (rgb.length === 3 ? [...rgb].map((c) => c + c).join('') : rgb).toUpperCase()
  )
}

/** Existing financial report colors and typography, preserved in printed points. */
export const financialReportTokens = {
  pdf: {
    colors: {
      secondary: '#666666',
      accent: '#1a56db',
      text: '#000000',
      border: '#dddddd',
      onStrong: '#ffffff',
      alternate: '#f8f9fa',
      strong: '#333333',
      muted: '#888888',
      footer: '#999999',
    },
    fonts: {
      title: 16,
      subtitle: 9,
      header: 7,
      row: 6.5,
      summary: 10,
      note: 8,
    },
    margins: { top: 40, bottom: 40, left: 35, right: 35 },
  },
  xlsx: {
    colors: {
      orange: argb(primitives.tailwind.orange500),
      orangeDark: argb(primitives.tailwind.orange600),
      orangeLight: argb(primitives.tailwind.orange50),
      orangePale: argb(primitives.tailwind.amber100),
      dark: argb(primitives.tailwind.slate800),
      darkMed: argb(primitives.tailwind.slate700),
      gray100: argb(primitives.tailwind.slate100),
      gray200: argb(primitives.tailwind.slate200),
      gray300: argb(primitives.tailwind.slate300),
      gray500: argb(primitives.tailwind.slate500),
      gray700: argb(primitives.tailwind.slate700),
      gray900: argb(primitives.tailwind.slate900),
      white: argb(primitives.tailwind.white),
      green: argb(primitives.tailwind.green600),
      greenBg: argb(primitives.tailwind.green100),
      red: argb(primitives.tailwind.red600),
      redBg: argb(primitives.tailwind.red100),
      yellowBg: argb(primitives.tailwind.amber100),
      blueBg: argb(primitives.tailwind.blue100),
      grayBg: argb(primitives.tailwind.slate100),
      accent: 'FF1A56DB',
    },
    fonts: {
      title: 18,
      subtitle: 11,
      section: 14,
      total: 12,
      footer: 9,
      label: 10,
      value: 20,
    },
  },
} as const

/** Existing contract HTML colors, preserving the printable template byte for byte. */
export const contractHtmlTokens = {
  brand: primitives.tailwind.orange600,
  equipmentBackground: '#f5f5f5',
} as const
