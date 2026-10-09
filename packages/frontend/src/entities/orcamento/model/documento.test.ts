import { describe, expect, it } from "vitest";
import { formatAddress, formatDocument, validateCNPJ, validateCPF } from "./documento";

describe("CPF e CNPJ do orçamento", () => {
  it("aceita CPF e CNPJ formatados e recusa repetidos ou curtos", () => {
    expect(validateCPF("529.982.247-25")).toBe(true);
    expect(validateCPF("111.111.111-11")).toBe(false);
    expect(validateCPF("123")).toBe(false);
    expect(validateCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validateCNPJ("11.111.111/1111-11")).toBe(false);
    expect(validateCNPJ("11222333000180")).toBe(false);
  });

  it("formata 11 e 14 dígitos e devolve hífen quando o documento vem vazio", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatDocument("")).toBe("-");
    expect(formatDocument("123")).toBe("123");
  });

  it("junta o endereço e omite complemento vazio", () => {
    expect(
      formatAddress({
        street: "Rua A",
        number: "10",
        complement: null,
        neighborhood: "Centro",
        city: "Porto Alegre",
        state: "RS",
        zipCode: "90000-000",
      }),
    ).toBe("Rua A, 10 - Centro - Porto Alegre/RS - 90000-000");
  });
});
