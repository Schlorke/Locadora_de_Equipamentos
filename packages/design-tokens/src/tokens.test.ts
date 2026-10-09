// Fachada compatível: os valores abaixo são cópia literal do tokens.ts anterior aos níveis
// (refs/backup/wave1-base). Qualquer mudança de valor na fachada quebra este teste.
import { describe, expect, it } from "vitest";
import * as api from "./index";
import { border, componentTokens, palette, radius, space, themes, typography } from "./tokens";

const PALETTE_BEFORE = {
  orange600: "#ea580c",
  orange200: "#fed7aa",
  orange500: "#f97316",
  orange400: "#fb923c",
  orange300: "#fdba74",
  slate700: "#334155",
  emerald500: "#10b981",
  amber500: "#f59e0b",
  red500: "#ef4444",
  blue500: "#3b82f6",
  slate50: "#f8fafc",
  blue50: "#dbeafe",
  gray900: "#111827",
  gray500: "#6b7280",
  gray400: "#9ca3af",
  white: "#ffffff",
};

const THEMES_BEFORE = {
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#111827",
    textMuted: "#6b7280",
    primary: "#ea580c",
    onPrimary: "#ffffff",
    secondary: "#334155",
    onSecondary: "#ffffff",
    border: "#9ca3af",
    danger: "#ef4444",
    focus: "#f97316",
  },
  dark: {
    background: "#111827",
    surface: "#334155",
    text: "#ffffff",
    textMuted: "#9ca3af",
    primary: "#f97316",
    onPrimary: "#ffffff",
    secondary: "#334155",
    onSecondary: "#ffffff",
    border: "#6b7280",
    danger: "#ef4444",
    focus: "#fed7aa",
  },
};

describe("fachada compatível (tokens.ts)", () => {
  it("exporta os mesmos nomes de antes e os novos níveis por nomes novos", () => {
    const before = ["border", "componentTokens", "palette", "radius", "space", "themes", "typography"];
    const added = ["componentSpecs", "primitives", "semanticThemes"];
    expect(Object.keys(api).sort()).toEqual([...before, ...added].sort());
  });

  it("palette mantém cada valor; blue100 corrige o nome e blue50 segue como alias", () => {
    const { blue100, ...legacy } = palette;
    expect(legacy).toStrictEqual(PALETTE_BEFORE);
    expect(Object.keys(legacy)).toEqual(Object.keys(PALETTE_BEFORE));
    expect(blue100).toBe("#dbeafe");
    expect(palette.blue50).toBe(blue100);
  });

  it("themes não mudou", () => {
    expect(themes).toStrictEqual(THEMES_BEFORE);
  });

  it("space, radius, border e typography não mudaram", () => {
    expect(space).toStrictEqual({ none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 });
    expect(radius).toStrictEqual({ sm: 8, md: 12, lg: 16 });
    expect(border).toStrictEqual({ none: 0, hairline: 1 });
    expect(typography).toStrictEqual({
      family: { sans: "Inter", heading: "Jost" },
      size: { sm: 14, md: 16, lg: 24, xl: 32, xxl: 40 },
      weight: { regular: "400", semibold: "600", bold: "700" },
      lineHeightRatio: { body: 1.5 },
      scale: { categoryIconText: 0.9 },
      lineHeight: { sm: 20, md: 24, lg: 32, xl: 40, xxl: 48 },
    });
  });

  it("componentTokens devolve o mesmo resultado nos dois temas", () => {
    for (const mode of ["light", "dark"] as const) {
      const theme = THEMES_BEFORE[mode];
      expect(componentTokens(themes[mode])).toStrictEqual({
        avatar: { size: 40, radius: 20 },
        gridMotion: { rowOffset: 150 },
        button: {
          background: { primary: theme.primary, secondary: theme.secondary },
          color: { primary: theme.onPrimary, secondary: theme.onSecondary },
          border: { primary: theme.primary, secondary: theme.border },
        },
      });
    }
  });
});
