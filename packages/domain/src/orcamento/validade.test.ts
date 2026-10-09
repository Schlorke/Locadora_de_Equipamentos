import { describe, expect, it } from "vitest";
import { isQuoteValid } from "./validade";

describe("validade do orçamento", () => {
  it("só aceita PENDING", () => {
    expect(isQuoteValid({ status: "APPROVED", validUntil: new Date("2099-01-01") })).toBe(false);
    expect(isQuoteValid({ status: "PENDING", validUntil: new Date("2099-01-01") })).toBe(true);
  });

  it("trata validade ausente como válida e data passada como vencida", () => {
    expect(isQuoteValid({ status: "PENDING", validUntil: null })).toBe(true);
    expect(isQuoteValid({ status: "PENDING" })).toBe(true);
    expect(isQuoteValid({ status: "PENDING", validUntil: new Date("2020-01-01") })).toBe(false);
  });
});
