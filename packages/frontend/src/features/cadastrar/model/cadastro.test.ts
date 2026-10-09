import { describe, expect, it } from "vitest";
import { formatCEP, formatCNPJ, formatCPF, formatPhoneNumber, registrationLoginUrl, registrationOAuthCallback } from "./cadastro";

describe("máscaras de cadastro", () => {
  it("formata telefone, cpf, cnpj e cep", () => {
    expect(formatPhoneNumber("51998205163")).toBe("(51) 99820-5163");
    expect(formatCPF("12345678901")).toBe("123.456.789-01");
    expect(formatCNPJ("12345678000199")).toBe("12.345.678/0001-99");
    expect(formatCEP("90240100")).toBe("90240-100");
  });

  it("monta a volta ao login preservando callback", () => {
    expect(registrationLoginUrl(null)).toBe("/login?registered=true");
    expect(registrationLoginUrl("/equipamentos")).toBe("/login?registered=true&callbackUrl=%2Fequipamentos");
    expect(registrationOAuthCallback(null)).toBe("/auth/callback");
    expect(registrationOAuthCallback("/equipamentos")).toBe("/auth/callback?callbackUrl=%2Fequipamentos");
  });
});
