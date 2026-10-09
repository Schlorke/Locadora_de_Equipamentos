import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Intervalo de datas", () => {
  it("mostra o período em dd/MM/yyyy e pede a data final", () => {
    const source = readFileSync(new URL("./DateRangePicker.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("placeholder = 'Selecionar período'");
    expect(source).toContain("format(startDate, 'dd/MM/yyyy', { locale: ptBR })");
    expect(source).toContain('mode="range"');
    expect(source).toContain("Agora selecione a data final");
    expect(source).toContain("Datas selecionadas com sucesso!");
    expect(source).toContain("Período mínimo:");
    expect(source).toContain("showOutsideDays={false}");
  });
});
