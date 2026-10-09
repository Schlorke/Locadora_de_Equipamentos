import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Contato da home", () => {
  it("exige CPF ou CNPJ e envia POST em /api/contact", () => {
    const source = readFileSync(new URL("./ContatoHome.web.tsx", import.meta.url), "utf8");
    expect(source).toContain("Entre em Contato");
    expect(source).toContain("Erro de Validação");
    expect(source).toContain("Por favor, preencha pelo menos o CPF ou CNPJ.");
    expect(source).toContain("fetch('/api/contact'");
    expect(source).toContain("method: 'POST'");
    expect(source).toContain("equipment: formData.materials");
    expect(source).toContain("Orçamento Enviado com Sucesso! 🎉");
    expect(source).toContain("duration: 8000");
    expect(source).toContain("Erro ao Enviar");
    expect(source).toContain('placeholder="(51) 99999-9999"');
    expect(source).toContain('placeholder="00000-000"');
    expect(source).toContain("Enviar Solicitação");
  });
});
