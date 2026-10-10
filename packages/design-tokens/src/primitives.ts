// Nível 1 do design system: primitivos. Valores crus usados pelo web aprovado, lidos de
// quatro fontes (2026-09-26; a paleta, inteira, desde 2026-09-29), sem valor inventado:
//   1. design-tokens/base.json (Style Dictionary da raiz);
//   2. packages/design-tokens/src/theme.css (tema: :root, .dark e :root de ≥640px);
//   3. packages/design-tokens/src/tokens.css (tokens nomeados do CSS web; as antigas variáveis --legacy-* com nome
//      de hash viraram tokens nomeados aqui em 2026-09-29);
//   4. paleta Tailwind da produção (Tailwind 3.4.17), declarada no @theme de palette.css e usada pelas classes do
//      código web (packages/frontend/src, packages/ui/src, apps/clients/web/src).
// O mapeamento 1:1 fonte -> primitivo e a conversão são verificados em
// primitives.test.ts (tolerância zero).
//
// Unidades: cores em hex sRGB minúsculo (ou rgba()/hex de 8 dígitos quando há alfa);
// dimensões em px (1rem = 16px, conversão decimal exata); durações em ms; letterSpacing
// em em; lineHeight sem unidade; strings CSS compostas (sombras, clamp, pilhas de fonte)
// literais como na fonte.

/**
 * Converte uma tripla HSL do theme.css ("222.2 47.4% 11.2%") em hex sRGB.
 * Algoritmo da CSS Color 4 (§7.1 hslToRgb): a matiz é normalizada para [0, 360) antes
 * (h mod 360, somando 360 quando negativa: -120 é 240), f(n) = l - a·max(-1, min(k-3, 9-k, 1)),
 * k = (n + h/30) mod 12, a = s·min(l, 1-l); cada canal × 255 e arredondado ao inteiro
 * mais próximo (Math.round). É a mesma quantização de 8 bits da tela sRGB; nenhum canal
 * das 64 triplas cai a menos de 0,02 da fronteira de arredondamento, então o resultado
 * não depende de erro de ponto flutuante.
 */
export function hslTripleToHex(triple: string): string {
  const match = /^\s*(-?\d*\.?\d+)\s+(\d*\.?\d+)%\s+(\d*\.?\d+)%\s*$/.exec(
    triple
  )
  if (!match) throw new Error(`tripla HSL inválida: "${triple}"`)
  // No JS o resto mantém o sinal (-120 % 12 < 0); a CSS Color 4 normaliza a matiz primeiro.
  const h = ((Number(match[1]) % 360) + 360) % 360
  const s = Number(match[2]) / 100
  const l = Number(match[3]) / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/**
 * Paleta Tailwind da produção histórica (main eb4c0098, tailwindcss 3.4.17, antiga lib/public/colors.js retirada em F), completa: as 22 famílias de
 * 50 a 950, black e white. É o valor que `bg-orange-600` etc. renderizam: palette.css declara estes tons no @theme e
 * eles substituem os OKLCH do Tailwind 4 (orange-600 v4 = oklch(64.6% 0.222 41.116) ≈ #f54a00; aqui, #ea580c).
 */
const tailwind = {
  black: '#000',
  white: '#fff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  gray950: '#030712',
  zinc50: '#fafafa',
  zinc100: '#f4f4f5',
  zinc200: '#e4e4e7',
  zinc300: '#d4d4d8',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
  zinc700: '#3f3f46',
  zinc800: '#27272a',
  zinc900: '#18181b',
  zinc950: '#09090b',
  neutral50: '#fafafa',
  neutral100: '#f5f5f5',
  neutral200: '#e5e5e5',
  neutral300: '#d4d4d4',
  neutral400: '#a3a3a3',
  neutral500: '#737373',
  neutral600: '#525252',
  neutral700: '#404040',
  neutral800: '#262626',
  neutral900: '#171717',
  neutral950: '#0a0a0a',
  stone50: '#fafaf9',
  stone100: '#f5f5f4',
  stone200: '#e7e5e4',
  stone300: '#d6d3d1',
  stone400: '#a8a29e',
  stone500: '#78716c',
  stone600: '#57534e',
  stone700: '#44403c',
  stone800: '#292524',
  stone900: '#1c1917',
  stone950: '#0c0a09',
  red50: '#fef2f2',
  red100: '#fee2e2',
  red200: '#fecaca',
  red300: '#fca5a5',
  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',
  red700: '#b91c1c',
  red800: '#991b1b',
  red900: '#7f1d1d',
  red950: '#450a0a',
  orange50: '#fff7ed',
  orange100: '#ffedd5',
  orange200: '#fed7aa',
  orange300: '#fdba74',
  orange400: '#fb923c',
  orange500: '#f97316',
  orange600: '#ea580c',
  orange700: '#c2410c',
  orange800: '#9a3412',
  orange900: '#7c2d12',
  orange950: '#431407',
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
  amber800: '#92400e',
  amber900: '#78350f',
  amber950: '#451a03',
  yellow50: '#fefce8',
  yellow100: '#fef9c3',
  yellow200: '#fef08a',
  yellow300: '#fde047',
  yellow400: '#facc15',
  yellow500: '#eab308',
  yellow600: '#ca8a04',
  yellow700: '#a16207',
  yellow800: '#854d0e',
  yellow900: '#713f12',
  yellow950: '#422006',
  lime50: '#f7fee7',
  lime100: '#ecfccb',
  lime200: '#d9f99d',
  lime300: '#bef264',
  lime400: '#a3e635',
  lime500: '#84cc16',
  lime600: '#65a30d',
  lime700: '#4d7c0f',
  lime800: '#3f6212',
  lime900: '#365314',
  lime950: '#1a2e05',
  green50: '#f0fdf4',
  green100: '#dcfce7',
  green200: '#bbf7d0',
  green300: '#86efac',
  green400: '#4ade80',
  green500: '#22c55e',
  green600: '#16a34a',
  green700: '#15803d',
  green800: '#166534',
  green900: '#14532d',
  green950: '#052e16',
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald300: '#6ee7b7',
  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065f46',
  emerald900: '#064e3b',
  emerald950: '#022c22',
  teal50: '#f0fdfa',
  teal100: '#ccfbf1',
  teal200: '#99f6e4',
  teal300: '#5eead4',
  teal400: '#2dd4bf',
  teal500: '#14b8a6',
  teal600: '#0d9488',
  teal700: '#0f766e',
  teal800: '#115e59',
  teal900: '#134e4a',
  teal950: '#042f2e',
  cyan50: '#ecfeff',
  cyan100: '#cffafe',
  cyan200: '#a5f3fc',
  cyan300: '#67e8f9',
  cyan400: '#22d3ee',
  cyan500: '#06b6d4',
  cyan600: '#0891b2',
  cyan700: '#0e7490',
  cyan800: '#155e75',
  cyan900: '#164e63',
  cyan950: '#083344',
  sky50: '#f0f9ff',
  sky100: '#e0f2fe',
  sky200: '#bae6fd',
  sky300: '#7dd3fc',
  sky400: '#38bdf8',
  sky500: '#0ea5e9',
  sky600: '#0284c7',
  sky700: '#0369a1',
  sky800: '#075985',
  sky900: '#0c4a6e',
  sky950: '#082f49',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue800: '#1e40af',
  blue900: '#1e3a8a',
  blue950: '#172554',
  indigo50: '#eef2ff',
  indigo100: '#e0e7ff',
  indigo200: '#c7d2fe',
  indigo300: '#a5b4fc',
  indigo400: '#818cf8',
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  indigo700: '#4338ca',
  indigo800: '#3730a3',
  indigo900: '#312e81',
  indigo950: '#1e1b4b',
  violet50: '#f5f3ff',
  violet100: '#ede9fe',
  violet200: '#ddd6fe',
  violet300: '#c4b5fd',
  violet400: '#a78bfa',
  violet500: '#8b5cf6',
  violet600: '#7c3aed',
  violet700: '#6d28d9',
  violet800: '#5b21b6',
  violet900: '#4c1d95',
  violet950: '#2e1065',
  purple50: '#faf5ff',
  purple100: '#f3e8ff',
  purple200: '#e9d5ff',
  purple300: '#d8b4fe',
  purple400: '#c084fc',
  purple500: '#a855f7',
  purple600: '#9333ea',
  purple700: '#7e22ce',
  purple800: '#6b21a8',
  purple900: '#581c87',
  purple950: '#3b0764',
  fuchsia50: '#fdf4ff',
  fuchsia100: '#fae8ff',
  fuchsia200: '#f5d0fe',
  fuchsia300: '#f0abfc',
  fuchsia400: '#e879f9',
  fuchsia500: '#d946ef',
  fuchsia600: '#c026d3',
  fuchsia700: '#a21caf',
  fuchsia800: '#86198f',
  fuchsia900: '#701a75',
  fuchsia950: '#4a044e',
  pink50: '#fdf2f8',
  pink100: '#fce7f3',
  pink200: '#fbcfe8',
  pink300: '#f9a8d4',
  pink400: '#f472b6',
  pink500: '#ec4899',
  pink600: '#db2777',
  pink700: '#be185d',
  pink800: '#9d174d',
  pink900: '#831843',
  pink950: '#500724',
  rose50: '#fff1f2',
  rose100: '#ffe4e6',
  rose200: '#fecdd3',
  rose300: '#fda4af',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  rose600: '#e11d48',
  rose700: '#be123c',
  rose800: '#9f1239',
  rose900: '#881337',
  rose950: '#4c0519',
} as const

/**
 * Cores opacas. Nome Tailwind v3 quando o hex é idêntico ao da paleta v3 (a notação usada
 * nas fontes 1-3); demais pelo papel de origem. Fonte única: o hex de um tom da paleta mora só em
 * `tailwind`, e o tom homônimo daqui é uma referência a ele (primitives.test.ts; `pnpm check:tokens` troca a
 * única definição de orange600, a primária do tema, por uma sentinela).
 */
const color = {
  /** Branco em 6 dígitos, o formato dos consumidores; a paleta guarda a notação curta do Tailwind 3 (#fff). */
  white: '#ffffff',
  slate50: tailwind.slate50,
  slate100: tailwind.slate100,
  slate200: tailwind.slate200,
  slate300: tailwind.slate300,
  slate400: tailwind.slate400,
  slate500: tailwind.slate500,
  slate700: tailwind.slate700,
  slate800: tailwind.slate800,
  slate900: tailwind.slate900,
  /** hsl(222.2 84% 4.9%) do tema shadcn/slate; difere do slate-950 Tailwind (#020617). */
  slate950Shadcn: '#020817',
  gray50: tailwind.gray50,
  gray100: tailwind.gray100,
  gray200: tailwind.gray200,
  gray300: tailwind.gray300,
  gray400: tailwind.gray400,
  gray500: tailwind.gray500,
  gray900: tailwind.gray900,
  zinc50: tailwind.zinc50,
  zinc100: tailwind.zinc100,
  zinc700: tailwind.zinc700,
  zinc800: tailwind.zinc800,
  zinc900: tailwind.zinc900,
  neutral950: tailwind.neutral950,
  red100: tailwind.red100,
  red200: tailwind.red200,
  red500: tailwind.red500,
  red700: tailwind.red700,
  red800: tailwind.red800,
  red900: tailwind.red900,
  orange50: tailwind.orange50,
  orange100: tailwind.orange100,
  orange200: tailwind.orange200,
  orange300: tailwind.orange300,
  orange400: tailwind.orange400,
  orange500: tailwind.orange500,
  orange600: tailwind.orange600,
  orange700: tailwind.orange700,
  amber500: tailwind.amber500,
  yellow100: tailwind.yellow100,
  yellow200: tailwind.yellow200,
  yellow800: tailwind.yellow800,
  green100: tailwind.green100,
  green200: tailwind.green200,
  green800: tailwind.green800,
  emerald500: tailwind.emerald500,
  /** Blue 100 da paleta. O nome antigo `palette.blue50` continua na fachada como alias. */
  blue100: tailwind.blue100,
  blue200: tailwind.blue200,
  blue500: tailwind.blue500,
  blue700: tailwind.blue700,
  blue800: tailwind.blue800,
  indigo200: tailwind.indigo200,
  indigo950: tailwind.indigo950,
  /** Trilho da barra de rolagem do chat do WhatsApp (--whatsapp-scroll-track). */
  offWhite: '#f0f0f0',
  /** Verde e verde-petróleo da marca WhatsApp (FAB e chat). */
  whatsappGreen: '#25d366',
  whatsappTeal: '#128c7e',
  /** Série categórica de gráficos (--chart-1..5 do :root). */
  chartLight1: '#e76e50',
  chartLight2: '#2a9d90',
  chartLight3: '#274754',
  chartLight4: '#e8c468',
  chartLight5: '#f4a462',
  /** Série categórica de gráficos (--chart-1..5 do .dark). */
  chartDark1: '#2662d9',
  chartDark2: '#2eb88a',
  chartDark3: '#e88c30',
  chartDark4: '#af57db',
  chartDark5: '#e23670',
} as const

/** Cores com alfa: `<base>A<percentual>`. As pretas são as cores das sombras de tokens.css. */
const alpha = {
  blackA04: 'rgba(0, 0, 0, 0.04)',
  blackA05: 'rgba(0, 0, 0, 0.05)',
  blackA06: 'rgba(0, 0, 0, 0.06)',
  blackA10: 'rgba(0, 0, 0, 0.1)',
  blackA25: 'rgba(0, 0, 0, 0.25)',
  whiteA95: 'rgba(255, 255, 255, 0.95)',
  gray200A80: 'rgba(229, 231, 235, 0.8)',
  orange600A10: 'rgba(234, 88, 12, 0.1)',
  blue500A10: 'rgba(59, 130, 246, 0.1)',
  /** Halo de 3px do campo em erro de validação (--field-invalid-halo): red-500 com alfa 0.1. */
  red500A10: 'rgba(239, 68, 68, 0.1)',
  /** Polegar da barra de rolagem global: #fc5a03 com alfa 0xd2 (210/255). */
  scrollbarOrange: '#fc5a03d2',
} as const

/** Espaçamento em px, chave = passo Tailwind (1 passo = 0.25rem = 4px). Passos usados em p/m/gap/space. */
const space = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
} as const

/**
 * Raios em px com os nomes das classes web: `rounded-sm/md/lg` seguem --radius (0.5rem)
 * via tailwind.config (lg = 8, md = 8 - 2, sm = 8 - 4); xl/2xl/3xl são do Tailwind v4.
 * `full` usa o 9999px de --rounded-full (o v4 emite calc(infinity * 1px)).
 */
const radius = {
  none: 0,
  scrollbarThumb: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const

/** Larguras de borda em px, chave = valor (border, border-2/3/4 e setas de tooltip 6px). */
const borderWidth = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '6': 6 } as const

/**
 * Sombras declaradas pelo projeto: as de base.json e as dos controles de tokens.css (foco dos campos com o halo azul,
 * área de texto, elevação intermediária e foco da caixa de seleção com o halo laranja).
 */
const shadow = {
  card: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  modal: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  button:
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  overlay: '4px 8px 18px 2px rgba(0,0,0,0.18)',
  controlFocus:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(59, 130, 246, 0.1)',
  /** Foco do campo em erro de validação: a sombra do foco com o halo vermelho. */
  controlInvalidFocus:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(239, 68, 68, 0.1)',
  textarea: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  raisedLg:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  checkboxFocus: '0 0 0 3px rgba(234, 88, 12, 0.1)',
} as const

/**
 * Sombras das classes `shadow`, `shadow-sm..2xl` e `shadow-inner` com os valores da produção (Tailwind 3.4.17). Só
 * `sm` difere do 4.3.3 (o `shadow-sm` do 4 é o `shadow` do 3): o web o grava em design-tokens/src/scales.css.
 */
const tailwindShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const

/**
 * Escalas da produção (Tailwind 3.4.17) que o 4.3.3 mudou, gravadas no @theme de design-tokens/src/scales.css:
 * blur-sm, drop-shadow-*, rounded-full, a largura/cor padrão de `ring` sem valor e os breakpoints (px no 3, rem no 4:
 * com a fonte do navegador acima de 16px, o breakpoint em rem só vale numa janela mais larga). O `outline` sem valor
 * do 3 não dava largura (scales.css a deixa com as camadas de baixo: revert-layer).
 */
const tailwindScale = {
  blurSm: 4,
  dropShadow: {
    sm: '0 1px 1px rgb(0 0 0 / 0.05)',
    md: '0 4px 3px rgb(0 0 0 / 0.07), 0 2px 2px rgb(0 0 0 / 0.06)',
    lg: '0 10px 8px rgb(0 0 0 / 0.04), 0 4px 3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 13px rgb(0 0 0 / 0.03), 0 8px 5px rgb(0 0 0 / 0.08)',
    '2xl': '0 25px 25px rgb(0 0 0 / 0.15)',
  },
  radiusFull: 9999,
  ringWidth: 3,
  ringColor: 'rgb(59 130 246 / 0.5)',
  /** Breakpoints sm…2xl em px (os `screens` padrão do Tailwind 3.4.17). */
  breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
} as const

/**
 * Movimento de base.json. `easingBezier` são os pontos de controle que a CSS Easing
 * Functions Level 1 define para cada palavra-chave (para plataformas sem a palavra-chave).
 */
const motion = {
  duration: { fast: 200, normal: 300, slow: 800 },
  easing: { easeOut: 'ease-out', easeIn: 'ease-in', easeInOut: 'ease-in-out' },
  easingBezier: {
    easeOut: [0, 0, 0.58, 1],
    easeIn: [0.42, 0, 1, 1],
    easeInOut: [0.42, 0, 0.58, 1],
  },
} as const

/**
 * Camadas de sobreposição (--layer-* do theme.css); os --z-* legados são aliases destas. step e inset empilham dentro
 * de um bloco; legacyStack é o empilhamento antigo do painel admin.
 */
const layer = {
  base: 0,
  step: 1,
  inset: 10,
  floating: 20,
  sticky: 30,
  fab: 40,
  dropdown: 60,
  popover: 70,
  dialogBackdrop: 80,
  dialog: 90,
  tooltip: 100,
  spotlight: 110,
  legacyStack: 9999,
} as const

/** Opacidades das classes usadas pelos componentes base (/80, /90, disabled:opacity-50). */
const opacity = { '50': 0.5, '80': 0.8, '90': 0.9 } as const

/** Escala de transformação de hover (hover:scale-105). */
const scale = { '105': 1.05 } as const

/** Letter-spacing em em. `display` é o -0.025em dos h1/h2 globais. */
const letterSpacing = {
  display: -0.025,
  tight: -0.015,
  normal: 0,
  wide: 0.015,
  wider: 0.05,
  widest: 0.1,
} as const

const typography = {
  family: {
    inter: 'Inter',
    jost: 'Jost',
    /** Pilha CSS do web: variável do next/font + fallback. */
    sansStack: 'var(--font-inter), sans-serif',
    headingStack: 'var(--font-jost), sans-serif',
  },
  weight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  /** Tamanhos em px: escala Tailwind v4 usada + 0.7rem/0.8rem do calendário (tokens.css). */
  size: {
    micro: 11.2,
    xs: 12,
    caption: 12.8,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },
  /** Altura de linha de cada tamanho text-*, em px: a da produção (Tailwind 3.4.17), gravada em scales.css. */
  sizeLineHeight: {
    xs: 16,
    sm: 20,
    base: 24,
    lg: 28,
    xl: 28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
    '5xl': 48,
    '6xl': 60,
  },
  /** Alturas de linha sem unidade das classes leading-* usadas. */
  leading: { none: 1, tight: 1.25, normal: 1.5, relaxed: 1.625 },
  /**
   * Tipografia fluida de base.json/tailwind.config e dos h1-h3/body/small globais:
   * clamp(min, preferred vw, max) com a altura de linha de cada nível.
   */
  fluid: {
    h1: {
      minPx: 40,
      preferredVw: 5,
      maxPx: 56,
      lineHeight: 1.2,
      css: 'clamp(2.5rem, 5vw, 3.5rem)',
    },
    h2: {
      minPx: 32,
      preferredVw: 4,
      maxPx: 48,
      lineHeight: 1.3,
      css: 'clamp(2rem, 4vw, 3rem)',
    },
    h3: {
      minPx: 24,
      preferredVw: 3,
      maxPx: 36,
      lineHeight: 1.4,
      css: 'clamp(1.5rem, 3vw, 2.25rem)',
    },
    base: {
      minPx: 16,
      preferredVw: 2,
      maxPx: 18,
      lineHeight: 1.6,
      css: 'clamp(1rem, 2vw, 1.125rem)',
    },
    small: {
      minPx: 14,
      preferredVw: 1.5,
      maxPx: 16,
      lineHeight: 1.5,
      css: 'clamp(0.875rem, 1.5vw, 1rem)',
    },
  },
} as const

/** Medidas estruturais do layout web (theme.css e tokens.css). */
const layout = {
  /** --header-height do :root (5rem) e do :root em ≥640px (4.5rem). */
  headerHeight: 80,
  headerHeightSm: 72,
  /** Deslocamento do conteúdo sob o header fixo (--header-offset + safe area). */
  headerOffset: 104,
  /** --viewport-width da compensação de scrollbar do header: max(1rem, calc((100vw - 100%) / 2 + 1rem)). */
  viewportWidthVw: 100,
  /** margin-right da barra de rolagem do dropdown de notificações. */
  scrollbarNudge: -4,
} as const

export const primitives = {
  color,
  alpha,
  tailwind,
  space,
  radius,
  borderWidth,
  shadow,
  tailwindShadow,
  tailwindScale,
  motion,
  layer,
  opacity,
  scale,
  letterSpacing,
  typography,
  layout,
} as const

export type Primitives = typeof primitives
export type ColorPrimitive = keyof typeof color
export type SpaceStep = keyof typeof space
