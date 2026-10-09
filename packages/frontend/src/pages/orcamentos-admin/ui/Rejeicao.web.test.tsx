import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cartão de rejeição do orçamento", () => {
  it("separa cancelamento do cliente da rejeição do administrador", () => {
    const source = readFileSync(new URL("./Rejeicao.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Detalhes da Rejeição");
    expect(source).toContain("rejectionReason === 'Cancelado pelo cliente'");
    expect(source).toContain("Cancelado pelo Cliente");
    expect(source).toContain("Rejeitado pelo Administrador");
    expect(source).toContain("rejectedBy.name || 'Administrador'");
    expect(source).toContain("Rejeitou este orçamento");
    expect(source).toContain("Motivo");
    expect(source).toContain("toLocaleString('pt-BR')");
    expect(source).toContain("? 'Cancelado'");
    expect(source).toContain(": 'Rejeitado'");
    expect(source).toContain("from 'next/image'");
  });
});
