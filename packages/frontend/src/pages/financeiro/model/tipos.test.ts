import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tipos financeiros", () => {
  it("mantém rótulos de cobrança, regimes e as alíquotas padrão", () => {
    const source = readFileSync(new URL("./tipos.ts", import.meta.url), "utf8");
    expect(source).toContain("PAID: 'Pago'");
    expect(source).toContain("UNPAID: 'Não Pago'");
    expect(source).toContain("AWAITING_PAYMENT: 'Aguardando Pagamento'");
    expect(source).toContain("SETTLED: 'Baixado'");
    expect(source).toContain("SIMPLES_NACIONAL: 'Simples Nacional'");
    expect(source).toContain("LUCRO_PRESUMIDO: 'Lucro Presumido'");
    expect(source).toContain("LUCRO_REAL: 'Lucro Real'");
    expect(source).toContain("PURE_RENTAL: 'Locação Pura'");
    expect(source).toContain("RENTAL_WITH_SERVICE: 'Locação + Serviço'");
    expect(source).toContain("LABOR: 'Mão de Obra'");
    expect(source).toContain("TRAVEL: 'Deslocamento'");
    expect(source).toContain("MAINTENANCE: 'Manutenção'");
    expect(source).toContain("OTHER: 'Outros'");
    expect(source).toContain("cpfRate: 6");
    expect(source).toContain("cnpjRate: 2.5");
    expect(source).toContain("cniRate: 6");
    expect(source).toContain("issRate: 2.5");
    expect(source).toContain("issExemptRental: true");
    expect(source).toContain("taxRegime: 'SIMPLES_NACIONAL'");
    expect(source).toContain("id: `adj-");
  });
});
