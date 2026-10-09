import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tabela de locações", () => {
  it("mostra o cliente e a ação Exibir", () => {
    const source = readFileSync(new URL("./Tabela.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Cliente");
    expect(source).toContain("Exibir");
    expect(source).toContain("formatCurrency");
    expect(source).toContain("getStatusBadge");
    const page = readFileSync(new URL("./LocacoesPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Tabela.web'");
    expect(page).not.toContain("components/admin/rentals/rental-table");
  });
});
