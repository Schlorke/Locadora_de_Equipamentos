import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("diálogo de saída", () => {
  it("mantém o título, o aviso e os botões", () => {
    const source = readFileSync(
      "packages/frontend/src/widgets/cabecalho/ui/Sair.web.tsx",
      "utf8",
    );
    expect(source).toContain("Confirmar saída");
    expect(source).toContain(
      "Tem certeza que deseja sair da sua conta? Você precisará fazer login",
    );
    expect(source).toContain("novamente para acessar sua área do cliente.");
    expect(source).toContain("Cancelar");
    expect(source).toContain("Saindo...");
    expect(source).toContain(": 'Sair'");
    expect(source).toContain('aria-label="Fechar dialog"');
    expect(source).toContain("callbackUrl = '/'");
    expect(source).toContain("signOut({ callbackUrl })");
  });
});
