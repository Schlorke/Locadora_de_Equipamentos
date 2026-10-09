import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EntrarPage } from "./EntrarPage";

const adapter = { getSession: async () => null, signInCredentials: async () => ({ ok: true }), push: () => undefined, signInProvider: async () => undefined };

describe("EntrarPage", () => {
  it("mantém o título, o botão e os links sem callback", () => {
    const html = renderToStaticMarkup(createElement(EntrarPage, adapter));
    expect(html).toContain("Entrar no Sistema");
    expect(html).toContain('href="/cadastro"');
    expect(html).toContain('href="/recuperar-senha"');
    expect(html).not.toContain("callbackUrl");
    expect(html).toContain("Google");
    expect(html).toContain("Facebook");
  });
});
