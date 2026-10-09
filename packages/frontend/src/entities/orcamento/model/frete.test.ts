import { describe, expect, it } from "vitest";
import { calculateFreight } from "./frete";

describe("calculateFreight", () => {
  it("rejeita CEP incompleto", async () => {
    const result = await calculateFreight({ fromCEP: "123", toCEP: "90240-100", equipmentIds: ["a"], quantities: [1] });
    expect(result.shippingOptions).toEqual([]);
    expect(result.note).toBe("CEP inválido");
  });

  it("estima o frete mínimo no mesmo prefixo de CEP", async () => {
    const result = await calculateFreight({
      fromCEP: "90240-100",
      toCEP: "90240-000",
      equipmentIds: ["eq"],
      quantities: [2],
    });
    expect(result.chargeableWeight).toBe(100);
    expect(result.note).toBe("Cálculo estimado - valores podem variar");
    expect(result.shippingOptions.map((option) => option.price)).toEqual([30, 45]);
    expect(result.shippingOptions.map((option) => option.estimatedDays)).toEqual([3, 1]);
    expect(result.shippingOptions[0]?.name).toBe("Transportadora Padrão");
    expect(result.shippingOptions[1]?.name).toBe("Entrega Expressa");
  });
});
