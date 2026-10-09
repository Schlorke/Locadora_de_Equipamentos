import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Filtros de logística", () => {
  it("mantém a busca, os status e o reset em all", () => {
    const source = readFileSync(new URL("./Filtros.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('placeholder="Buscar por cliente..."');
    expect(source).toContain("label: 'Agendada'");
    expect(source).toContain("label: 'Em Trânsito'");
    expect(source).toContain("label: 'Concluída'");
    expect(source).toContain("label: 'Cancelada'");
    expect(source).toContain("label: 'Entrega'");
    expect(source).toContain("label: 'Coleta'");
    expect(source).toContain("setStatusFilter('all')");
    expect(source).toContain("setTypeFilter('all')");
    expect(source).toContain("Funcionalidade em desenvolvimento");
    expect(source).toContain("Nova Entrega/Coleta");
    expect(source).toContain("label: 'Tabela'");
    expect(source).toContain("label: 'Calendário'");
    const page = readFileSync(new URL("./LogisticaPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Filtros.web'");
  });
});
