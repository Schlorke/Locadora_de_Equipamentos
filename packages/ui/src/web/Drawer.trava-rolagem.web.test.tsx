// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "./Drawer.web";

beforeAll(() => {
  // O vaul lê matchMedia e mede o conteúdo; o jsdom não tem nenhum dos dois.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function Exemplo({ open }: { open: boolean }) {
  return (
    <Drawer open={open}>
      <DrawerContent>
        <DrawerTitle>Filtros</DrawerTitle>
        <DrawerDescription>Escolha os filtros</DrawerDescription>
      </DrawerContent>
    </Drawer>
  );
}

describe("Drawer: trava de rolagem", () => {
  afterEach(cleanup);

  it("aberto não trava a página (sem data-scroll-locked nem pointer-events none) e, fechado, devolve o body", async () => {
    const { rerender } = render(<Exemplo open={false} />);
    await settle();
    expect(document.body.hasAttribute("data-scroll-released")).toBe(false);

    rerender(<Exemplo open />);
    await settle();
    expect(screen.getByRole("dialog")).not.toBeNull();
    // A marca do react-remove-scroll (overflow hidden e margem da barra, com !important) não fica no body.
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.body.hasAttribute("data-scroll-released")).toBe(true);
    expect(document.body.style.pointerEvents).not.toBe("none");

    rerender(<Exemplo open={false} />);
    await settle();
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.body.hasAttribute("data-scroll-released")).toBe(false);
  });
});
