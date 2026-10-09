import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FilterResetButton } from "./FilterResetButton.web";

describe("Botão de resetar filtros", () => {
  it("pinta o ícone de laranja no hover e não aplica zoom nem borda laranja", () => {
    const source = readFileSync(new URL("./FilterResetButton.web.tsx", import.meta.url), "utf8");
    const button = source.slice(source.indexOf("return ("));
    expect(source).toContain("title = 'Resetar filtros'");
    expect(source).toContain("variant=\"filter-reset\"");
    expect(source).toContain("group-hover:text-orange-500");
    expect(source).toContain("sm: 'w-8 h-8 min-w-8 shrink-0'");
    expect(source).toContain("}, 600)");
    expect(button).not.toContain("hover:scale-105");
    expect(button).not.toContain("hover:border-orange-500");
    const native = readFileSync(new URL("../native/FilterResetButton.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("hover:scale-105");
  });

  it("usa a variante filter-reset do Button, sem a antiga classe global filter-reset-button", () => {
    const html = renderToStaticMarkup(createElement(FilterResetButton, { onClick: () => undefined, size: "md" }));
    expect(html).toContain('title="Resetar filtros"');
    expect(html).toContain('aria-label="Resetar filtros"');
    expect(html).toContain("hover:text-orange-500");
    expect(html).toContain("w-10 h-10 min-w-10 shrink-0");
    expect(html).not.toContain("filter-reset-button");
  });
});
