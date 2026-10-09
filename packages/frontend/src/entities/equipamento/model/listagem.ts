export type EquipmentListItem = {
  name: string;
  description: string;
  category: { id: string };
};

export function sortByNamePtBr<T extends { name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" }));
}

export function filterEquipments<T extends EquipmentListItem>(
  equipments: readonly T[] | null | undefined,
  searchTerm: string,
  categoryFilter: string,
): T[] {
  const safeEquipments = Array.isArray(equipments) ? [...equipments] : [];
  let filtered = safeEquipments;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter((eq) => eq.name.toLowerCase().includes(term) || eq.description.toLowerCase().includes(term));
  }
  if (categoryFilter !== "all") {
    filtered = filtered.filter((eq) => eq.category.id === categoryFilter);
  }
  return sortByNamePtBr(filtered);
}

export function paginate<T>(items: T[], page: number, perPage: number): { totalPages: number; items: T[] } {
  const totalPages = Math.ceil(items.length / perPage);
  const startIndex = (page - 1) * perPage;
  return { totalPages, items: items.slice(startIndex, startIndex + perPage) };
}
