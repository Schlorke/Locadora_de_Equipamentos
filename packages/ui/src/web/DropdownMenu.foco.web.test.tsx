// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./DropdownMenu.web";
import { MENU_FOCUS_RING } from "./focus-ring";

/** Anel dos menus: só com a modalidade de teclado registrada no <html> (o foco dos menus é movido por código) e
 * nenhum contorno em repouso nem no clique, também nas cores forçadas (forced-colors:outline-0). */
const MENU_RING = MENU_FOCUS_RING.split(" ");

beforeAll(() => {
  // O posicionamento do Radix observa o tamanho do conteúdo; o jsdom não tem ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("DropdownMenu: foco", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-input-modality");
  });

  it("itens levam o anel de teclado, não removem o contorno e a seta move o foco em modalidade de teclado", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Ações</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Editar</DropdownMenuItem>
          <DropdownMenuItem>Excluir</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mais</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Duplicar</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const itens = screen.getAllByRole("menuitem");
    expect(itens.map((item) => item.textContent)).toEqual(["Editar", "Excluir", "Mais"]);
    for (const item of itens) {
      const classes = item.className.split(/\s+/);
      expect(classes).toEqual(expect.arrayContaining(MENU_RING));
      // Sem anel em :focus-visible puro (o hover do mouse também foca o item) e sem remoção de contorno.
      expect(classes.some((c) => /^focus-visible:outline-(solid|2|ring)$/.test(c))).toBe(false);
      expect(classes.some((c) => /^focus(-visible)?:(outline-none|outline-hidden|ring-0)$/.test(c))).toBe(false);
    }

    itens[0].focus();
    fireEvent.keyDown(itens[0], { key: "ArrowDown" });
    expect(document.documentElement.getAttribute("data-input-modality")).toBe("keyboard");
    await waitFor(() => expect(document.activeElement).toBe(itens[1]));

    fireEvent.pointerDown(itens[1]);
    expect(document.documentElement.getAttribute("data-input-modality")).toBe("pointer");
  });
});
