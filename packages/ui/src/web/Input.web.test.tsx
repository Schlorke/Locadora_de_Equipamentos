import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Input } from "./Input.web";

const classesOf = (html: string) => (/<input[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(/\s+/).filter(Boolean);

describe("Input", () => {
  it("mantém a altura do campo de texto", () => {
    const html = renderToStaticMarkup(createElement(Input, { type: "text", placeholder: "Nome" }));
    expect(html).toContain('placeholder="Nome"');
    expect(html).toContain("h-10");
    expect(html).toContain("w-full");
    expect(html).toContain("rounded-md");
    expect(html).not.toContain("Incrementar");
  });

  it("mostra incrementar e decrementar no número", () => {
    const html = renderToStaticMarkup(createElement(Input, { type: "number" }));
    expect(html).toContain('aria-label="Incrementar"');
    expect(html).toContain('aria-label="Decrementar"');
    expect(html).toContain("text-orange-600");
  });

  it("traz a moldura do campo (borda cinza, sombra no hover, borda azul e halo no foco, sem contorno)", () => {
    for (const type of ["text", "number"]) {
      const classes = classesOf(renderToStaticMarkup(createElement(Input, { type })));
      for (const cls of [
        "border",
        "border-field",
        "shadow-control",
        "hover-always:not-focus:shadow-control-hover",
        "focus:border-field-focus",
        "focus:shadow-control-focus",
        "focus:outline-hidden",
        "focus:outline-0",
        "transition-all",
        "duration-200",
      ])
        expect(classes, `${type}: ${cls}`).toContain(cls);
    }
  });

  it("a moldura vem depois do className: o consumidor não troca borda, sombra nem contorno", () => {
    const classes = classesOf(
      renderToStaticMarkup(
        createElement(Input, {
          className: "pl-9 border-slate-300 focus:border-orange-500 shadow-sm hover:shadow-md focus:shadow-lg focus:outline-2",
        }),
      ),
    );
    expect(classes).toContain("pl-9");
    expect(classes).toContain("border-field");
    expect(classes).toContain("focus:shadow-control-focus");
    expect(classes).toContain("hover-always:not-focus:shadow-control-hover");
    for (const cls of ["border-input", "border-slate-300", "focus:border-orange-500", "shadow-sm", "focus:shadow-lg", "focus:outline-2"])
      expect(classes, cls).not.toContain(cls);
  });

  it("variante filter: moldura dos controles de filtro do painel", () => {
    const classes = classesOf(renderToStaticMarkup(createElement(Input, { variant: "filter", className: "pl-9" })));
    for (const cls of ["border-field-legacy", "focus:border-field-legacy-focus", "shadow-control", "[transition-timing-function:ease-in-out]", "focus:outline-offset-0"])
      expect(classes, cls).toContain(cls);
    expect(classes).not.toContain("border-field");
    expect(classes).not.toContain("focus:border-field-focus");
    expect(renderToStaticMarkup(createElement(Input, { variant: "filter" }))).not.toContain("variant=");
  });
});
