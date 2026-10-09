import { describe, expect, it } from "vitest";
import { calculateRentalLateFee } from "./multa";

const start = new Date("2026-01-01T00:00:00.000Z");
const end = new Date("2026-01-11T00:00:00.000Z");
const fiveDaysLater = new Date("2026-01-16T00:00:00.000Z");

describe("calculateRentalLateFee", () => {
  it("não cobra quando a data atual não passou do fim", () => {
    const result = calculateRentalLateFee({
      total: 1000,
      startDate: start,
      endDate: end,
      currentDate: end,
    });
    expect(result).toEqual({ lateFee: 0, daysOverdue: 0, overdue: false });
  });

  it("cobra 5% do valor diário por dia de atraso", () => {
    const result = calculateRentalLateFee({
      total: 1000,
      startDate: start,
      endDate: end,
      currentDate: fiveDaysLater,
    });
    expect(result.daysOverdue).toBe(5);
    expect(result.lateFee).toBe(25);
    expect(result.overdue).toBe(true);
  });

  it("divide por 1 quando início e fim caem no mesmo instante", () => {
    const nextDay = new Date("2026-01-02T00:00:00.000Z");
    const result = calculateRentalLateFee({
      total: 200,
      startDate: start,
      endDate: start,
      currentDate: nextDay,
    });
    expect(result.daysOverdue).toBe(1);
    expect(result.lateFee).toBe(10);
  });
});
