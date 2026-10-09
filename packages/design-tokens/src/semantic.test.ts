// Papéis semânticos = valores do web aprovado. Cada papel ligado a uma variável do
// theme.css é conferido contra a tripla HSL daquele tema (conversão documentada em
// primitives.ts, tolerância zero); os demais contra base.json e os tokens nomeados do tokens.css.
import { describe, expect, it } from "vitest";
import { primitives } from "./primitives";
import { semanticThemes, type SemanticTheme } from "./semantic";
import { colorKey, readBaseJson, readThemeBlocks, readTokensCss } from "./__tests__/web-sources";

const CSS_VAR_ROLE: Record<string, string> = {
  "--background": "surface.default",
  "--card": "surface.raised",
  "--popover": "surface.overlay",
  "--muted": "surface.muted",
  "--accent": "surface.accent",
  "--primary": "surface.inverse",
  "--foreground": "text.default",
  "--card-foreground": "text.default",
  "--popover-foreground": "text.default",
  "--muted-foreground": "text.muted",
  "--primary-foreground": "text.onInverse",
  "--accent-foreground": "text.onAccent",
  "--secondary": "action.subtle",
  "--secondary-foreground": "action.onSubtle",
  "--border": "border.default",
  "--input": "border.input",
  "--ring": "focus.ring",
  "--destructive": "feedback.danger",
  "--destructive-foreground": "feedback.onDanger",
  "--chart-1": "chart.1",
  "--chart-2": "chart.2",
  "--chart-3": "chart.3",
  "--chart-4": "chart.4",
  "--chart-5": "chart.5",
  "--sidebar-background": "sidebar.background",
  "--sidebar-foreground": "sidebar.foreground",
  "--sidebar-primary": "sidebar.primary",
  "--sidebar-primary-foreground": "sidebar.onPrimary",
  "--sidebar-accent": "sidebar.accent",
  "--sidebar-accent-foreground": "sidebar.onAccent",
  "--sidebar-border": "sidebar.border",
  "--sidebar-ring": "sidebar.ring",
};

/** Papéis vindos de base.json: iguais nos dois temas (o web não os troca no .dark). */
const BASE_JSON_ROLE: Record<string, string> = {
  "color.primary": "brand.default",
  "color.primary-dark": "brand.vivid",
  "color.primary-light": "brand.subtle",
  "color.secondary": "action.secondary",
  "color.success": "feedback.success",
  "color.warning": "feedback.warning",
  "color.info": "feedback.info",
  "color.background.primary": "surface.subtle",
  "color.background.card": "surface.translucent",
};

/** Papéis vindos dos tokens nomeados do tokens.css, iguais nos dois temas. */
const TOKEN_ROLE: Record<string, string> = {
  "--brand": "brand.default",
  "--brand-hover": "brand.hover",
  "--on-brand": "brand.onBrand",
  "--border-subtle": "border.subtle",
  "--border-strong": "border.strong",
  "--focus-halo": "focus.halo",
  "--focus-ring": "focus.keyboard",
  "--focus-border": "focus.border",
};

const role = (theme: SemanticTheme, path: string): string => {
  const [group, key] = path.split(".") as [keyof SemanticTheme, string];
  return (theme[group] as Record<string, string>)[key];
};

const leaves = (theme: SemanticTheme) =>
  Object.entries(theme).flatMap(([group, roles]) => Object.entries(roles as Record<string, string>).map(([key, value]) => [`${group}.${key}`, value] as const));

describe("semanticThemes", () => {
  const blocks = readThemeBlocks();

  it("cada variável de cor do :root e do .dark tem papel com o mesmo valor", () => {
    for (const [mode, block] of [["light", blocks.root], ["dark", blocks.dark]] as const) {
      const colorVars = Object.keys(block).filter((name) => /%\s*$/.test(block[name]));
      expect(colorVars.sort(), mode).toEqual(Object.keys(CSS_VAR_ROLE).sort());
      for (const name of colorVars) {
        expect(colorKey(role(semanticThemes[mode], CSS_VAR_ROLE[name])), `${mode} ${name}`).toBe(colorKey(block[name]));
      }
    }
  });

  it("papéis de base.json e tokens.css têm o valor da fonte nos dois temas", () => {
    const baseJson = readBaseJson();
    const tokens = readTokensCss();
    for (const mode of ["light", "dark"] as const) {
      for (const [key, path] of Object.entries(BASE_JSON_ROLE)) expect(colorKey(role(semanticThemes[mode], path)), `${mode} ${key}`).toBe(colorKey(baseJson[key]));
      for (const [key, path] of Object.entries(TOKEN_ROLE)) expect(colorKey(role(semanticThemes[mode], path)), `${mode} ${key}`).toBe(colorKey(tokens[key]));
    }
  });

  it("exemplos do mapa sem colisão: brand, surface.inverse, action.secondary, border.default", () => {
    expect(semanticThemes.light.brand.default).toBe("#ea580c");
    expect(semanticThemes.light.surface.inverse).toBe("#0f172a");
    expect(semanticThemes.light.action.secondary).toBe("#334155");
    expect(semanticThemes.light.border.default).toBe("#e2e8f0");
    expect(semanticThemes.dark.surface.inverse).toBe("#f8fafc");
  });

  it("todo papel aponta para um primitivo e os dois temas têm os mesmos papéis", () => {
    const primitiveValues = new Set<string>([...Object.values(primitives.color), ...Object.values(primitives.alpha)]);
    const lightPaths = leaves(semanticThemes.light).map(([path]) => path);
    expect(leaves(semanticThemes.dark).map(([path]) => path)).toEqual(lightPaths);
    const covered = new Set([...Object.values(CSS_VAR_ROLE), ...Object.values(BASE_JSON_ROLE), ...Object.values(TOKEN_ROLE), "text.strong", "action.onSecondary"]);
    for (const mode of ["light", "dark"] as const) {
      for (const [path, value] of leaves(semanticThemes[mode])) {
        expect(primitiveValues.has(value), `${mode} ${path} = ${value}`).toBe(true);
        expect(covered.has(path), `${path} sem fonte verificada`).toBe(true);
      }
    }
  });

  it("text.strong segue text-slate-900 / dark:text-slate-50 do Input e action.onSecondary o text-white do botão", () => {
    expect(semanticThemes.light.text.strong).toBe(primitives.color.slate900);
    expect(semanticThemes.dark.text.strong).toBe(primitives.color.slate50);
    expect(semanticThemes.light.action.onSecondary).toBe(primitives.color.white);
    expect(semanticThemes.dark.action.onSecondary).toBe(primitives.color.white);
  });
});
