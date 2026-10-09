import { describe, expect, it } from "vitest";
import { DEFAULT_LATE_FEE_CONFIG, calculateLateFee } from "./multa";

const end = new Date("2026-01-01T00:00:00.000Z");
const fiveDaysLater = new Date("2026-01-06T00:00:00.000Z");

describe("calculateLateFee", () => {
  it("não cobra quando ainda não venceu", () => {
    const result = calculateLateFee(1000, fiveDaysLater, end);
    expect(result.daysLate).toBe(0);
    expect(result.fee.toNumber()).toBe(0);
    expect(result.calculationMethod).toBe("daily");
  });

  it("cobra 2% ao dia, com piso e teto", () => {
    const result = calculateLateFee(1000, end, fiveDaysLater, {
      dailyRate: 0.02,
      minAmount: 50,
      maxAmount: 500,
    });
    expect(result.daysLate).toBe(5);
    expect(result.fee.toNumber()).toBe(100);
  });

  it("usa valor fixo quando ele existe", () => {
    const result = calculateLateFee(1000, end, fiveDaysLater, { fixedAmount: 80 });
    expect(result.fee.toNumber()).toBe(80);
    expect(result.calculationMethod).toBe("fixed");
    expect(result.daysLate).toBe(5);
  });

  it("limita os dias e aplica o mínimo", () => {
    const result = calculateLateFee(1000, end, fiveDaysLater, { dailyRate: 0.02, maxDays: 2, minAmount: 50 });
    expect(result.fee.toNumber()).toBe(50);
  });

  it("mantém a configuração padrão", () => {
    expect(DEFAULT_LATE_FEE_CONFIG).toEqual({
      dailyRate: 0.02,
      maxDays: 30,
      minAmount: 50,
      maxAmount: 5000,
    });
  });
});
