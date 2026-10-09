import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Diálogo de manutenção", () => {
  it("mantém os cartões de equipamento, informações, custos e notas", () => {
    const source = readFileSync(new URL("./Dialogo.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('title="Equipamento"');
    expect(source).toContain('title="Informações da Manutenção"');
    expect(source).toContain('title="Descrição"');
    expect(source).toContain('title="Custos"');
    expect(source).toContain('title="Notas"');
    expect(source).toContain("formatCurrency");
    expect(source).toContain("getStatusBadge");
    const page = readFileSync(new URL("./ManutencaoPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Dialogo.web'");
  });
});
