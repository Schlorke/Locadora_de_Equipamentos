import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FILTER_CARD } from "./field";
import { SearchBar } from "./SearchBar.web";

describe("Barra de busca", () => {
  it("usa o placeholder Buscar... e zera filtros em all", () => {
    const source = readFileSync(new URL("./SearchBar.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("searchPlaceholder = 'Buscar...'");
    expect(source).toContain("showResetButton = true");
    expect(source).toContain("onValueChange('all')");
    expect(source).toContain("onSearchChange('')");
    expect(source).toContain('title="Resetar filtros"');
    expect(source).toContain('size="md"');
    expect(source).toContain("FILTER_CARD");
    expect(source).toContain('variant="filter"');
    const native = readFileSync(new URL("../native/SearchBar.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("admin-filter-card");
  });

  it("renderiza o cartão de filtros elevado e a busca com a moldura dos filtros", () => {
    const html = renderToStaticMarkup(createElement(SearchBar, { onSearchChange: () => undefined }));
    const card = (/^<div[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
    for (const cls of ["admin-filter-card", "isolate", "contain-layout", "will-change-transform", "transform-gpu", "border-none", "outline-hidden", "shadow-raised-xl"])
      expect(card, cls).toContain(cls);
    // Sem contorno em nenhum modo: nas cores forçadas, o sólido transparente do outline-hidden fica com largura 0.
    for (const cls of FILTER_CARD.split(" ")) expect(card, cls).toContain(cls);
    expect(card).toContain("forced-colors:outline-0");
    expect(card).not.toContain("shadow-xl");
    const input = (/<input[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
    for (const cls of ["pl-9", "border-field-legacy", "focus:border-field-legacy-focus", "[transition-timing-function:ease-in-out]", "focus:outline-offset-0"]) expect(input, cls).toContain(cls);
    expect(input).not.toContain("admin-filter-element");
  });
});
