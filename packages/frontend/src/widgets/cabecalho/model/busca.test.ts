import { describe, expect, it } from "vitest";
import {
  HEADER_SEARCH_DEBOUNCE_MS,
  HEADER_SEARCH_MIN_CHARS,
  HEADER_SEARCH_PLACEHOLDER,
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  buildEquipmentDetailHref,
  buildEquipmentListSearchHref,
  buildEquipmentSearchUrl,
} from "./busca";

describe("busca do cabeçalho", () => {
  it("guarda no máximo 6 pesquisas recentes na chave gb-locacoes-recent-searches", () => {
    expect(RECENT_SEARCHES_KEY).toBe("gb-locacoes-recent-searches");
    expect(MAX_RECENT_SEARCHES).toBe(6);
    expect(HEADER_SEARCH_MIN_CHARS).toBe(2);
    expect(HEADER_SEARCH_DEBOUNCE_MS).toBe(300);
    expect(HEADER_SEARCH_PLACEHOLDER).toBe("Ex: andaime, betoneira, escada...");
  });

  it("monta a busca, o detalhe e a listagem", () => {
    expect(buildEquipmentSearchUrl("andaime suspenso")).toBe(
      "/api/equipamentos/search?q=andaime%20suspenso",
    );
    expect(buildEquipmentDetailHref("eq-1")).toBe("/equipamentos/eq-1");
    expect(buildEquipmentListSearchHref("betoneira")).toBe("/equipamentos?search=betoneira");
  });
});
