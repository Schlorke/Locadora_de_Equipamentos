import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Diálogo de entrega", () => {
  it("mantém editar, veículo, motorista e salvar", () => {
    const source = readFileSync(new URL("./Dialogo.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('title="Editar Entrega/Coleta"');
    expect(source).toContain('placeholder="Selecione um veículo"');
    expect(source).toContain('placeholder="Selecione um motorista"');
    expect(source).toContain('placeholder="Digite a distância em km"');
    expect(source).toContain('placeholder="Digite observações sobre a entrega/coleta..."');
    expect(source).toContain("Salvar");
    expect(source).toContain("Cancelar");
    expect(source).toContain('title="Cliente"');
    expect(source).toContain('title="Checklist"');
    expect(source).toContain('title="Fotos"');
    const page = readFileSync(new URL("./LogisticaPage.web.tsx", import.meta.url), "utf8");
    expect(page).toContain("from './Dialogo.web'");
  });
});
