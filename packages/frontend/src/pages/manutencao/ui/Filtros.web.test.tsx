import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Filtros de manutenção", () => {
  it("mantém a busca, os status, os tipos e a visão lista", () => {
    const source = readFileSync(new URL("./Filtros.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('placeholder="Buscar por equipamento ou técnico..."');
    expect(source).toContain("label: 'Em Andamento'");
    expect(source).toContain("value: 'IN_PROGRESS'");
    expect(source).toContain("label: 'Preventiva'");
    expect(source).toContain("label: 'Corretiva'");
    expect(source).toContain("label: 'Inspeção'");
    expect(source).toContain("setStatusFilter('all')");
    expect(source).toContain("setTypeFilter('all')");
    expect(source).toContain("Agendar Preventiva");
    expect(source).toContain("Funcionalidade em desenvolvimento");
    expect(source).toContain("value: 'list'");
    expect(source).toContain("label: 'Lista'");
    const page = readFileSync(new URL("./ManutencaoPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Filtros.web'");
  });
});
