// @vitest-environment jsdom
// Área do cliente em modo host (ADR adr-tenant-hosts D9, Lote 6): a locadora é a do host, lida por
// GET /api/auth/organizations/current; sem seletor, sem x-tenant-id; 404 NO_MEMBERSHIP leva à tela de vínculo.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders, PrivateAreaGate, type HttpClient, type TenantContext } from "../index";
import { useSession, type SessionAdapter, type SessionSnapshot } from "../../entities/sessao";
import { HttpError, useApiClient } from "../../shared/api";

const ana = { user: { id: "user-1", name: "Ana" }, expires: "2099-01-01T00:00:00.000Z" };
const clienteA: TenantContext = { tenant: { id: "t-a", slug: "locadora-a", name: "Locadora A", status: "ACTIVE" }, membershipId: "m-a", role: "CLIENT" };

type Call = { path: string; method: string; headers: Record<string, string> };

/** API falsa: o vínculo da locadora do host responde conforme `current()`; qualquer outra rota só é registrada. */
function hostApi(current: () => TenantContext | number) {
  const calls: Call[] = [];
  const client: HttpClient = {
    async request<T>(path: string, options: { method?: string; headers?: Record<string, string> } = {}) {
      calls.push({ path, method: options.method ?? "GET", headers: options.headers ?? {} });
      if (path === "/api/auth/organizations/current") {
        const result = current();
        if (typeof result === "number") throw new HttpError(result === 404 ? "Sem vínculo com esta locadora" : "Organization access denied", result);
        return { membership: result } as T;
      }
      return {} as T;
    },
  };
  return { client, calls };
}

function adapter(): SessionAdapter & { signOut: ReturnType<typeof vi.fn> } {
  return { getSession: vi.fn(async () => ana), signOut: vi.fn(async () => undefined) };
}

function AreaContent() {
  const session = useSession();
  const api = useApiClient();
  return (
    <div>
      <h1>Área do cliente</h1>
      <span data-testid="role">{session.data?.user.role ?? "sem papel"}</span>
      <button onClick={() => { void api.request("/api/user/profile"); }}>Carregar perfil</button>
    </div>
  );
}

/** Fora da área privada (como a tela /vincular): revalida a sessão depois do vínculo. */
function Revalidate() {
  const session = useSession();
  return (
    <>
      <button onClick={() => { void session.update(); }}>Revalidar sessão</button>
      <button onClick={() => { void session.signOut(); }}>Sair</button>
    </>
  );
}

function renderHostArea({ api, auth = adapter(), navigate = vi.fn(), children = <AreaContent />, session = ana, at = "/area-cliente" }: { api: HttpClient; auth?: SessionAdapter; navigate?: (href: string) => void; children?: ReactNode; session?: SessionSnapshot; at?: string }) {
  const view = (refreshKey: string) => (
    // Como o TenantSiteProviders: modo host do roteamento público (prefixo interno /{slug}).
    <AppProviders apiClient={api} auth={auth} navigate={navigate} publicTenantSlug="locadora-a" internalRoutePrefix="/locadora-a" privateArea refreshKey={refreshKey} initialSession={session}>
      <Revalidate />
      <PrivateAreaGate>{children}</PrivateAreaGate>
    </AppProviders>
  );
  const result = render(view(at));
  return { auth, navigate, navigateTo: (refreshKey: string) => result.rerender(view(refreshKey)) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("RuntimeBootstrap em modo host", () => {
  it("com vínculo ativo abre a área sem seletor, sem listar vínculos e sem x-tenant-id", async () => {
    const { client, calls } = hostApi(() => clienteA);
    renderHostArea({ api: client });
    expect(await screen.findByText("Área do cliente")).toBeTruthy();
    expect(screen.getByTestId("role").textContent).toBe("CLIENT");
    expect(screen.queryByText("Locadora")).toBeNull();
    expect(screen.queryByText("Selecione uma locadora")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Carregar perfil" }));
    await waitFor(() => expect(calls.some((call) => call.path === "/api/user/profile")).toBe(true));
    expect(calls.map((call) => call.path).filter((path) => path.startsWith("/api/auth/organizations"))).toEqual(["/api/auth/organizations/current"]);
    expect(calls.every((call) => !("x-tenant-id" in call.headers))).toBe(true);
  });

  it("404 NO_MEMBERSHIP fecha a área e leva à tela de vínculo", async () => {
    const { client } = hostApi(() => 404);
    const { navigate } = renderHostArea({ api: client });
    const enroll = await screen.findByRole("button", { name: "Vincular minha conta" });
    expect(screen.queryByText("Área do cliente")).toBeNull();
    fireEvent.click(enroll);
    expect(navigate).toHaveBeenCalledWith("/vincular");
  });

  it("vínculo suspenso ou revogado (403) mantém a área fechada, sem oferecer vínculo", async () => {
    const { client } = hostApi(() => 403);
    renderHostArea({ api: client });
    expect(await screen.findByText("Seu acesso a esta locadora está suspenso ou foi encerrado. Fale com a locadora.")).toBeTruthy();
    expect(screen.queryByText("Área do cliente")).toBeNull();
    expect(screen.queryByRole("button", { name: "Vincular minha conta" })).toBeNull();
  });

  it("depois do vínculo, revalidar a sessão consulta de novo e abre a área", async () => {
    let enrolled = false;
    const { client, calls } = hostApi(() => (enrolled ? clienteA : 404));
    renderHostArea({ api: client });
    await screen.findByRole("button", { name: "Vincular minha conta" });
    enrolled = true;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Revalidar sessão" })); });
    expect(await screen.findByText("Área do cliente")).toBeTruthy();
    expect(calls.filter((call) => call.path === "/api/auth/organizations/current").length).toBe(2);
  });

  it("navegar revalida a sessão sem reconsultar o vínculo (como a seleção explícita)", async () => {
    const { client, calls } = hostApi(() => clienteA);
    const auth = adapter();
    const { navigateTo } = renderHostArea({ api: client, auth });
    await screen.findByText("Área do cliente");
    navigateTo("/area-cliente/perfil");
    await waitFor(() => expect(auth.getSession).toHaveBeenCalledOnce());
    // Deixa a revalidação da sessão terminar antes de contar as consultas do vínculo.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(screen.getByText("Área do cliente")).toBeTruthy();
    expect(calls.filter((call) => call.path === "/api/auth/organizations/current").length).toBe(1);
  });

  it.each([
    ["caminho visível", "/area-cliente/perfil"],
    ["caminho interno do rewrite", "/locadora-a/area-cliente/perfil"],
  ])("sem sessão, 'Entrar' leva ao login com retorno para o caminho visível e a query (rota informada pelo %s)", async (_caso, route) => {
    const { client } = hostApi(() => clienteA);
    // No host de locadora a URL do navegador é a visível; o prefixo /locadora-a é só do rewrite interno.
    window.history.replaceState(null, "", "/area-cliente/perfil?aba=enderecos");
    // A vitrine mantém o pedido de login (achado 115: só o painel do host `app` troca a rota sozinho).
    const real = window.location;
    const replace = vi.fn();
    vi.stubGlobal("location", { get pathname() { return real.pathname; }, get search() { return real.search; }, replace });
    const { navigate } = renderHostArea({ api: client, session: null, at: route });
    expect(await screen.findByText("Entre na sua conta para acessar a área do cliente.")).toBeTruthy();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(replace).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(navigate).toHaveBeenCalledWith("/login?callbackUrl=" + encodeURIComponent("/area-cliente/perfil?aba=enderecos"));
  });

  it("sair encerra só a sessão deste host, sem tocar na seleção do painel", async () => {
    const { client, calls } = hostApi(() => clienteA);
    const { auth } = renderHostArea({ api: client });
    await screen.findByText("Área do cliente");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sair" })); });
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(calls.some((call) => call.path.startsWith("/api/auth/organizations/selection"))).toBe(false);
  });
});
