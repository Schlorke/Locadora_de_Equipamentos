import { describe, expect, it } from "vitest";
import {
  DEFAULT_FINANCIAL_RATES,
  calculateNetAmount,
  getTaxRateByDocumentType,
  mapPaymentStatusToBillingStatus,
  resolveTaxDocumentType,
} from "./aliquota";

describe("alíquota financeira", () => {
  it("escolhe CNI, depois CNPJ, e cai em CPF", () => {
    expect(resolveTaxDocumentType({ cni: " 123 ", cnpj: "1", cpf: "2" })).toBe("CNI");
    expect(resolveTaxDocumentType({ cni: " ", cnpj: "1", cpf: "2" })).toBe("CNPJ");
    expect(resolveTaxDocumentType({ cnpj: null, cpf: null, cni: null })).toBe("CPF");
  });

  it("mantém as taxas padrão e o líquido", () => {
    expect(DEFAULT_FINANCIAL_RATES).toEqual({ cpfRate: 6, cnpjRate: 2.5, cniRate: 6 });
    expect(getTaxRateByDocumentType(DEFAULT_FINANCIAL_RATES, "CNPJ")).toBe(2.5);
    expect(calculateNetAmount(1000, 6)).toBe(940);
    expect(calculateNetAmount(2000, 2.5)).toBe(1950);
    expect(calculateNetAmount(0, 6)).toBe(0);
  });

  it("mapeia o status do pagamento para o status de cobrança", () => {
    expect(mapPaymentStatusToBillingStatus("PAID")).toBe("PAID");
    expect(mapPaymentStatusToBillingStatus("OVERDUE")).toBe("UNPAID");
    expect(mapPaymentStatusToBillingStatus("PENDING")).toBe("AWAITING_PAYMENT");
    expect(mapPaymentStatusToBillingStatus("CANCELLED")).toBe("SETTLED");
    expect(mapPaymentStatusToBillingStatus("REFUNDED")).toBe("SETTLED");
  });
});
