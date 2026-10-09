import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CadastroPage } from "./CadastroPage";

const adapter = { push: () => undefined, signInProvider: async () => undefined };

describe("CadastroPage", () => {
  it("mantém o título e o link de login", () => {
    const html = renderToStaticMarkup(createElement(CadastroPage, adapter));
    expect(html).toContain("Criar Conta");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Faça login");
  });

  it("preserva o callback no link de login", () => {
    const html = renderToStaticMarkup(createElement(CadastroPage, { ...adapter, callbackUrl: "/equipamentos" }));
    expect(html).toContain('href="/login?callbackUrl=%2Fequipamentos"');
  });
});
