import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppProviders, ClientLayoutShell, SessionProviderWrapper, usePublicTenantRouting, type PublicTenantStorage } from "../index.web";
import { useSession, type SessionAdapter } from "../../entities/sessao";
import { PrivacidadePage } from "../../pages/privacidade";

vi.mock("next-auth/react", () => ({ getSession: vi.fn(), signOut: vi.fn() }));

// SSR real (sem jsdom): efeitos não rodam, então o HTML reflete só o primeiro render do servidor.
const storage: PublicTenantStorage = { getItem: () => null, setItem: () => undefined };
const auth = { getSession: vi.fn<SessionAdapter["getSession"]>(async () => null), signOut: vi.fn(async () => undefined) };
// Onda 134: o texto é o documento publicado da locadora, que o host web lê no servidor e entrega à página.
const documento = {
  document: {
    version: 1 as const,
    lastUpdated: "2 de março de 2026",
    sections: [{ id: "coleta", title: "Informações que Coletamos", blocks: [{ type: "paragraph" as const, text: "Nome e telefone." }] }],
  },
  publishedAt: null,
};

function HostLikeRoute({ pathname }: { pathname: string }) {
  const routing = usePublicTenantRouting({ pathname, explicitSlug: undefined, storage, applySlug: () => {} });
  return (
    <AppProviders auth={auth} navigate={() => {}} refreshKey={pathname} {...routing}>
      <ClientLayoutShell>
        <PrivacidadePage documento={documento} />
      </ClientLayoutShell>
    </AppProviders>
  );
}

function AccountStatus() {
  const session = useSession();
  return <p>{`${session.status}:${session.data?.user.name ?? "visitante"}`}</p>;
}

describe("SSR das rotas públicas com o bootstrap de sessão", () => {
  it("página pública sai no HTML do servidor com o conteúdo, sem 'Carregando...'", () => {
    const html = renderToString(<HostLikeRoute pathname="/privacidade" />);
    expect(html).toContain("Política de Privacidade");
    expect(html).toContain("Informações que Coletamos");
    expect(html).not.toContain("Carregando...");
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("rotas privadas continuam aguardando a sessão no servidor", () => {
    const html = renderToString(<HostLikeRoute pathname="/area-cliente" />);
    expect(html).toContain("Carregando...");
    expect(html).not.toContain("Informações que Coletamos");
  });

  it("o portão da área privada fica dentro do shell: a moldura da rota continua montada", () => {
    const html = renderToString(<HostLikeRoute pathname="/area-cliente" />);
    // A espera aparece no lugar do conteúdo da rota, dentro do contêiner do shell (não no lugar do shell inteiro).
    expect(html).toMatch(/<div class="min-h-screen pt-\[calc\(env\(safe-area-inset-top,0px\)\+var\(--header-offset\)\)\]">[\s\S]*Carregando\.\.\./);
    expect(html).toContain('data-scroll-behavior="smooth"');
  });

  it("host legado entrega a sessão do servidor já no primeiro HTML", () => {
    const html = renderToString(
      <SessionProviderWrapper session={{ user: { id: "user-1", role: "CLIENT", name: "Ana" }, expires: "2099-01-01T00:00:00.000Z" }}>
        <AccountStatus />
      </SessionProviderWrapper>,
    );
    expect(html).toContain("authenticated:Ana");
    expect(html).not.toContain("Carregando...");
  });
});
