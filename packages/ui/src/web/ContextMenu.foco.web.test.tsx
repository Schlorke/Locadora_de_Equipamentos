// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "./ContextMenu.web";
import { MENU_FOCUS_RING } from "./focus-ring";

beforeAll(() => {
  // O posicionamento do Radix observa o tamanho do conteúdo; o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("ContextMenu: foco", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-input-modality");
  });

  it("itens e subgatilho levam o anel só pelo teclado e nenhum contorno em repouso nem no clique, também nas cores forçadas", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Área</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Copiar</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Mais</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Duplicar</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Área"));
    const itens = screen.getAllByRole("menuitem");
    expect(itens.map((item) => item.textContent)).toEqual(["Copiar", "Mais"]);
    // Estilo por elemento contra a produção e a regra do foco: tests/visual/tailwind-parity.test.ts.
    for (const item of itens) {
      const classes = item.className.split(/\s+/);
      for (const cls of MENU_FOCUS_RING.split(" ")) expect(classes, `${item.textContent}: ${cls}`).toContain(cls);
      expect(classes.some((c) => /^focus-visible:outline-(solid|2|focus-ring)$/.test(c))).toBe(false);
    }
  });
});
