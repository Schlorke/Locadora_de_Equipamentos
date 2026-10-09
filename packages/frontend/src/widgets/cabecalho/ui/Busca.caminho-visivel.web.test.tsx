// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalRoutePrefixProvider } from "../../../shared/lib/navigation";

const router = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => router.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

import { HeaderSearchCombobox } from "./Busca.web";

afterEach(cleanup);

function renderSearch() {
  const tree = () => (
    <InternalRoutePrefixProvider prefix="/acme">
      <HeaderSearchCombobox />
    </InternalRoutePrefixProvider>
  );
  const view = render(tree());
  fireEvent.click(screen.getByRole("button", { name: "Abrir busca de equipamentos" }));
  expect(screen.getByLabelText("Campo de busca")).toBeTruthy();
  return { rerender: () => view.rerender(tree()) };
}

describe("HeaderSearchCombobox: fecha só quando o caminho visível muda", () => {
  it("o roteador trocando o caminho interno pelo visível não é navegação", () => {
    // No servidor o roteador informa /{slug}/…; no navegador, o caminho visível.
    router.pathname = "/acme/equipamentos";
    const search = renderSearch();
    router.pathname = "/equipamentos";
    search.rerender();
    expect(screen.queryByLabelText("Campo de busca")).toBeTruthy();
  });

  it("navegar para outra página fecha a busca", () => {
    router.pathname = "/acme/equipamentos";
    const search = renderSearch();
    router.pathname = "/acme/sobre";
    search.rerender();
    expect(screen.queryByLabelText("Campo de busca")).toBeNull();
  });
});
