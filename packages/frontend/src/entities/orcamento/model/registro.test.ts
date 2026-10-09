import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_CATEGORY_LABEL,
  statusConfig,
  type Quote,
} from "./registro";
import {
  countDaysBetween,
  formatCNPJInput,
  formatCPFInput,
  formatDate,
  getCardStatusBadge,
  normalizeQuote,
  normalizeStatus,
  parseLocalDate,
} from "./registro-utils";

function quote(partial: Partial<Quote>): Quote {
  return {
    id: "1",
    name: "Ana",
    email: "ana@example.com",
    phone: "1",
    equipments: [],
    startDate: "2026-03-16",
    endDate: "2026-03-20",
    totalPrice: 10,
    status: "pending",
    createdAt: "2026-03-16T12:00:00.000Z",
    updatedAt: "2026-03-16T12:00:00.000Z",
    ...partial,
  };
}

describe("Registro admin do orçamento", () => {
  it("mantém status, máscaras, data local e o selo do kanban", () => {
    const local = parseLocalDate("2026-03-15");
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(2);
    expect(local.getDate()).toBe(15);
    expect(
      countDaysBetween(
        parseLocalDate("2026-03-16"),
        parseLocalDate("2026-03-16"),
        true
      )
    ).toBe(1);
    expect(formatDate(null)).toBe("Não definido");
    expect(formatDate("nao-e-data")).toBe("Data inválida");
    expect(formatCPFInput("12345678901")).toBe("123.456.789-01");
    expect(formatCNPJInput("12345678000199")).toBe("12.345.678/0001-99");
    expect(normalizeStatus("PENDING")).toBe("pending");
    expect(
      normalizeQuote(
        quote({ approvedAt: "2026-03-17T00:00:00.000Z", rejectedAt: null })
      ).status
    ).toBe("approved");
    expect(statusConfig.completed?.label).toBe("Concluido");
    expect(statusConfig.pending?.color.split(" ")).toEqual(
      expect.arrayContaining(["bg-orange-500", "text-white", "border-0"])
    );
    expect(statusConfig.pending?.color).not.toMatch(/(^|\s)!/);
    expect(ADJUSTMENT_CATEGORY_LABEL.TRAVEL).toBe("Deslocamento (Frete)");
    expect(getCardStatusBadge(quote({ status: "rejected" })).label).toBe(
      "Rejeitado"
    );
    expect(getCardStatusBadge(quote({ status: "pending" })).label).toBe(
      "Aprovação Pendente"
    );
  });
});
