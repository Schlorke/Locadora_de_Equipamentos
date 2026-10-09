// @vitest-environment jsdom
// No web, `lineHeight` numérico no style do React vira `line-height: 24` (24 vezes o tamanho da fonte, ~384px), não
// 24px como no React Native. O Text do design system grava a altura de linha da escala de tokens em px.
import { typography } from "@gb-locacoes/design-tokens";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Text } from "./Text.web";

const styleOf = (html: string) => {
  const style = /style="([^"]*)"/.exec(html)?.[1] ?? "";
  return Object.fromEntries(
    style
      .split(";")
      .filter(Boolean)
      .map((decl) => decl.split(":").map((part) => part.trim()) as [string, string]),
  );
};

describe("Text (web)", () => {
  it("grava a altura de linha em px, da escala de tokens, em cada tamanho", () => {
    for (const size of Object.keys(typography.size) as (keyof typeof typography.size)[]) {
      const style = styleOf(renderToStaticMarkup(createElement(Text, { size, children: "Área restrita" })));
      expect(style["line-height"], size).toBe(`${typography.lineHeight[size]}px`);
      expect(style["font-size"], size).toBe(`${typography.size[size]}px`);
    }
  });

  it("a altura de linha computada no navegador é a dos tokens, não um múltiplo da fonte", () => {
    const html = renderToStaticMarkup(createElement(Text, { children: "Carrinho de outra locadora" }));
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const paragraph = host.querySelector("p")!;
    expect(paragraph.style.lineHeight).toBe(`${typography.lineHeight.md}px`);
    host.remove();
  });

  it("título usa h1-h3 com a mesma altura de linha em px", () => {
    const html = renderToStaticMarkup(createElement(Text, { heading: 2, size: "xl", children: "Assinatura" }));
    expect(html.startsWith("<h2")).toBe(true);
    expect(styleOf(html)["line-height"]).toBe(`${typography.lineHeight.xl}px`);
  });
});
