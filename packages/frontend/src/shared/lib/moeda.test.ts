import { describe, expect, it } from "vitest";
import { formatCurrency } from "./moeda";

describe("formatCurrency", () => {
  it("formata valor positivo em real", () => {
    expect(formatCurrency(1234.56)).toBe("R$\u00a01.234,56");
  });

  it("formata zero", () => {
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
  });

  it("formata negativo no padrão pt-BR", () => {
    expect(formatCurrency(-50)).toMatch(/-R\$\s*50,00|R\$\s*-50,00/);
  });
});
