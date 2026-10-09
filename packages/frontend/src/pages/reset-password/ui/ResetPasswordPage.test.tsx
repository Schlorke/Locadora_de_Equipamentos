import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IdentidadePublicaProvider } from "../../../entities/organizacao";
import { ResetPasswordPage } from "./ResetPasswordPage";

// Achado 146: a vitrine de outra locadora mostrava a sigla fixa "GB". O teste anterior afirmava esse defeito
// (`/>\s*GB\s*<\/span>/` na casca padrão); agora a sigla vem do cartão público da própria locadora.
const LOCADORA = { nome: "Locadora Nova", cidade: "Curitiba", uf: "PR", logoUrl: null };
const naVitrine = (props: Parameters<typeof ResetPasswordPage>[0] = {}) =>
  renderToStaticMarkup(
    createElement(IdentidadePublicaProvider, {
      value: LOCADORA,
      children: createElement(ResetPasswordPage, props),
    })
  );

describe("ResetPasswordPage", () => {
  it("sem token mostra o link inválido e o pedido de novo link", () => {
    const html = naVitrine();
    expect(html).toContain("Link invalido");
    expect(html).toContain('href="/recuperar-senha"');
  });

  it("com token mostra o formulário de nova senha", () => {
    const html = naVitrine({ token: "token-teste" });
    expect(html).toContain("Redefinir Senha");
    expect(html).toContain("Nova senha");
    expect(html).toContain('href="/login"');
  });

  it("na vitrine (padrão): sobe sob o cabeçalho fixo e mostra a sigla da própria locadora", () => {
    const frame = '<div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 -mt-[100px] md:-mt-[96px]"><div class="flex min-h-screen items-center justify-center px-4 pt-[120px] md:pt-0">';
    expect(naVitrine()).toContain(frame);
    const form = naVitrine({ token: "token-teste" });
    expect(form).toContain(frame);
    expect(form).toMatch(/>\s*LN\s*<\/span>/);
    expect(form).not.toMatch(/>\s*GB\s*</);
    expect(form).not.toContain(PLATFORM.displayName);
  });

  it("vitrine sem locadora identificada: nenhuma sigla, nem a da GB", () => {
    const form = renderToStaticMarkup(createElement(ResetPasswordPage, { token: "token-teste" }));
    expect(form).toMatch(/relative z-10">\s*<\/span>/);
    expect(form).not.toMatch(/>\s*GB\s*</);
    expect(form).not.toContain(PLATFORM.displayName);
  });

  it("na casca da plataforma: o nome da plataforma no lugar da sigla da locadora, sem o deslocamento do cabeçalho da vitrine", () => {
    for (const token of ["", "token-teste"]) {
      const html = naVitrine({ token, shell: "platform" });
      expect(html).not.toContain("-mt-[");
      expect(html).not.toContain("min-h-screen");
      expect(html).toContain('<div class="flex flex-1 flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">');
    }
    const form = naVitrine({ token: "token-teste", shell: "platform" });
    expect(form).toMatch(new RegExp(`>\\s*${PLATFORM.displayName}\\s*</span>`));
    expect(form).not.toMatch(/>\s*(?:GB|LN)\s*</);
  });
});
