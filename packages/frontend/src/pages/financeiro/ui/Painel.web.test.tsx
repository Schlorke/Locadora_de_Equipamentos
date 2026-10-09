import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Painel de gráficos financeiros", () => {
  it("mantém aging, devedores e as duas receitas", () => {
    const source = readFileSync(new URL("./Painel.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Aging - Contas a Receber");
    expect(source).toContain("Maiores Devedores");
    expect(source).toContain("Receita Mensal");
    expect(source).toContain("Receita por Categoria");
    expect(source).toContain("<AgingChart data={agingData} />");
    expect(source).toContain("<AgingChart data={agingData} expanded />");
  });
});
