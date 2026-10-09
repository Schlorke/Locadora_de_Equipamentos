import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { digitsToCurrencyNumber, formatCurrencyInput, parseCurrencyDigits } from "./currency-input";

describe("CurrencyInput", () => {
  it("divide os dígitos por 100 e formata em real", () => {
    expect(parseCurrencyDigits("R$ 12,34")).toBe("1234");
    expect(digitsToCurrencyNumber("")).toBe(0);
    expect(digitsToCurrencyNumber("12")).toBe(0.12);
    expect(digitsToCurrencyNumber("1234")).toBe(12.34);
    expect(formatCurrencyInput(12.34)).toBe(
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(12.34),
    );
  });

  it("mantém o placeholder R$ 0,00 e o modo numérico", () => {
    const source = readFileSync(new URL("./CurrencyInput.web.tsx", import.meta.url), "utf8");
    expect(source).toContain('currency = "BRL"');
    expect(source).toContain('locale = "pt-BR"');
    expect(source).toContain('placeholder="R$ 0,00"');
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain("scheduleCursorToEnd(true)");
  });
});
