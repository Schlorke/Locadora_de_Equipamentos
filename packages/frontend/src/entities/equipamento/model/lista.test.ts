import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_LIST_CATEGORIES_URL,
  EQUIPMENT_LIST_PAGE_SIZE,
  EQUIPMENT_LIST_URL,
  filterEquipmentList,
  formatEquipmentListDate,
  formatEquipmentListPrice,
} from "./lista";

const items = [
  { name: "Zeta", description: "último", isAvailable: true, category: { id: "a" } },
  { name: "Andaime", description: "altura", isAvailable: false, category: { id: "b" } },
  { name: "Betoneira", description: "concreto", isAvailable: true, category: { id: "a" } },
];

describe("lista de equipamentos", () => {
  it("formata preço e data como a lista admin", () => {
    expect(formatEquipmentListPrice(1000)).toBe(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(1000),
    );
    expect(formatEquipmentListDate("2026-01-05")).toBe(new Date("2026-01-05").toLocaleDateString("pt-BR"));
    expect(EQUIPMENT_LIST_PAGE_SIZE).toBe(9);
    expect(EQUIPMENT_LIST_URL).toBe("/api/admin/equipments?limit=1000");
    expect(EQUIPMENT_LIST_CATEGORIES_URL).toBe("/api/admin/categories");
  });

  it("filtra por texto, categoria e disponibilidade e ordena pelo nome", () => {
    expect(
      filterEquipmentList(items, { searchTerm: "concreto", selectedCategory: "all", availabilityFilter: "all" }).map(
        (item) => item.name,
      ),
    ).toEqual(["Betoneira"]);

    expect(
      filterEquipmentList(items, { searchTerm: "", selectedCategory: "a", availabilityFilter: "available" }).map(
        (item) => item.name,
      ),
    ).toEqual(["Betoneira", "Zeta"]);

    expect(
      filterEquipmentList(items, { searchTerm: "", selectedCategory: "all", availabilityFilter: "unavailable" }).map(
        (item) => item.name,
      ),
    ).toEqual(["Andaime"]);
  });
});
