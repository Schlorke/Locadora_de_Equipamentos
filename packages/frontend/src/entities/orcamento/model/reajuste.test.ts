import { describe, expect, it } from "vitest";
import { ADJUSTMENT_CATEGORY_LABELS, formatAdjustmentReason, parseAdjustmentBlocks } from "./reajuste";

describe("reajuste do orçamento", () => {
  it("remove os colchetes da justificativa", () => {
    expect(formatAdjustmentReason("[Deslocamento (Frete)] Teste")).toBe("Deslocamento (Frete) Teste");
    expect(formatAdjustmentReason(null)).toBe("");
    expect(formatAdjustmentReason("")).toBe("");
  });

  it("mantém os rótulos de categoria", () => {
    expect(ADJUSTMENT_CATEGORY_LABELS).toEqual({
      LABOR: "Mão de obra",
      TRAVEL: "Deslocamento (Frete)",
      MAINTENANCE: "Manutenção",
      OTHER: "Outro",
    });
  });

  it("separa categoria e justificativa, e cai em Outro", () => {
    expect(parseAdjustmentBlocks("[Deslocamento (Frete)] Teste\ntexto solto")).toEqual([
      { category: "Deslocamento (Frete)", justification: "Teste" },
      { category: "Outro", justification: "texto solto" },
    ]);
    expect(parseAdjustmentBlocks("[LABOR]")).toEqual([{ category: "LABOR", justification: "-" }]);
    expect(parseAdjustmentBlocks("   ")).toEqual([]);
  });
});
