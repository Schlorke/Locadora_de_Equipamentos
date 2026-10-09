import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Definições de status", () => {
  it("normaliza maiúsculas e mantém os textos de negócio", () => {
    const source = readFileSync(new URL("./status-definitions.ts", import.meta.url), "utf8");
    expect(source).toContain("if (!status) return null");
    expect(source).toContain("status.toUpperCase()");
    expect(source).toContain("label: 'Pendente'");
    expect(source).toContain("Orçamento recebido, aguardando análise e aprovação.");
    expect(source).toContain("label: 'Aguardando devolução'");
    expect(source).toContain("label: 'Não Pago'");
    expect(source).toContain("label: 'Aguardando Pagamento'");
    expect(source).toContain("label: 'Baixado'");
    expect(source).toContain("?? null");
  });
});
