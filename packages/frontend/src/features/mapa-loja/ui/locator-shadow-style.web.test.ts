// @vitest-environment jsdom
// Folha do modo simplificado do localizador: vai ao FIM de adoptedStyleSheets (depois da folha do componente, que ela
// precisa vencer sem !important), sem tirar as que já estão lá e sem duplicar. A cascata em si (a folha adotada por
// último vence a do componente com a mesma especificidade) só existe no navegador: o jsdom não implementa
// adoptedStyleSheets nem a cascata do Shadow DOM.
import { describe, expect, it } from "vitest";
import { SIMPLIFIED_LOCATOR_CSS, adoptSheetLast, adoptSimplifiedLocatorStyle } from "./locator-shadow-style.web";

const sheet = (css: string) => {
  const s = new CSSStyleSheet();
  s.replaceSync(css);
  return s;
};

describe("adoptSheetLast", () => {
  it("acrescenta depois das folhas do componente, sem removê-las, e não duplica", () => {
    const own = sheet(".section-name { font: inherit }");
    const other = sheet("a { color: inherit }");
    const extra = sheet(".section-name { display: none }");
    const root = { adoptedStyleSheets: [own, other] };
    adoptSheetLast(root, extra);
    expect(root.adoptedStyleSheets).toEqual([own, other, extra]);
    adoptSheetLast(root, extra);
    expect(root.adoptedStyleSheets).toEqual([own, other, extra]);
  });
});

describe("adoptSimplifiedLocatorStyle", () => {
  it("adota uma única folha construída, compartilhada entre raízes, com o CSS do modo simplificado", () => {
    const own = sheet(":host { display: block }");
    const a = { adoptedStyleSheets: [own] };
    const b = { adoptedStyleSheets: [] as CSSStyleSheet[] };
    adoptSimplifiedLocatorStyle(a);
    adoptSimplifiedLocatorStyle(a);
    adoptSimplifiedLocatorStyle(b);
    expect(a.adoptedStyleSheets).toHaveLength(2);
    expect(a.adoptedStyleSheets[0]).toBe(own);
    expect(b.adoptedStyleSheets).toEqual([a.adoptedStyleSheets[1]]);
    const selectors = Array.from(a.adoptedStyleSheets[1]!.cssRules, (rule) => (rule as CSSStyleRule).selectorText.replace(/\s+/g, " "));
    expect(selectors.some((s) => s.split(",").map((part) => part.trim()).includes(".section-name"))).toBe(true);
    expect(selectors).toContain("*");
  });

  it("não usa !important e repete os seletores do componente que definem cor de borda", () => {
    expect(SIMPLIFIED_LOCATOR_CSS).not.toMatch(/!\s*important/i);
    for (const selector of ["button", "#location-results-list .result-item", "#location-results-list .result-item:first-of-type", "#location-results-list .result-item:last-of-type"])
      expect(SIMPLIFIED_LOCATOR_CSS).toContain(selector);
  });
});
