import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "../contract/button";
import { Button } from "./Button.web";
import { FilterResetButton } from "./FilterResetButton.web";

// Regra do usuário para os botões de reset (resetar filtros e restaurar configurações): no hover, texto/ícone laranja
// (hover:text-orange-500) e sombra maior (hover:shadow-lg; no reset de filtro, a sombra elevada shadow-raised-lg, que
// também vale depois de um toque); nunca borda laranja nem escala.
const split = (value: string) => value.split(/\s+/).filter(Boolean);
const classesOf = (html: string) => split(/class="([^"]*)"/.exec(html)?.[1] ?? "");
const FORBIDDEN = [/(^|:)border-orange-/, /(^|:)-?scale-/];
const forbiddenIn = (classes: string[]) => classes.filter((cls) => FORBIDDEN.some((pattern) => pattern.test(cls)));

describe("Button: variantes de reset", () => {
  it("filter-reset (resetar filtros): texto laranja 500 e sombra maior no hover, sem borda laranja nem escala", () => {
    const classes = split(buttonVariants({ variant: "filter-reset" }));
    for (const cls of ["hover:text-orange-500", "shadow-control", "hover-always:shadow-raised-lg", "focus:shadow-raised-lg"]) expect(classes, cls).toContain(cls);
    expect(forbiddenIn(classes)).toEqual([]);
  });

  it("reset (restaurar configurações): texto laranja 500 e sombra maior no hover, sem borda laranja nem escala", () => {
    const classes = split(buttonVariants({ variant: "reset" }));
    for (const cls of ["hover:text-orange-500", "shadow-md", "hover:shadow-lg"]) expect(classes, cls).toContain(cls);
    expect(forbiddenIn(classes)).toEqual([]);
  });

  it("o botão de resetar filtros renderiza a variante filter-reset sem acrescentar borda laranja nem escala", () => {
    const html = renderToStaticMarkup(createElement(FilterResetButton, { onClick: () => undefined }));
    const classes = classesOf(html);
    for (const cls of ["hover:text-orange-500", "hover-always:shadow-raised-lg", "border-field"]) expect(classes, cls).toContain(cls);
    expect(forbiddenIn(classes)).toEqual([]);
    expect(html).toContain('data-own-frame=""');
    expect(forbiddenIn(classesOf(renderToStaticMarkup(createElement(Button, { variant: "reset" }, "Resetar"))))).toEqual([]);
  });
});
