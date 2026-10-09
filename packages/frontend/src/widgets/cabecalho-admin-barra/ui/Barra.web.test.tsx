import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cabecalho-admin-barra", () => {
  it("preserva gradiente e rgba do header desktop", () => {
    const source = readFileSync(
      new URL("./BarraDesktop.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain(
      "linear-gradient(145deg, rgba(51, 65, 85, 0.98), rgba(30, 41, 59, 0.95))"
    );
    expect(source).toContain("rgba(51, 65, 85, 0.98)");
    expect(source).toContain("rgba(255, 255, 255, 0.08)");
    expect(source).toContain("Bom dia");
    expect(source).toContain("Boa tarde");
    expect(source).toContain("Boa noite");
    expect(source).toContain("Financeiro");
  });

  it("preserva rgb do header mobile e gradiente do botão de menu", () => {
    const source = readFileSync(
      new URL("./BarraMobile.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("rgb(51, 65, 85)");
    expect(source).toContain(
      "linear-gradient(145deg, rgba(51, 65, 85, 0.9), rgba(30, 41, 59, 0.8))"
    );
    expect(source).toContain("from-orange-500 via-orange-600 to-orange-700");
    expect(source).toContain("onMenuOpen");
    expect(source).toContain("Abrir menu de navegação");
  });

  it("ações preservam rotas de perfil, settings e logout", () => {
    const source = readFileSync(
      new URL("./Acoes.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("/admin/perfil");
    expect(source).toContain("/admin/settings");
    expect(source).toContain("/admin/login");
    expect(source).toContain("Notificações");
    expect(source).toContain("Meu Perfil");
  });

  it("barra legada exporta slot de sidebar sem importar menu-admin", () => {
    const source = readFileSync(
      new URL("./Barra.web.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("sidebar?");
    expect(source).not.toContain("menu-admin");
    // Achado 143: a marca do painel é a da plataforma, nunca a da GB (o teste anterior afirmava a da GB).
    expect(source).toContain("Painel {MARCA_DO_PAINEL}");
    expect(source).not.toMatch(/GB Loca|GB Admin/);
  });
});
