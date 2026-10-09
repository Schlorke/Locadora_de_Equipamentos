// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MENU_FOCUS_RING } from "./focus-ring";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from "./Menubar.web";
import { MENU_TRIGGER_FRAME } from "./trigger";

beforeAll(() => {
  class Observer { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal("ResizeObserver", Observer);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

function openMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole("menuitem", { name }), { button: 0, ctrlKey: false, pointerType: "mouse" });
}

describe("Menubar", () => {
  it("mantém Radix, bg-background e bg-popover no web", () => {
    const novo = vi.fn();
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Arquivo</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onSelect={novo}>Novo orçamento</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Exportar</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Editar</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Desfazer</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );

    const bar = screen.getByRole("menubar");
    expect(bar.className).toContain("flex h-10 items-center space-x-1 rounded-md border bg-background p-1");
    expect(screen.queryByRole("menu")).toBeNull();

    openMenu("Arquivo");
    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("bg-popover p-1 text-popover-foreground");
    expect(screen.getByRole("separator").className).toContain("bg-muted");
    expect(screen.getByRole("menuitem", { name: "Arquivo" }).getAttribute("aria-expanded")).toBe("true");
    // Foco: gatilho e itens com o anel só pelo teclado e sem contorno em repouso nem no clique, também nas cores
    // forçadas (estilo por elemento contra a produção: tests/visual/tailwind-parity.test.ts).
    const gatilho = screen.getByRole("menuitem", { name: "Arquivo" }).className.split(/\s+/);
    for (const cls of MENU_TRIGGER_FRAME.split(" ")) expect(gatilho, cls).toContain(cls);
    for (const item of ["Novo orçamento", "Exportar"]) {
      const classes = screen.getByRole("menuitem", { name: item }).className.split(/\s+/);
      for (const cls of MENU_FOCUS_RING.split(" ")) expect(classes, `${item}: ${cls}`).toContain(cls);
    }

    fireEvent.click(screen.getByRole("menuitem", { name: "Novo orçamento" }));
    expect(novo).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
