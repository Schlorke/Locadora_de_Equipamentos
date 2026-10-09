import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EquipamentosPage } from "./EquipamentosPage";

describe("EquipamentosPage", () => {
  it("mostra o carregamento antes da lista", () => {
    const html = renderToStaticMarkup(
      createElement(EquipamentosPage, {
        categoria: null,
        image: () => "IMAGEM",
        link: () => "LINK",
        filterCard: () => "FILTRO",
        pagination: () => "PAGINAS",
        categoryBadge: () => "CATEGORIA",
      }),
    );
    expect(html).toContain("Carregando equipamentos...");
    expect(html).not.toContain("IMAGEM");
  });
});
