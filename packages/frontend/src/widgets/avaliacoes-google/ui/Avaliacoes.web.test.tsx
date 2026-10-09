// Avaliações do Google com a conta da própria locadora (achado 143). O teste anterior afirmava o defeito: a conta do
// Merchant Center da GB (`const MERCHANT_ID = 5721491678`) no opt-in e no selo de qualquer locadora.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GoogleCustomerReviews, GoogleMerchantBadge } from "./Avaliacoes.web";

vi.mock("next/script", () => ({ default: (props: { src: string }) => createElement("script", { src: props.src }) }));

describe("Avaliações do Google", () => {
  it("sem o ID do Merchant Center da locadora: nem opt-in nem selo", () => {
    expect(renderToStaticMarkup(createElement(GoogleCustomerReviews, { orderId: "q-1", customerEmail: "c@x.test" }))).toBe("");
    expect(renderToStaticMarkup(createElement(GoogleMerchantBadge, { position: "INLINE" }))).toBe("");
  });

  it("com o ID da locadora: carrega o script e o contêiner do selo", () => {
    const html = renderToStaticMarkup(createElement(GoogleMerchantBadge, { merchantId: "123456", position: "INLINE" }));
    expect(html).toContain('id="google-merchant-badge"');
    expect(html).toContain("https://www.gstatic.com/shopping/merchant/merchantwidget.js");
    expect(
      renderToStaticMarkup(createElement(GoogleCustomerReviews, { merchantId: "123456", orderId: "q-1", customerEmail: "c@x.test" })),
    ).toContain("https://apis.google.com/js/platform.js?onload=renderOptIn");
  });

  it("mantém o opt-in de 7 dias e o selo inline no Brasil, sem conta fixa", () => {
    const source = readFileSync(new URL("./Avaliacoes.web.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/MERCHANT_ID\s*=|5721491678/);
    expect(source).toContain("deliveryCountry = 'BR'");
    expect(source).toContain("7 * 24 * 60 * 60 * 1000");
    expect(source).toContain('id="merchantWidgetScript"');
    expect(source).toContain("position = 'INLINE'");
    expect(source).toContain("region = 'BR'");
    expect(source).toContain('strategy="lazyOnload"');
    // Sem log de depuração no navegador (os console.log de "Script carregado" e "Selo inicializado" saíram).
    expect(source).not.toContain("console.log(");
  });
});
