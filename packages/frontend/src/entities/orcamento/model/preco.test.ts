import { describe, expect, it } from "vitest";
import { buildQuotePricing } from "./preco";

const equipment = {
  pricePerDay: 100,
  dailyDiscount: 0,
  weeklyDiscount: 0,
  biweeklyDiscount: 0,
  monthlyDiscount: 0,
  dailyDirectValue: 0,
  weeklyDirectValue: 0,
  biweeklyDirectValue: 0,
  monthlyDirectValue: 0,
  dailyUseDirectValue: false,
  weeklyUseDirectValue: false,
  biweeklyUseDirectValue: false,
  monthlyUseDirectValue: false,
};

describe("buildQuotePricing", () => {
  it("cobra a diária vezes a quantidade", () => {
    const pricing = buildQuotePricing(equipment, 3, 2);
    expect(pricing.appliedPeriod).toBe("diaria");
    expect(pricing.total).toBe(600);
    expect(pricing.pricePerDay).toBe(100);
  });

  it("rotula a semana", () => {
    expect(buildQuotePricing(equipment, 7, 1).appliedPeriod).toBe("semanal");
  });

  it("não divide por zero quando os dias vêm vazios", () => {
    const pricing = buildQuotePricing(equipment, 0, 1);
    expect(pricing.pricePerDay).toBe(0);
    expect(pricing.total).toBe(0);
  });
});
