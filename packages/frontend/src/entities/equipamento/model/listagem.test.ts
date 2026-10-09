import { describe, expect, it } from "vitest";
import { filterEquipments, paginate, sortByNamePtBr } from "./listagem";

const items = [
  { name: "Betoneira", description: "Concreto", category: { id: "concretagem" } },
  { name: "andaime", description: "Altura", category: { id: "altura" } },
  { name: "Compressor", description: "Ar de betoneira", category: { id: "ar" } },
];

describe("listagem de equipamentos", () => {
  it("ordena pelo nome em pt-BR sem diferenciar maiúsculas", () => {
    expect(sortByNamePtBr(items).map((item) => item.name)).toEqual(["andaime", "Betoneira", "Compressor"]);
  });

  it("filtra por nome ou descrição e por categoria", () => {
    expect(filterEquipments(items, "BETO", "all").map((item) => item.name)).toEqual(["Betoneira", "Compressor"]);
    expect(filterEquipments(items, "", "altura").map((item) => item.name)).toEqual(["andaime"]);
    expect(filterEquipments(null, "a", "all")).toEqual([]);
  });

  it("pagina de 9 em 9", () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ name: String(index) }));
    const page = paginate(sortByNamePtBr(many), 2, 9);
    expect(page.totalPages).toBe(2);
    expect(page.items).toEqual([{ name: "9" }]);
  });
});
