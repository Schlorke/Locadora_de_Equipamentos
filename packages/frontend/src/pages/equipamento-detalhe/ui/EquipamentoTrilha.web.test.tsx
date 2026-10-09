// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EquipmentBreadcrumb } from "./EquipamentoTrilha.web";

const XSS = "</script><script>alert(1)</script>";

/** Interpreta o HTML renderizado com um parser HTML real, como o navegador faria. */
function parseRendered(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html}<p id="depois">fim da página</p></body></html>`,
    "text/html",
  );
}

describe("EquipmentBreadcrumb", () => {
  it("mantém inertes o nome do equipamento e da categoria no JSON-LD e na trilha visível", () => {
    const html = renderToStaticMarkup(
      createElement(EquipmentBreadcrumb, {
        currentPage: `Betoneira ${XSS}`,
        categoryName: "Concreto <img src=x onerror=alert(1)>",
        categorySlug: "concreto",
      }),
    );

    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img");

    const doc = parseRendered(html);
    const scripts = [...doc.querySelectorAll("script")];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.type).toBe("application/ld+json");
    expect(doc.querySelectorAll("img")).toHaveLength(0);
    expect(doc.getElementById("depois")?.textContent).toBe("fim da página");

    const jsonLd = JSON.parse(scripts[0]!.textContent ?? "");
    expect(jsonLd.itemListElement.map((item: { name: string }) => item.name)).toEqual([
      "Home",
      "Equipamentos",
      "Concreto <img src=x onerror=alert(1)>",
      `Betoneira ${XSS}`,
    ]);

    // A trilha visível segue mostrando o nome como texto.
    const trilha = doc.querySelector('nav[aria-label="Breadcrumb"]');
    expect(trilha?.textContent).toContain(`Betoneira ${XSS}`);
    expect(trilha?.textContent).toContain("Concreto <img src=x onerror=alert(1)>");
  });

  it("sem caractere perigoso, o JSON-LD continua igual ao JSON.stringify compacto", () => {
    const html = renderToStaticMarkup(
      createElement(EquipmentBreadcrumb, { currentPage: "Betoneira 400L", categoryName: "Concreto", categorySlug: "concreto" }),
    );

    const body = parseRendered(html).querySelector("script")?.textContent ?? "";

    expect(body).toBe(JSON.stringify(JSON.parse(body)));
    // Achado 143: caminho relativo à origem da locadora; o teste anterior afirmava o domínio fixo da GB.
    expect(JSON.parse(body).itemListElement[2].item).toBe("/equipamentos?categoria=concreto");
  });
});
