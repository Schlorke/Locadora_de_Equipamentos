import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Detalhe do lançamento", () => {
  it("mantém títulos, reajuste e as iniciais do admin", () => {
    const source = readFileSync(new URL("./Detalhe.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Detalhes do Lançamento -");
    expect(source).toContain("Registrar Reajuste de");
    expect(source).toContain("Orçamento");
    expect(source).toContain('placeholder="Selecione o status"');
    expect(source).toContain('placeholder="Selecione a data"');
    expect(source).toContain('placeholder="Selecione a categoria"');
    expect(source).toContain('aria-label="Remover reajuste"');
    expect(source).toContain('aria-label="Editar reajuste"');
    expect(source).toContain('aria-label="Fechar dialog"');
    expect(source).toContain('aria-label="Remover item de reajuste"');
    expect(source).toContain("getInitials(");
    expect(source).toContain("if (!value) return '-'");
    expect(source).toContain("from '../../../widgets/seletor-data'");
  });
});
