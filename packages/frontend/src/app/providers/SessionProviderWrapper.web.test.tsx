// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession, signOut } from "next-auth/react";
import { SessionProviderWrapper, SEOSchemas, defaultFAQItems } from "../index.web";
import { useSession } from "../../entities/sessao";

vi.mock("next-auth/react", () => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const getSessionMock = vi.mocked(getSession);
const signOutMock = vi.mocked(signOut);

function SessionProbe() {
  const session = useSession();
  return (
    <div>
      <span>Route content</span>
      <span data-testid="status">{session.status}</span>
      <span data-testid="user">{session.data?.user.name ?? "visitante"}</span>
      <button type="button" onClick={() => { void session.signOut(); }}>Sair</button>
    </div>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const body = input === "/api/auth/organizations" ? { memberships: [] } : { selection: null };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  getSessionMock.mockReset();
  signOutMock.mockReset();
});

describe("Web layout providers", () => {
  it("sem sessão do servidor, entrega os filhos já em 'loading' e resolve pelo next-auth", async () => {
    let resolveSession!: (value: Awaited<ReturnType<typeof getSession>>) => void;
    getSessionMock.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    render(<SessionProviderWrapper><SessionProbe /></SessionProviderWrapper>);

    expect(screen.getByText("Route content")).toBeTruthy();
    expect(screen.getByTestId("status").textContent).toBe("loading");
    expect(screen.queryByText("Carregando...")).toBeNull();

    resolveSession({ user: { id: "user-1", role: "CLIENT", name: "Ana", email: "ana@example.test" }, expires: "2099-01-01T00:00:00.000Z" });

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("user").textContent).toBe("Ana");
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("usa a sessão lida no servidor sem getSession duplicado", async () => {
    render(<SessionProviderWrapper session={{ user: { id: "user-1", role: "CLIENT", name: "Ana" }, expires: "2099-01-01T00:00:00.000Z" }}><SessionProbe /></SessionProviderWrapper>);

    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("user").textContent).toBe("Ana");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("sessão nula do servidor é visitante sem consultar o next-auth", async () => {
    render(<SessionProviderWrapper session={null}><SessionProbe /></SessionProviderWrapper>);

    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    expect(screen.getByTestId("user").textContent).toBe("visitante");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("sem sessão no next-auth, renderiza a rota pública como visitante", async () => {
    getSessionMock.mockResolvedValue(null);
    render(<SessionProviderWrapper><SessionProbe /></SessionProviderWrapper>);

    expect(await screen.findByText("Route content")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("user").textContent).toBe("visitante");
  });

  it("sair encerra a sessão no next-auth sem redirecionar e volta a visitante", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "user-1", role: "CLIENT", name: "Ana" }, expires: "2099-01-01T00:00:00.000Z" });
    signOutMock.mockResolvedValue(undefined);
    render(<SessionProviderWrapper><SessionProbe /></SessionProviderWrapper>);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledExactlyOnceWith({ redirect: false }));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("user").textContent).toBe("visitante");
  });

  it("emits parseable JSON-LD and includes FAQ only when requested", () => {
    // Organization só com a locadora informada (achado 143): sem ela, nenhum dado padrão de outra locadora.
    const business = { name: "Locadora Alfa", url: "https://locadora-alfa.example.test" };
    const render = (faq: boolean, withBusiness = true) => [...renderToStaticMarkup(<SEOSchemas business={withBusiness ? business : null} includeFAQ={faq} faqItems={defaultFAQItems} />).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]!));
    expect(render(false).some((schema) => schema["@type"] === "Organization")).toBe(true);
    expect(render(false, false)).toEqual([]);
    expect(render(false).some((schema) => schema["@type"] === "FAQPage")).toBe(false);
    const faq = render(true).find((schema) => schema["@type"] === "FAQPage"); expect(faq.mainEntity).toHaveLength(defaultFAQItems.length);
  });
});
