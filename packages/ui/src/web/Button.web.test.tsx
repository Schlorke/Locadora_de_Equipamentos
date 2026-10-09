import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { themes } from "@gb-locacoes/design-tokens";
import { buttonVariantNames } from "../contract/button";
import { Button } from "./Button.web";

const render = (el: ReactElement) => renderToStaticMarkup(el);
// Set by tools/token-propagation-check.mjs, which points @gb-locacoes/design-tokens at a temporary
// copy whose primary color is this sentinel.
const expectedPrimary = process.env.EXPECT_PRIMARY?.toUpperCase();
const PALETTE_CLASS = /(?:^|[\s:"])((?:bg|text|border|from|via|to|ring|fill|stroke|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|(?:bg|text)-(?:white|black))(?=[\s"])/g;

describe.runIf(expectedPrimary)("Button (web) token propagation", () => {
  it("resolves @gb-locacoes/design-tokens to the module that carries the sentinel", () => {
    expect(themes.light.primary.toUpperCase()).toBe(expectedPrimary);
  });

  it("renders the primary token value in some variant", () => {
    const markup = buttonVariantNames.map((variant) => render(<Button variant={variant}>Alugar</Button>)).join("\n");
    const literal = [...new Set([...markup.matchAll(PALETTE_CLASS)].map((m) => m[1]))];
    expect(
      markup.toUpperCase(),
      `não propagado: nenhuma variante do Button.web contém ${expectedPrimary}; as cores vêm de classes Tailwind literais de packages/ui/src/contract/button.ts (${literal.join(", ") || "nenhuma de paleta; ver classes semânticas"}), não de @gb-locacoes/design-tokens`,
    ).toContain(expectedPrimary);
  });
});

describe("Button (web)", () => {
  it("renders the label as button text", () => {
    const html = render(<Button>Alugar</Button>);
    expect(html).toMatch(/^<button/);
    expect(html).toContain(">Alugar<");
    expect(html).toContain("bg-slate-700");
  });

  it("keeps the reset variant without scale or orange border", () => {
    const html = render(<Button variant="reset">Limpar</Button>);
    expect(html).toContain("hover:text-orange-500");
    expect(html).toContain("hover:shadow-lg");
    expect(html).not.toContain("hover:scale-105");
    expect(html).not.toContain("hover:border-orange-500");
  });

  it("header-action: sem borda nem sombra em repouso; sombra elevada no hover, aberto e na página atual", () => {
    const html = render(<Button variant="header-action" data-active>Carrinho</Button>);
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
    for (const cls of ["border-none", "hover-always:shadow-raised", "aria-expanded:shadow-raised", "data-[state=open]:shadow-raised", "data-active:shadow-raised", "hover:text-orange-600", "transition-all"])
      expect(classes, cls).toContain(cls);
    expect(classes.some((cls) => /^(border|shadow)-(?!none$)/.test(cls) && !cls.includes(":"))).toBe(false);
    expect(html).toContain('data-own-frame=""');
    expect(html).toContain('data-active="true"');
  });

  it("só as variantes com moldura própria ficam fora da moldura de gatilho (controls:)", () => {
    for (const variant of ["filter-reset", "header-action"] as const) expect(render(<Button variant={variant}>Limpar</Button>)).toContain('data-own-frame=""');
    for (const variant of ["default", "outline", "ghost", "reset"] as const) expect(render(<Button variant={variant}>Alugar</Button>)).not.toContain("data-own-frame");
  });

  it("does not emit a click target when disabled", () => {
    const html = render(<Button disabled>Alugar</Button>);
    expect(html).toContain("disabled");
    expect(html).toContain("disabled:pointer-events-none");
  });
});
