import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthCallbackLoading, AuthCallbackPage } from "./AuthCallbackPage";

describe("AuthCallbackPage", () => {
  it("mostra Entrando e o fallback Carregando", () => {
    expect(renderToStaticMarkup(createElement(AuthCallbackPage))).toContain("Aguarde enquanto redirecionamos você");
    expect(renderToStaticMarkup(createElement(AuthCallbackLoading))).toContain("Carregando...");
  });
});
