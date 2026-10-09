import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tabela financeira", () => {
  it("mantém colunas, seleção da página e as iniciais do admin", () => {
    const source = readFileSync(new URL("./Tabela.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Nenhum lançamento encontrado");
    expect(source).toContain("Selecionar todos os lançamentos da página");
    expect(source).toContain(">Cliente<");
    expect(source).toContain("Valores");
    expect(source).toContain("Nº Nota");
    expect(source).toContain("Datas");
    expect(source).toContain("Status");
    expect(source).toContain("Documento");
    expect(source).toContain("Ações");
    expect(source).toContain("Exibir");
    expect(source).toContain("getInitials(entry.customerName)");
    expect(source).toContain("statusLabel[entry.billingStatus]");
    expect(source).toContain("variant=\"header\"");
  });
});
