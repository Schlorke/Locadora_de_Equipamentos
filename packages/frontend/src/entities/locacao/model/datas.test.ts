import { describe, expect, it } from "vitest";
import { getAutoRentalDateRange } from "./datas";

describe("datas da locação", () => {
  it("pula sábado e domingo quando o fim de semana não entra", () => {
    const saturday = new Date(2026, 0, 3, 15, 0, 0);
    const { startDate, endDate } = getAutoRentalDateRange({
      requestDate: saturday,
      days: 1,
      includeWeekends: false,
    });
    expect(startDate.getDay()).toBe(1);
    expect(startDate.getDate()).toBe(5);
    expect(endDate.getDate()).toBe(5);
    expect(endDate.getHours()).toBe(23);
  });

  it("mantém o sábado quando o fim de semana entra", () => {
    const saturday = new Date(2026, 0, 3, 15, 0, 0);
    const { startDate, endDate } = getAutoRentalDateRange({
      requestDate: saturday,
      days: 2,
      includeWeekends: true,
    });
    expect(startDate.getDate()).toBe(3);
    expect(startDate.getHours()).toBe(0);
    expect(endDate.getDate()).toBe(4);
    expect(endDate.getHours()).toBe(23);
  });
});
