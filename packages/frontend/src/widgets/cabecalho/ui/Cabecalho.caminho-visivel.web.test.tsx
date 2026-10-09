// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalRoutePrefixProvider } from "../../../shared/lib/navigation";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => router.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }));
vi.mock("../../../entities/sessao", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));
vi.mock("../../../entities/configuracao", () => ({ usePublicSettings: () => ({ settings: { companyPhone: "(00) 0000-0000", whatsappNumber: "(00) 00000-0000", companyIconUrl: "/icon.png" } }) }));
vi.mock("../../../features/carrinho", () => ({ useCartNotifications: () => ({ itemCount: 0 }) }));
vi.mock("./Busca.web", () => ({ HeaderSearchCombobox: () => null }));
vi.mock("./Sair.web", () => ({ LogoutConfirmationDialog: () => null }));

import Header from "./Cabecalho.web";

/** Links da navegação desktop marcados como página atual (texto laranja fixo). */
function activeDesktopLinks() {
  const [desktop] = screen.getAllByRole("navigation");
  return within(desktop!)
    .getAllByRole("link")
    .filter((link) => link.className.split(/\s+/).includes("text-orange-600"))
    .map((link) => link.textContent);
}

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

describe("Header: página ativa pelo caminho visível", () => {
  it("no modo host marca a página mesmo com o prefixo interno /{slug}", () => {
    router.pathname = "/acme/equipamentos/eq-1";
    render(
      <InternalRoutePrefixProvider prefix="/acme">
        <Header />
      </InternalRoutePrefixProvider>,
    );
    expect(activeDesktopLinks()).toEqual(["Equipamentos"]);
  });

  it("no modo host a raiz da vitrine é a página Início", () => {
    router.pathname = "/acme";
    render(
      <InternalRoutePrefixProvider prefix="/acme">
        <Header />
      </InternalRoutePrefixProvider>,
    );
    expect(activeDesktopLinks()).toEqual(["Início"]);
  });

  it("fora do modo host usa o caminho do roteador", () => {
    router.pathname = "/contato";
    render(<Header />);
    expect(activeDesktopLinks()).toEqual(["Contato"]);
  });
});
