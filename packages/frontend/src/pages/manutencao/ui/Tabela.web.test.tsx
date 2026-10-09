import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tabela de manutenção", () => {
  it("mostra equipamento, técnico e a ação Exibir", () => {
    const source = readFileSync(new URL("./Tabela.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Equipamento");
    expect(source).toContain("Técnico");
    expect(source).toContain("Exibir");
    expect(source).toContain("typeConfig");
    expect(source).toContain("getStatusBadge");
    const page = readFileSync(new URL("./ManutencaoPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Tabela.web'");
  });
});
