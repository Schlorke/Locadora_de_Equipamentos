// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalRoutePrefixProvider } from "../../../shared/lib/navigation";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => router.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock("../../../entities/sessao", () => ({
  useSession: () => ({ data: { user: { id: "u1", name: "Ana", role: "CLIENT" } }, status: "authenticated" }),
}));
vi.mock("./Sair.web", () => ({ LogoutConfirmationDialog: () => null }));

import { AreaClienteLayout } from "./AreaCliente.web";

/** O item ativo do menu usa o gradiente laranja; os demais não. */
const activeItems = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.className.split(/\s+/).includes("bg-gradient-to-r"))
    .map((link) => link.textContent);

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AreaClienteLayout: item ativo pelo caminho visível", () => {
  it("no modo host marca o item mesmo com o prefixo interno /{slug}", () => {
    router.pathname = "/acme/area-cliente/historico/q-1";
    render(
      <InternalRoutePrefixProvider prefix="/acme">
        <AreaClienteLayout>conteúdo</AreaClienteLayout>
      </InternalRoutePrefixProvider>,
    );
    expect(activeItems()).toEqual(["Meus Orçamentos"]);
  });

  it("fora do modo host usa o caminho do roteador", () => {
    router.pathname = "/area-cliente/perfil";
    render(<AreaClienteLayout>conteúdo</AreaClienteLayout>);
    expect(activeItems()).toEqual(["Meu Perfil"]);
  });
});
