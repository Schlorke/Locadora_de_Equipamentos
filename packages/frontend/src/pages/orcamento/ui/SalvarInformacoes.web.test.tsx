import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Salvar informações do cliente no orçamento", () => {
  it("mostra telefone, CPF, CNPJ e empresa e só salva quando há dado", () => {
    const source = readFileSync(
      new URL("./SalvarInformacoes.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("Salvar informações");
    expect(source).toContain("estas informações");
    expect(source).toContain("futuras solicitações de orçamento");
    expect(source).toContain("Telefone");
    expect(source).toContain("CPF");
    expect(source).toContain("CNPJ");
    expect(source).toContain("Empresa");
    expect(source).toContain("if (!hasAnyInfo)");
    expect(source).toContain("return null");
    expect(source).toContain("Não salvar");
    expect(source).toContain("Salvar");
    expect(source).toContain('variant="outline"');
    expect(source).toContain('variant="default"');
    expect(source).toContain('className="max-w-lg h-auto md:h-auto"');
    expect(source).not.toContain("!h-auto");
  });
});
