import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select, SelectTrigger, SelectValue } from "./Select.web";

describe("Select", () => {
  it("abre embaixo com deslocamento 1 e sem modal por padrão", () => {
    const source = readFileSync(new URL("./Select.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("modal = false");
    expect(source).toContain('side="bottom"');
    expect(source).toContain("sideOffset={1}");
    expect(source).toContain("position = 'popper'");
    expect(source).toContain("z-[var(--layer-tooltip)]");
    expect(source).toContain("hover:bg-orange-50 hover:text-orange-600");
    expect(source).toContain("h-10 w-full");
    expect(source).toContain("filter-dropdown-scroll");
    expect(source).toContain("data-scroll-locked");
    const native = readFileSync(new URL("../native/Select.native.tsx", import.meta.url), "utf8");
    expect(native).not.toContain("hover:bg-orange-50");
  });

  it("o gatilho traz a moldura do campo, depois do className (a cor de borda do consumidor não vale)", () => {
    const html = renderToStaticMarkup(
      createElement(Select, null, createElement(SelectTrigger, { className: "w-40 border-slate-200 shadow-sm" }, createElement(SelectValue, { placeholder: "Status" }))),
    );
    const classes = (/<button[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/);
    for (const cls of ["w-40", "border-field", "shadow-control", "hover-always:not-focus:shadow-control-hover", "focus:border-field-focus", "focus:shadow-control-focus", "focus:outline-hidden", "focus:outline-0"])
      expect(classes, cls).toContain(cls);
    for (const cls of ["border-input", "border-slate-200", "shadow-sm"]) expect(classes, cls).not.toContain(cls);
  });
});
