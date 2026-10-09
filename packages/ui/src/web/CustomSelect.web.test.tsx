import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CustomSelect, CustomSelectItem } from "./CustomSelect.web";

const triggerClasses = (value?: string) => {
  const html = renderToStaticMarkup(
    createElement(CustomSelect, {
      value,
      onValueChange: () => undefined,
      triggerId: "categoria",
      children: [
        createElement(CustomSelectItem, { key: "all", value: "all", children: "Todas" }),
        createElement(CustomSelectItem, { key: "a", value: "a", children: "Andaimes" }),
      ],
    }),
  );
  return (/<button[^>]*id="categoria"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/).filter(Boolean);
};

describe("CustomSelect", () => {
  it("o gatilho traz a moldura dos controles de filtro, sem a antiga classe global", () => {
    const classes = triggerClasses("all");
    for (const cls of [
      "border-field-legacy",
      "shadow-control",
      "hover-always:not-focus:shadow-control-hover",
      "focus:border-field-legacy-focus",
      "focus:shadow-control-focus",
      "focus:outline-hidden",
      "focus:outline-0",
      "focus:outline-offset-0",
      "[transition-timing-function:ease-in-out]",
      "bg-background",
    ])
      expect(classes, cls).toContain(cls);
    expect(classes).not.toContain("admin-filter-element");
    expect(classes).not.toContain("selected");
    expect(classes).not.toContain("border-filter-selected-border");
  });

  it("com um valor escolhido, o filtro fica laranja (borda, fundo e texto) e o foco continua azul", () => {
    const classes = triggerClasses("a");
    for (const cls of ["border-filter-selected-border", "bg-filter-selected-surface", "text-filter-selected", "focus:border-field-legacy-focus"])
      expect(classes, cls).toContain(cls);
    expect(classes).not.toContain("border-field-legacy");
    expect(classes).not.toContain("bg-background");
  });
});
