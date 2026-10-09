// @vitest-environment jsdom
// Confirmação do `?locadora=` no painel (ADR adr-tenant-hosts D8): o host da locadora redireciona /admin para
// app.<raiz>/admin?locadora={slug}. O parâmetro é só sugestão: confirmada quando diverge da seleção atual.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TenantContext } from "../../../entities/organizacao";
import { ApiClientProvider, type HttpClient } from "../../../shared/api";
import { TenantSelector, useTenantSelection, useTenantSuggestion } from "../index";

const membership = (slug: string, name: string): TenantContext => ({ tenant: { id: "t-" + slug, slug, name, status: "ACTIVE" }, membershipId: "m-" + slug, role: "ADMIN" });
const locadoraA = membership("locadora-a", "Locadora A");
const locadoraB = membership("locadora-b", "Locadora B");

function panelApi(initial: TenantContext | null) {
  let selection = initial;
  const posts: string[] = [];
  const client: HttpClient = {
    async request<T>(path: string, options: { method?: string; body?: string } = {}) {
      if (path === "/api/auth/organizations") return { memberships: [locadoraA, locadoraB] } as T;
      if (path === "/api/auth/organizations/selection" && options.method === "POST") {
        const { tenantId } = JSON.parse(options.body ?? "{}") as { tenantId: string };
        posts.push(tenantId);
        selection = [locadoraA, locadoraB].find((item) => item.tenant.id === tenantId) ?? null;
        return { selection } as T;
      }
      return { selection } as T;
    },
  };
  /** A seleção que o servidor guarda para a próxima conta que entrar. */
  const storedSelection = (next: TenantContext | null) => { selection = next; };
  return { client, posts, storedSelection };
}

/**
 * `readKey`: a rota atual, como o `refreshKey` que o host passa (web: o caminho visível). `userId`: a conta da sessão,
 * como o host passa ao `useTenantSelection` (`null` = sem sessão).
 */
function Panel({ readKey, userId = "user-1" }: { readKey?: string; userId?: string | null } = {}) {
  const tenant = useTenantSelection(userId);
  const suggestion = useTenantSuggestion({ memberships: tenant.memberships, selection: tenant.selection, loading: tenant.loading, select: tenant.select, readKey });
  return (
    <>
      <output data-testid="selecao">{tenant.selection?.tenant.slug ?? "nenhuma"}</output>
      <TenantSelector {...tenant} onSelect={(id) => { void tenant.select(id); }} onRetry={() => {}} suggestion={suggestion.pending} onConfirmSuggestion={suggestion.accept} onDismissSuggestion={suggestion.dismiss} />
    </>
  );
}

function openPanel(url: string, initial: TenantContext | null) {
  window.history.replaceState(null, "", url);
  const api = panelApi(initial);
  render(<ApiClientProvider client={api.client}><Panel /></ApiClientProvider>);
  return api;
}

beforeAll(() => {
  // O seletor é o Select do Radix: no jsdom faltam estas APIs de ponteiro e rolagem.
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const question = "Você veio do endereço de Locadora B. Trocar a locadora do painel de Locadora A para Locadora B?";

/** Escolhe a locadora pelo próprio seletor (não pela pergunta), pelo teclado como a pessoa faria. */
async function chooseInSelector(name: string) {
  await act(async () => { fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" }); });
  await act(async () => { fireEvent.keyDown(await screen.findByRole("option", { name }), { key: "Enter" }); });
}

/** Navegação no cliente: a URL muda e o host troca a chave de leitura (e, na saída/entrada, a conta). */
function panelAt(api: ReturnType<typeof panelApi>) {
  return (url: string, userId: string | null = "user-1") => {
    window.history.replaceState(null, "", url);
    return <ApiClientProvider client={api.client}><Panel readKey={new URL(url, "http://painel.invalid").pathname} userId={userId} /></ApiClientProvider>;
  };
}

describe("?locadora= no painel", () => {
  it("diverge da seleção atual: pede confirmação e só troca ao confirmar", async () => {
    const { posts } = openPanel("/admin/orcamentos?locadora=locadora-b", locadoraA);
    expect(await screen.findByText("Você veio do endereço de Locadora B. Trocar a locadora do painel de Locadora A para Locadora B?")).toBeTruthy();
    expect(posts).toEqual([]);
    expect(screen.getByTestId("selecao").textContent).toBe("locadora-a");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Trocar para Locadora B" })); });
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-b"));
    expect(posts).toEqual(["t-locadora-b"]);
    expect(screen.queryByRole("button", { name: "Trocar para Locadora B" })).toBeNull();
  });

  it("dispensar mantém a seleção atual", async () => {
    const { posts } = openPanel("/admin?locadora=locadora-b", locadoraA);
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("button", { name: "Trocar para Locadora B" })).toBeNull();
    expect(posts).toEqual([]);
    expect(screen.getByTestId("selecao").textContent).toBe("locadora-a");
  });

  it("sem seleção, confirma a abertura do painel da locadora sugerida", async () => {
    const { posts } = openPanel("/admin?locadora=locadora-b", null);
    const open = await screen.findByRole("button", { name: "Abrir Locadora B" });
    expect(screen.getByText("Você veio do endereço de Locadora B. Abrir o painel de Locadora B?")).toBeTruthy();
    await act(async () => { fireEvent.click(open); });
    await waitFor(() => expect(posts).toEqual(["t-locadora-b"]));
  });

  it("com outra locadora já selecionada, a pergunta sobrevive ao índice /admin trocar a URL pelo dashboard sem a query", async () => {
    window.history.replaceState(null, "", "/admin?locadora=locadora-b");
    const api = panelApi(locadoraA);
    const at = (route: string) => <ApiClientProvider client={api.client}><Panel readKey={route} /></ApiClientProvider>;
    const view = render(at("/admin"));
    expect(await screen.findByText(question)).toBeTruthy();
    // O índice /admin redireciona (router.replace) e o host troca a chave de leitura pela nova rota.
    window.history.replaceState(null, "", "/admin/dashboard");
    view.rerender(at("/admin/dashboard"));
    await act(async () => {});
    expect(screen.getByText(question)).toBeTruthy();
    window.history.replaceState(null, "", "/admin/orcamentos");
    view.rerender(at("/admin/orcamentos"));
    await act(async () => {});
    expect(screen.getByText(question)).toBeTruthy();
    expect(screen.getByTestId("selecao").textContent).toBe("locadora-a");
    expect(api.posts).toEqual([]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Trocar para Locadora B" })); });
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-b"));
    expect(api.posts).toEqual(["t-locadora-b"]);
  });

  it("guardada até ser dispensada; dispensada, não volta nas navegações seguintes, nem com o mesmo ?locadora=", async () => {
    window.history.replaceState(null, "", "/admin?locadora=locadora-b");
    const api = panelApi(locadoraA);
    const at = (route: string) => <ApiClientProvider client={api.client}><Panel readKey={route} /></ApiClientProvider>;
    const view = render(at("/admin"));
    expect(await screen.findByRole("button", { name: "Agora não" })).toBeTruthy();
    window.history.replaceState(null, "", "/admin/dashboard");
    view.rerender(at("/admin/dashboard"));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    for (const [url, route] of [["/admin/equipamentos", "/admin/equipamentos"], ["/admin/orcamentos?locadora=locadora-b", "/admin/orcamentos"]]) {
      window.history.replaceState(null, "", url);
      view.rerender(at(route));
      await act(async () => {});
      expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    }
    expect(api.posts).toEqual([]);
    expect(screen.getByTestId("selecao").textContent).toBe("locadora-a");
  });

  it("escolher a locadora sugerida pelo seletor atende a sugestão: voltar depois à anterior não repete a pergunta", async () => {
    const api = panelApi(locadoraA);
    const at = panelAt(api);
    const view = render(at("/admin?locadora=locadora-b"));
    expect(await screen.findByText(question)).toBeTruthy();
    await chooseInSelector("Locadora B");
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-b"));
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    view.rerender(at("/admin/equipamentos"));
    await act(async () => {});
    await chooseInSelector("Locadora A");
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-a"));
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    expect(api.posts).toEqual(["t-locadora-b", "t-locadora-a"]);
  });

  it("chegando já na locadora sugerida, a troca manual para outra na mesma página não vira pergunta", async () => {
    const api = panelApi(locadoraB);
    render(panelAt(api)("/admin/dashboard?locadora=locadora-b"));
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-b"));
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    await chooseInSelector("Locadora A");
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-a"));
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    expect(api.posts).toEqual(["t-locadora-a"]);
  });

  it("a sugestão guardada acaba com a sessão: sair e entrar (outra conta) numa rota sem ?locadora= não traz a pergunta", async () => {
    const api = panelApi(locadoraA);
    const at = panelAt(api);
    const view = render(at("/admin?locadora=locadora-b"));
    expect(await screen.findByText(question)).toBeTruthy();
    view.rerender(at("/admin/equipamentos"));
    await act(async () => {});
    expect(screen.getByText(question)).toBeTruthy();
    // Saída: a sessão acaba nesta rota; o "Entrar" leva ao login, que volta (replace) para a rota sem a sugestão.
    view.rerender(at("/admin/equipamentos", null));
    await act(async () => {});
    view.rerender(at("/login?callbackUrl=%2Fadmin%2Fequipamentos", null));
    await act(async () => {});
    view.rerender(at("/admin/equipamentos", "user-2"));
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-a"));
    await act(async () => {});
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    expect(api.posts).toEqual([]);
  });

  it("o que a conta anterior dispensou não vale para a próxima: com o ?locadora= na volta do login, a pergunta aparece", async () => {
    const api = panelApi(locadoraA);
    const at = panelAt(api);
    const view = render(at("/admin?locadora=locadora-b"));
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(screen.queryByText(question)).toBeNull();
    view.rerender(at("/admin?locadora=locadora-b", null));
    await act(async () => {});
    view.rerender(at("/login?callbackUrl=%2Fadmin%3Flocadora%3Dlocadora-b", null));
    await act(async () => {});
    view.rerender(at("/admin/dashboard?locadora=locadora-b", "user-2"));
    expect(await screen.findByText(question)).toBeTruthy();
    expect(api.posts).toEqual([]);
  });

  it("a conta que entra sem navegar (mesma rota) recebe a sugestão que a URL atual traz", async () => {
    const api = panelApi(locadoraB);
    const at = panelAt(api);
    const view = render(at("/admin/dashboard?locadora=locadora-b"));
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-b"));
    view.rerender(at("/admin/dashboard?locadora=locadora-b", null));
    await act(async () => {});
    api.storedSelection(locadoraA);
    view.rerender(at("/admin/dashboard?locadora=locadora-b", "user-2"));
    expect(await screen.findByText(question)).toBeTruthy();
    expect(api.posts).toEqual([]);
  });

  it("igual à seleção atual ou sem vínculo com o usuário: nada a confirmar", async () => {
    openPanel("/admin?locadora=locadora-a", locadoraA);
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-a"));
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    cleanup();
    const { posts } = openPanel("/admin?locadora=locadora-z", locadoraA);
    await waitFor(() => expect(screen.getByTestId("selecao").textContent).toBe("locadora-a"));
    expect(screen.queryByText(/Você veio do endereço/)).toBeNull();
    expect(posts).toEqual([]);
  });
});
