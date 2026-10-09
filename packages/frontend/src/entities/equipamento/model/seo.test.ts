// SEO do equipamento com a locadora dona (achado 143; T12 e Lote 5 da ADR adr-tenant-hosts). O teste anterior
// afirmava o defeito: título, canonical, imagem e trilha com o nome e o domínio da GB para qualquer locadora.
import { describe, expect, it } from "vitest";
import {
  buildEquipmentBreadcrumbs,
  buildEquipmentProductStructuredData,
  buildEquipmentSeo,
  buildEquipmentSeoDescription,
} from "./seo";

const equipment = {
  id: "abc",
  name: "Betoneira",
  description: "Equipamento para concreto",
  images: ["/foto.jpg"],
  available: true,
  pricePerDay: 100,
  category: { name: "Concreto" },
};
const LOJA = { name: "Locadora Alfa", origin: "https://locadora-alfa.example.test/", city: "Curitiba", state: "PR" };
const DADOS_DA_GB = /GB Loca|locacoesgb|Porto Alegre/i;

describe("SEO do equipamento", () => {
  it("monta título, descrição curta e imagem absoluta com a locadora dona", () => {
    const seo = buildEquipmentSeo(equipment, "abc", LOJA);
    expect(seo.title).toBe("Aluguel de Betoneira em Curitiba | Locadora Alfa");
    expect(seo.description).toBe("Equipamento para concreto... Solicite seu orçamento em Curitiba!");
    expect(seo.canonicalUrl).toBe("https://locadora-alfa.example.test/equipamentos/abc");
    expect(seo.imageUrl).toBe("https://locadora-alfa.example.test/foto.jpg");
    expect(seo.openGraphTitle).toBe("Aluguel de Betoneira | Locadora Alfa");
    expect(seo.imageAlt).toBe("Betoneira para locação - Locadora Alfa");
    expect(seo.keywords).toEqual([
      "aluguel betoneira",
      "locação betoneira",
      "equipamentos construção civil curitiba",
      "locadora alfa",
      "concreto",
      "locação equipamentos obras",
    ]);
  });

  it("sem a locadora: caminhos relativos e nenhum nome ou cidade de outra locadora", () => {
    const seo = buildEquipmentSeo(equipment, "abc");
    expect(seo.title).toBe("Aluguel de Betoneira");
    expect(seo.canonicalUrl).toBe("/equipamentos/abc");
    expect(seo.imageUrl).toBe("/foto.jpg");
    expect(seo.openGraphTitle).toBe("Aluguel de Betoneira");
    expect(JSON.stringify(seo)).not.toMatch(DADOS_DA_GB);
  });

  it("corta a descrição em 160 caracteres", () => {
    const long = "a".repeat(200);
    const description = buildEquipmentSeoDescription({ name: "X", description: long });
    expect(description).toHaveLength(160);
    expect(description.endsWith("...")).toBe(true);
  });

  it("usa o texto padrão quando não há descrição, com a cidade só se a locadora tiver", () => {
    expect(buildEquipmentSeoDescription({ name: "Andaime", description: null }, "Curitiba")).toBe(
      "Aluguel de Andaime para construção civil. Locação profissional em Curitiba. Solicite seu orçamento!",
    );
    expect(buildEquipmentSeoDescription({ name: "Andaime", description: null })).toBe(
      "Aluguel de Andaime para construção civil. Solicite seu orçamento!",
    );
  });

  it("marca estoque, o miolo do produto e a locadora como marca e vendedora", () => {
    const product = buildEquipmentProductStructuredData(equipment, "abc", LOJA);
    expect(product.offers.availability).toBe("https://schema.org/InStock");
    expect(product.offers.price).toBe(100);
    expect(product.offers.priceCurrency).toBe("BRL");
    expect(product.offers.url).toBe("https://locadora-alfa.example.test/equipamentos/abc");
    expect(product.sku).toBe("abc");
    expect(product.category).toBe("Concreto");
    expect(product).toMatchObject({
      brand: "Locadora Alfa",
      manufacturer: "Locadora Alfa",
      seller: { name: "Locadora Alfa", url: "https://locadora-alfa.example.test" },
      // UF de entrega da própria locadora (antes, "RS" fixo da GB no JSON-LD).
      shippingRegion: "PR",
    });
    expect(buildEquipmentProductStructuredData(equipment, "abc", { ...LOJA, state: "pr" }).shippingRegion).toBe("PR");
    expect(buildEquipmentProductStructuredData(equipment, "abc", { ...LOJA, state: "Paraná" })).not.toHaveProperty("shippingRegion");

    const missing = buildEquipmentProductStructuredData({ ...equipment, available: false, description: null }, "abc");
    expect(missing.offers.availability).toBe("https://schema.org/OutOfStock");
    expect(missing.description).toBe("Aluguel de Betoneira para construção civil");
    expect(missing).not.toHaveProperty("brand");
    expect(missing).not.toHaveProperty("seller");
    expect(missing).not.toHaveProperty("shippingRegion");
    expect(JSON.stringify(missing)).not.toMatch(DADOS_DA_GB);
  });

  it("monta os quatro passos do breadcrumb na origem da locadora (ou relativos)", () => {
    expect(buildEquipmentBreadcrumbs(equipment, "abc", "concreto", LOJA.origin).map((crumb) => crumb.url)).toEqual([
      "https://locadora-alfa.example.test",
      "https://locadora-alfa.example.test/equipamentos",
      "https://locadora-alfa.example.test/equipamentos?categoria=concreto",
      "https://locadora-alfa.example.test/equipamentos/abc",
    ]);
    expect(buildEquipmentBreadcrumbs(equipment, "abc", "concreto").map((crumb) => crumb.url)).toEqual([
      "/",
      "/equipamentos",
      "/equipamentos?categoria=concreto",
      "/equipamentos/abc",
    ]);
  });
});
