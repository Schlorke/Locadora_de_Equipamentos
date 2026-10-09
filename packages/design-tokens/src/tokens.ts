// Fachada compatível (API anterior aos níveis). Nomes e valores são exatamente os de
// antes (2026-09-25), agora lidos dos primitivos; tokens.test.ts congela cada valor.
// Novos consumidores devem usar `primitives`, `semanticThemes` e `componentSpecs`:
// aqui `themes.*.primary` é o laranja #ea580c, enquanto no web aprovado o --primary é
// #0f172a (em semanticThemes: brand.default e surface.inverse, sem colisão de nome).
// Números de tipo são o mínimo do clamp documentado (mobile-first), em px.
import { primitives } from "./primitives";

const { color: c, space: step, radius: r, borderWidth: bw, typography: t } = primitives;

export const palette = {
  orange600: c.orange600,
  orange200: c.orange200,
  orange500: c.orange500,
  orange400: c.orange400,
  orange300: c.orange300,
  slate700: c.slate700,
  emerald500: c.emerald500,
  amber500: c.amber500,
  red500: c.red500,
  blue500: c.blue500,
  slate50: c.slate50,
  /** @deprecated Nome errado mantido por compatibilidade: o valor é Blue 100. Use `blue100`. */
  blue50: c.blue100,
  gray900: c.gray900,
  gray500: c.gray500,
  gray400: c.gray400,
  white: c.white,
  blue100: c.blue100,
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  border: string;
  danger: string;
  focus: string;
}

export const themes: Record<"light" | "dark", ThemeColors> = {
  light: {
    background: palette.slate50,
    surface: palette.white,
    text: palette.gray900,
    textMuted: palette.gray500,
    primary: palette.orange600,
    onPrimary: palette.white,
    secondary: palette.slate700,
    onSecondary: palette.white,
    border: palette.gray400,
    danger: palette.red500,
    focus: palette.orange500,
  },
  dark: {
    background: palette.gray900,
    surface: palette.slate700,
    text: palette.white,
    textMuted: palette.gray400,
    primary: palette.orange500,
    onPrimary: palette.white,
    secondary: palette.slate700,
    onSecondary: palette.white,
    border: palette.gray500,
    danger: palette.red500,
    focus: palette.orange200,
  },
};

export const space = {
  none: step["0"],
  xs: step["1"],
  sm: step["2"],
  md: step["4"],
  lg: step["6"],
  xl: step["8"],
  xxl: step["12"],
} as const;
/** Nomes de base.json (sm 8 / md 12 / lg 16); no web equivalem a rounded-lg/xl/2xl. */
export const radius = { sm: r.lg, md: r.xl, lg: r["2xl"] } as const;
export const border = { none: bw["0"], hairline: bw["1"] } as const;
export const typography = {
  family: { sans: t.family.inter, heading: t.family.jost },
  size: {
    sm: t.fluid.small.minPx,
    md: t.fluid.base.minPx,
    lg: t.fluid.h3.minPx,
    xl: t.fluid.h2.minPx,
    xxl: t.fluid.h1.minPx,
  },
  weight: { regular: t.weight.normal, semibold: t.weight.semibold, bold: t.weight.bold },
  lineHeightRatio: { body: t.leading.normal },
  // Valores próprios da fachada nativa, sem fonte web correspondente: ficam literais.
  scale: { categoryIconText: 0.9 },
  lineHeight: { sm: 20, md: 24, lg: 32, xl: 40, xxl: 48 },
} as const;

/** Camada de componente: só papéis semânticos, nenhum valor cru novo. */
export function componentTokens(theme: ThemeColors) {
  return {
    avatar: { size: space.xl + space.sm, radius: (space.xl + space.sm) / 2 },
    gridMotion: { rowOffset: 150 },
    button: {
      background: { primary: theme.primary, secondary: theme.secondary },
      color: { primary: theme.onPrimary, secondary: theme.onSecondary },
      border: { primary: theme.primary, secondary: theme.border },
    },
  } as const;
}

export type SpaceToken = keyof typeof space;
export type TextSize = keyof typeof typography.size;
