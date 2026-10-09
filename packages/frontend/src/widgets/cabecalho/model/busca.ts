export const RECENT_SEARCHES_KEY = "gb-locacoes-recent-searches";
export const MAX_RECENT_SEARCHES = 6;
export const HEADER_SEARCH_MIN_CHARS = 2;
export const HEADER_SEARCH_DEBOUNCE_MS = 300;
export const HEADER_SEARCH_PLACEHOLDER = "Ex: andaime, betoneira, escada...";
export const HEADER_SEARCH_HINT = "Digite para encontrar o que precisa";
export const HEADER_SEARCH_TOOLTIP = "💡 Digite pelo menos 2 caracteres para buscar";

export function buildEquipmentSearchUrl(query: string): string {
  return `/api/equipamentos/search?q=${encodeURIComponent(query)}`;
}

export function buildEquipmentDetailHref(id: string): string {
  return `/equipamentos/${id}`;
}

export function buildEquipmentListSearchHref(term: string): string {
  return `/equipamentos?search=${encodeURIComponent(term)}`;
}
