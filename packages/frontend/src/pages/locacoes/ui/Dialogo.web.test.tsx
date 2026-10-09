import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Diálogo de locação", () => {
  it("mantém cliente, período, check-in, check-out e contrato", () => {
    const source = readFileSync(new URL("./Dialogo.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('title="Cliente"');
    expect(source).toContain('title="Período de Locação"');
    expect(source).toContain('title="Equipamentos"');
    expect(source).toContain('title="Pagamentos"');
    expect(source).toContain('title="Check-in/Check-out"');
    expect(source).toContain("Realizar Check-in");
    expect(source).toContain("Realizar Check-out");
    expect(source).toContain('title="Contrato"');
    expect(source).toContain('title="Documentos do Cliente (Antifraude)"');
    const page = readFileSync(new URL("./LocacoesPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Dialogo.web'");
  });
});
