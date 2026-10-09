import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Textarea } from "./Textarea.web";

const classesOf = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/).filter(Boolean);

describe("Textarea", () => {
  it("mantém a altura mínima e o texto pequeno", () => {
    const html = renderToStaticMarkup(createElement(Textarea, { placeholder: "Mensagem" }));
    expect(html).toContain('placeholder="Mensagem"');
    expect(html).toContain("min-h-[80px]");
    expect(html).toContain("w-full");
    expect(html).toContain("rounded-md");
    expect(html).toContain("px-3");
    expect(html).toContain("py-2");
    expect(html).toContain("text-sm");
  });

  it("traz a moldura da área de texto, depois do className (sombra baixa, sombra elevada no hover, foco azul)", () => {
    const classes = classesOf(
      renderToStaticMarkup(createElement(Textarea, { className: "border-gray-200 shadow-md focus:shadow-md transition-colors duration-300" })),
    );
    for (const cls of [
      "border-field-legacy",
      "shadow-textarea",
      "hover-always:not-focus:shadow-raised",
      "focus:border-field-legacy-focus",
      "focus:shadow-control-focus",
      "focus:outline-0",
      "transition-all",
      "duration-200",
      "[transition-timing-function:ease]",
    ])
      expect(classes, cls).toContain(cls);
    for (const cls of ["border-input", "border-gray-200", "shadow-md", "focus:shadow-md", "transition-colors", "duration-300"])
      expect(classes, cls).not.toContain(cls);
  });
});
