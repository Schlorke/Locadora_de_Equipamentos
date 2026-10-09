import { PLATFORM } from "@gb-locacoes/contracts/platform";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IdentidadePublicaProvider } from "../../../entities/organizacao";
import { RecuperarSenhaPage } from "./RecuperarSenhaPage";

// Achado 146: a vitrine de outra locadora mostrava a sigla fixa "GB". O teste anterior afirmava esse defeito
// (`/>\s*GB\s*<\/span>/` na casca padrão); agora a sigla vem do cartão público da própria locadora.
const LOCADORA = { nome: "Locadora Nova", cidade: "Curitiba", uf: "PR", logoUrl: null };
const naVitrine = (props: Parameters<typeof RecuperarSenhaPage>[0] = {}) =>
  renderToStaticMarkup(
    createElement(IdentidadePublicaProvider, {
      value: LOCADORA,
      children: createElement(RecuperarSenhaPage, props),
    })
  );

describe("RecuperarSenhaPage", () => {
  it("mantém o título, o e-mail e o link de volta ao login", () => {
    const html = naVitrine();
    expect(html).toContain("Recuperar Senha");
    expect(html).toContain('placeholder="seu@email.com"');
    expect(html).toContain('href="/login"');
  });

  it("na vitrine (padrão): sobe sob o cabeçalho fixo e mostra a sigla da própria locadora", () => {
    const html = naVitrine();
    expect(html).toContain('<div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 -mt-[100px] md:-mt-[96px]"><div class="flex min-h-screen items-center justify-center px-4 pt-[120px] md:pt-0">');
    expect(html).toContain('<div class="mx-auto flex h-16 w-16 items-center');
    expect(html).toMatch(/>\s*LN\s*<\/span>/);
    expect(html).not.toMatch(/>\s*GB\s*</);
    expect(html).not.toContain(PLATFORM.displayName);
  });

  it("vitrine sem locadora identificada: nenhuma sigla, nem a da GB", () => {
    const html = renderToStaticMarkup(createElement(RecuperarSenhaPage));
    expect(html).toMatch(/relative z-10">\s*<\/span>/);
    expect(html).not.toMatch(/>\s*GB\s*</);
    expect(html).not.toContain(PLATFORM.displayName);
  });

  it("na casca da plataforma: o nome da plataforma no lugar da sigla da locadora, sem o deslocamento do cabeçalho da vitrine", () => {
    const html = naVitrine({ shell: "platform" });
    expect(html).toMatch(new RegExp(`>\\s*${PLATFORM.displayName}\\s*</span>`));
    expect(html).not.toMatch(/>\s*(?:GB|LN)\s*</);
    expect(html).not.toContain("-mt-[");
    expect(html).not.toContain("min-h-screen");
    expect(html).toContain('<div class="flex flex-1 flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">');
    expect(html).toContain("Recuperar Senha");
  });
});
