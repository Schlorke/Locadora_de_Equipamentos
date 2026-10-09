import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Seletor de data", () => {
  it("mostra a data em português e abre o calendário alinhado ao início", () => {
    const source = readFileSync(new URL("./DatePicker.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('placeholder = "Selecione uma data"');
    expect(source).toContain('format(date, "PPP", { locale: ptBR })');
    expect(source).toContain('mode="single"');
    expect(source).toContain('align="start"');
    expect(source).toContain("locale={ptBR}");
  });
});
