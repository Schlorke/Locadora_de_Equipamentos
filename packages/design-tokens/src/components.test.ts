// Tokens de componente derivados do web aprovado. Os testes leem as classes dos componentes
// web para provar a origem de cada medida e falham se o web mudar sem o token acompanhar.
import { describe, expect, it } from "vitest";
import { componentSpecs } from "./components";
import { primitives } from "./primitives";
import { semanticThemes } from "./semantic";
import { readRepoFile } from "./__tests__/web-sources";

/**
 * Trecho literal da fonte em que `"` aceita aspas simples ou duplas: a formatação do arquivo (o Prettier do projeto usa
 * aspas simples) não muda a classe; o resto do trecho continua exato (achado 141).
 */
const sourceSnippet = (snippet: string) =>
  new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/"/g, `["']`));

const light = componentSpecs(semanticThemes.light);
const dark = componentSpecs(semanticThemes.dark);

const colorLeaves = (node: unknown, path = ""): Array<[string, string]> => {
  if (typeof node === "string") return /^(#|rgba?\()/.test(node) ? [[path, node]] : [];
  if (!node || typeof node !== "object" || Array.isArray(node)) return [];
  return Object.entries(node).flatMap(([key, child]) => colorLeaves(child, path ? `${path}.${key}` : key));
};

describe("componentSpecs", () => {
  it("button: raio 6, padding 16, peso 500 (rounded-md px-4 font-medium)", () => {
    const contract = readRepoFile("packages/ui/src/contract/button.ts");
    for (const cls of ["rounded-md", "font-medium", "gap-2", "[&_svg]:size-4", "duration-200", "disabled:opacity-50", "hover:scale-105", "hover:bg-secondary/80", "hover:bg-destructive/90"])
      expect(contract).toContain(cls);
    expect(primitives.opacity["90"]).toBe(0.9);
    expect(light.button.hoverScale).toBe(1.05);
    expect(contract).toMatch(sourceSnippet('default: "h-10 px-4 py-2 text-sm"'));
    expect(contract).toContain("bg-slate-700 text-white border border-slate-700 shadow-md");
    expect(light.button.radius).toBe(6);
    expect(light.button.size.default).toStrictEqual({ height: 40, paddingX: 16, paddingY: 8, fontSize: 14, lineHeight: 20 });
    expect(light.button.fontWeight).toBe("500");
    expect(light.button.gap).toBe(8);
    expect(light.button.iconSize).toBe(16);
    expect(light.button.disabledOpacity).toBe(0.5);
    expect(light.button.transitionMs).toBe(200);
    expect(light.button.variant.default).toStrictEqual({ background: "#334155", color: "#ffffff", border: "#334155", borderWidth: 1 });
  });

  it("badge: raio cheio, 12px semibold, fundo #0f172a (bg-primary)", () => {
    const badge = readRepoFile("packages/ui/src/web/Badge.web.tsx");
    expect(badge).toContain("rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight");
    expect(badge).toMatch(sourceSnippet('default: "bg-primary text-primary-foreground hover:bg-primary/80"'));
    expect(light.badge.radius).toBe(primitives.radius.full);
    expect(light.badge.fontSize).toBe(12);
    expect(light.badge.fontWeight).toBe("600");
    expect([light.badge.paddingX, light.badge.paddingY]).toEqual([10, 2]);
    expect(light.badge.lineHeight).toBe(1.25);
    expect(light.badge.variant.default).toStrictEqual({ background: "#0f172a", color: "#f8fafc" });
    expect(dark.badge.variant.default).toStrictEqual({ background: "#f8fafc", color: "#0f172a" });
  });

  it("input: h-10 rounded-md px-3 py-2, borda gray-200 e halo de foco de 3px da moldura dos campos", () => {
    const input = readRepoFile("packages/ui/src/web/Input.web.tsx");
    expect(input).toContain("flex h-10 w-full rounded-md border border-input bg-background text-slate-900 dark:text-slate-50 px-3 py-2 text-base");
    expect(input).toContain("FIELD_FRAME");
    expect(readRepoFile("packages/ui/src/web/field.ts")).toMatch(/FIELD_FRAME = \[\s*["']border-field shadow-control .*focus:border-field-focus focus:shadow-control-focus/);
    const entry = readRepoFile("packages/frontend/src/app/styles/globals.web.css");
    expect(entry).toContain("--color-field: var(--color-gray-200);");
    expect(entry).toContain("--color-field-focus: var(--color-blue-500);");
    const tokens = readRepoFile("packages/design-tokens/src/tokens.css");
    expect(tokens).toMatch(/--shadow-control-focus: [^;]*, 0 0 0 3px var\(--focus-halo\);/);
    expect(tokens).toContain("--focus-halo: rgb(59 130 246 / 10%);");
    expect([light.input.height, light.input.radius, light.input.paddingX, light.input.paddingY]).toEqual([40, 6, 12, 8]);
    expect([light.input.fontSize, light.input.fontSizeMd]).toEqual([16, 14]);
    expect(light.input.border).toBe("#e5e7eb");
    expect(light.input.color).toBe("#0f172a");
    expect(dark.input.color).toBe("#f8fafc");
    expect(light.input.focus).toStrictEqual({ border: "#3b82f6", outlineWidth: 2, haloColor: "rgba(59, 130, 246, 0.1)", haloWidth: 3 });
  });

  it("card: rounded-lg border shadow-sm, seções p-6, título text-2xl semibold", () => {
    const card = readRepoFile("packages/ui/src/web/Card.web.tsx");
    expect(card).toContain("rounded-lg border bg-card text-card-foreground shadow-sm");
    expect(card).toContain("text-2xl font-semibold leading-none tracking-tight");
    expect(light.card.radius).toBe(8);
    expect(light.card.padding).toBe(24);
    expect(light.card.headerGap).toBe(6);
    expect(light.card.shadow).toBe(primitives.tailwindShadow.sm);
    expect(light.card.title).toStrictEqual({ fontSize: 24, fontWeight: "600", lineHeight: 1, letterSpacing: -0.015 });
    expect([light.card.background, light.card.border, light.card.color]).toEqual(["#ffffff", "#e2e8f0", "#020817"]);
  });

  it("toda cor de componente é um papel semântico do tema recebido", () => {
    for (const [mode, specs] of [["light", light], ["dark", dark]] as const) {
      const roles = new Set(
        Object.values(semanticThemes[mode]).flatMap((group) => Object.values(group as Record<string, string>)),
      );
      const leaves = colorLeaves(specs);
      expect(leaves.length).toBeGreaterThan(20);
      for (const [path, value] of leaves) expect(roles.has(value), `${mode} ${path} = ${value}`).toBe(true);
    }
  });
});
