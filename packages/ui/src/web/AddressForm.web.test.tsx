import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatAddressCep } from "./address-cep";

describe("AddressForm", () => {
  it("mascara o CEP em 00000-000", () => {
    expect(formatAddressCep("90000000")).toBe("90000-000");
    expect(formatAddressCep("12345")).toBe("12345");
    expect(formatAddressCep("12.345-6789")).toBe("12345-678");
  });

  it("copia localidade para cidade e uf para estado", () => {
    const source = readFileSync(new URL("./AddressForm.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("cidade: addressData.localidade");
    expect(source).toContain("estado: addressData.uf");
    expect(source).toContain("placeholder=\"00000-000\"");
    expect(source).toContain("placeholder=\"RS\"");
    expect(source).toContain("maxLength={2}");
    expect(source).toContain("uppercase");
    expect(source).toContain("Erro ao buscar CEP:");
    expect(source).toContain(">Complemento<");
  });
});
