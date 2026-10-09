// Mapa da loja com o local da própria locadora (achado 143). O teste anterior conferia o código-fonte e afirmava o
// defeito: título, endereço, coordenadas e Place ID da GB no mapa de qualquer locadora.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleStoreLocator } from "./Mapa.web";

vi.mock("next/script", () => ({ default: () => null }));

afterEach(() => vi.unstubAllEnvs());

describe("Mapa da loja", () => {
  it("sem chave do Google e com o local da locadora: o aviso de configuração, como antes", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    expect(
      renderToStaticMarkup(
        createElement(GoogleStoreLocator, {
          simplified: true,
          location: { title: "Locadora Alfa", address1: "Rua A, 10", coords: { lat: -25.4, lng: -49.3 } },
        }),
      ),
    ).toContain("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa.");
  });

  it("sem o local da locadora: nada, nem o aviso de configuração (onda 134; o cartão do mapa sai)", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { simplified: true }))).toBe("");
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { location: null }))).toBe("");
  });

  it("com a chave e sem o local da locadora: nenhum mapa (nunca o endereço de outra locadora)", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "AIzaRealLookingKey123");
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { simplified: true }))).toBe("");
  });

  it("com a chave e o local da locadora: o localizador", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "AIzaRealLookingKey123");
    const html = renderToStaticMarkup(
      createElement(GoogleStoreLocator, {
        location: { title: "Locadora Alfa", address1: "Rua A, 10", coords: { lat: -25.4, lng: -49.3 } },
      }),
    );
    expect(html).toContain("<gmpx-store-locator");
    expect(html).toContain('solution-channel="GMP_QB_locatorplus_v11_cABCDE"');
  });

  // Segunda rodada da onda 134: a moldura do cartão "Onde estamos" (altura e borda da produção, eb4c0098
  // app/contato/page.tsx:296) mora no mapa, sem exceção do gate de tokens na página; o aviso sem chave usa a mesma.
  it("moldura do cartão: a classe da produção no aviso sem chave e no localizador; sem moldura, a padrão", () => {
    const local = { title: "Locadora Alfa", address1: "Rua A, 10", coords: { lat: -25.4, lng: -49.3 } };
    const CARTAO = 'class="h-[400px] w-full overflow-hidden rounded-xl border border-slate-200 md:h-[450px]"';
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { location: local, moldura: "cartao" }))).toBe(
      `<div ${CARTAO}><p class="text-center text-sm">Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa.</p></div>`,
    );
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { location: local }))).toContain(
      'class="flex h-[400px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"',
    );
    // A classe recebida tem precedência (o contato da home passa a dele).
    expect(
      renderToStaticMarkup(createElement(GoogleStoreLocator, { location: local, moldura: "cartao", className: "h-[320px] w-full" })),
    ).toContain('<div class="h-[320px] w-full">');
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "AIzaRealLookingKey123");
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { location: local, moldura: "cartao" }))).toContain(
      `<div ${CARTAO} style=`,
    );
    expect(renderToStaticMarkup(createElement(GoogleStoreLocator, { location: local }))).toContain(
      '<div class="h-[400px] w-full overflow-hidden rounded-xl" style=',
    );
  });

  it("mantém a biblioteca, o canal e o zoom do localizador, sem nenhum local fixo", () => {
    const source = readFileSync(new URL("./Mapa.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("zoom: 15");
    expect(source).toContain("maxZoom: 17");
    expect(source).toContain("extended-component-library/0.6.11");
    expect(source).not.toMatch(/GB Loca|Heinzelmann|-29\.99|ChIJ/);
  });
});
