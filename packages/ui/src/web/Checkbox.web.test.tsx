import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox.web";
import { HALO_FOCUS_OUTLINE } from "./focus-ring";

const classesOf = (html: string) => (/<button[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/).filter(Boolean);
const FRAME = [
  "border-checkbox",
  "hover-always:border-checkbox-checked",
  "focus:border-checkbox-checked",
  "focus:shadow-checkbox-focus",
  ...HALO_FOCUS_OUTLINE.split(" "),
  "data-[state=checked]:bg-checkbox-checked",
  "data-[state=checked]:border-checkbox-checked",
  "data-[state=checked]:text-white",
  "data-[state=checked]:hover-always:bg-checkbox-checked-hover",
  "data-[state=checked]:hover-always:border-checkbox-checked-hover",
];

describe("Checkbox", () => {
  it("mantém o tamanho e o laranja marcado", () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { checked: true, variant: "default" }));
    expect(html).toContain("h-4");
    expect(html).toContain("w-4");
    expect(html).toContain("data-state=\"checked\"");
    expect(classesOf(html)).toContain("data-[state=checked]:bg-checkbox-checked");
  });

  it("traz a moldura da caixa de seleção (cinza, laranja no hover e no foco, laranja cheio marcada)", () => {
    const classes = classesOf(renderToStaticMarkup(createElement(Checkbox, {})));
    for (const cls of FRAME) expect(classes, cls).toContain(cls);
  });

  it("foco sem contorno, só o halo; nas cores forçadas (o halo some), contorno de 2px só no teclado, nunca no clique", () => {
    // focus:outline-hidden grava nas cores forçadas um sólido transparente que o sistema pinta também no clique; a
    // largura vai a 0 no :focus e volta a 2px só no :focus-visible (Tab). Estilo por elemento contra a produção e a
    // regra do foco: "caixa de seleção" em tests/visual/tailwind-parity.test.ts. O contorno da caixa renderizada é só
    // o de HALO_FOCUS_OUTLINE (nenhuma outra classe de contorno), nas duas variantes.
    expect(HALO_FOCUS_OUTLINE.split(" ")).toEqual([
      "focus:outline-hidden",
      "forced-colors:focus:outline-0",
      "forced-colors:focus-visible:outline-2",
    ]);
    for (const variant of ["default", "header"] as const) {
      const classes = classesOf(renderToStaticMarkup(createElement(Checkbox, { variant })));
      expect(classes.filter((cls) => /outline/.test(cls)), variant).toEqual(HALO_FOCUS_OUTLINE.split(" "));
    }
  });

  it("a moldura vem depois do className: cores do consumidor não trocam a caixa marcada", () => {
    const classes = classesOf(
      renderToStaticMarkup(
        createElement(Checkbox, { className: "mt-1 h-5 w-5 border-slate-300 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700" }),
      ),
    );
    expect(classes).toContain("mt-1");
    expect(classes).toContain("h-5");
    for (const cls of FRAME) expect(classes, cls).toContain(cls);
    for (const cls of ["border-slate-300", "data-[state=checked]:bg-slate-700", "data-[state=checked]:border-slate-700"]) expect(classes, cls).not.toContain(cls);
  });

  it("variante de cabeçalho: fundo branco enquanto desmarcada e a mesma moldura", () => {
    const classes = classesOf(renderToStaticMarkup(createElement(Checkbox, { variant: "header" })));
    expect(classes).toContain("bg-white");
    for (const cls of FRAME) expect(classes, cls).toContain(cls);
  });
});
