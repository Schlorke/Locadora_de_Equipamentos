import { sortByNamePtBr } from "./listagem";

export const EQUIPMENT_LIST_PAGE_SIZE = 9;
export const EQUIPMENT_LIST_URL = "/api/admin/equipments?limit=1000";
export const EQUIPMENT_LIST_CATEGORIES_URL = "/api/admin/categories";

export interface EquipmentListFilterItem {
  name?: string | null;
  description?: string | null;
  isAvailable?: boolean;
  category?: { id?: string | null } | null;
}

export function formatEquipmentListPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

export function formatEquipmentListDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

export const sortEquipmentByName = sortByNamePtBr;

export function filterEquipmentList<T extends EquipmentListFilterItem>(
  items: T[],
  filters: { searchTerm: string; selectedCategory: string; availabilityFilter: string },
): T[] {
  const filtered = items.filter((equipment) => {
    const matchesSearch =
      equipment.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      equipment.description?.toLowerCase().includes(filters.searchTerm.toLowerCase());

    const matchesCategory =
      filters.selectedCategory === "all" || equipment.category?.id === filters.selectedCategory;

    const matchesAvailability =
      filters.availabilityFilter === "all" ||
      (filters.availabilityFilter === "available" && equipment.isAvailable) ||
      (filters.availabilityFilter === "unavailable" && !equipment.isAvailable);

    return matchesSearch && matchesCategory && matchesAvailability;
  });

  return sortEquipmentByName(filtered);
}
