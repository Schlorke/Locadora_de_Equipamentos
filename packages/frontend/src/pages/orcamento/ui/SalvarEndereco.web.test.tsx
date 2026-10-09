import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Salvar endereço do orçamento", () => {
  it("escolhe o título pelo que é novo e some quando não há nada", () => {
    const source = readFileSync(
      new URL("./SalvarEndereco.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("? 'Salvar informações'");
    expect(source).toContain("? 'Salvar endereço'");
    expect(source).toContain(": 'Salvar informações do cliente'");
    expect(source).toContain(
      "Deseja salvar este endereço para futuras solicitações de orçamento?"
    );
    expect(source).toContain("if (!hasAnythingToShow)");
    expect(source).toContain("return null");
    expect(source).toContain("Não salvar");
    expect(source).toContain("Salvando...");
    expect(source).toContain("'Salvar'");
    expect(source).toContain("variant=\"outline\"");
    expect(source).toContain("variant=\"default\"");
    expect(source).toContain('className="max-w-lg h-auto md:h-auto"');
    expect(source).not.toContain("!h-auto");
  });
});
