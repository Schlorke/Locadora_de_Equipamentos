import { describe, expect, it } from "vitest";
import { avisoFim, avisoInicio, avisoLogin, avisoSucesso } from "./avisos";

describe("avisos do detalhe", () => {
  it("mantém os três avisos de data no canto superior direito por 8 segundos", () => {
    expect(avisoInicio).toEqual({
      message: "Selecione a data de início",
      description: "Clique no calendário para escolher quando a locação começa",
      position: "top-right",
      duration: 8000,
    });
    expect(avisoFim.message).toBe("Agora selecione a data final");
    expect(avisoFim.duration).toBe(8000);
    expect(avisoSucesso(1).description).toBe(
      "Período de 1 dia configurado. Agora você pode escolher o período de locação.",
    );
    expect(avisoSucesso(3).description).toBe(
      "Período de 3 dias configurado. Agora você pode escolher o período de locação.",
    );
  });

  it("pede login no centro por 12 segundos", () => {
    expect(avisoLogin.position).toBe("top-center");
    expect(avisoLogin.duration).toBe(12000);
    expect(avisoLogin.message).toBe("Login necessário");
  });
});
