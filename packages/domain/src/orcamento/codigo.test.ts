import { describe, expect, it } from "vitest";
import { formatQuoteCode, parseQuoteCodeSequence } from "./codigo";

describe("quote code", () => {
  it("formata ano e sequência com quatro dígitos", () => {
    expect(formatQuoteCode(2026, 7)).toBe("Q-2026-0007");
    expect(formatQuoteCode(2026, 10000)).toBe("Q-2026-10000");
  });

  it("lê a sequência e ignora código vazio ou fora do padrão", () => {
    expect(parseQuoteCodeSequence(null)).toBe(0);
    expect(parseQuoteCodeSequence("")).toBe(0);
    expect(parseQuoteCodeSequence("Q-2026-0007")).toBe(7);
    expect(parseQuoteCodeSequence("Q-2026-12")).toBe(0);
    expect(parseQuoteCodeSequence("orcamento")).toBe(0);
  });
});
