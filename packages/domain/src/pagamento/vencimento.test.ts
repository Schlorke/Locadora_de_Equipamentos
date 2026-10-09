import { describe, expect, it } from "vitest";
import { getBoletoDueDate } from "./vencimento";

describe("vencimento do boleto", () => {
  it("soma 3 dias úteis e vai até o fim do dia", () => {
    const monday = new Date(2026, 0, 5, 10, 0, 0);
    const due = getBoletoDueDate(monday, 3);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(0);
    expect(due.getDate()).toBe(8);
    expect(due.getHours()).toBe(23);
    expect(due.getMinutes()).toBe(59);
    expect(due.getSeconds()).toBe(59);
  });

  it("pula o fim de semana", () => {
    const friday = new Date(2026, 0, 9, 15, 0, 0);
    const due = getBoletoDueDate(friday, 1);
    expect(due.getDate()).toBe(12);
    expect(due.getDay()).toBe(1);
  });

  it("usa 3 dias úteis quando o prazo não é informado", () => {
    const monday = new Date(2026, 0, 5, 10, 0, 0);
    expect(getBoletoDueDate(monday).getDate()).toBe(getBoletoDueDate(monday, 3).getDate());
  });
});
