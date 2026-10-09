import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Alíquotas financeiras", () => {
  it("mantém regimes, retenções e os percentuais documentados", () => {
    const source = readFileSync(new URL("./Aliquotas.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Alíquotas de Retenção");
    expect(source).toContain("label: 'CPF'");
    expect(source).toContain("label: 'CNPJ'");
    expect(source).toContain("label: 'CNI'");
    expect(source).toContain("Simples Nacional");
    expect(source).toContain("Lucro Presumido");
    expect(source).toContain("Lucro Real");
    // Achado 143: a dica citava o município da GB ("Porto Alegre: 2,5%") no painel de qualquer locadora.
    expect(source).toContain("Alíquota ISS do município da locadora (de 2% a 5%, conforme a lei municipal). Padrão: 2,5%.");
    expect(source).not.toContain("Porto Alegre");
    expect(source).toContain("Padrão: 4,8% (presunção 32% x 15%)");
    expect(source).toContain("Padrão: 2,88% (presunção 32% x 9%)");
    expect(source).toContain("PIS 0,65% + COFINS 3,0% = 3,65% (cumulativo).");
    expect(source).toContain("PIS 1,65% + COFINS 7,6% = 9,25%");
    expect(source).toContain("Varia de 6% a 33%");
    expect(source).toContain("Súmula Vinculante 31");
    expect(source).toContain("Alíquota IBS+CBS (%)");
    expect(source).toContain("transition={{ delay: 0.3 }}");
  });
});
