// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MENU_FOCUS_RING } from "./focus-ring";
import { Sheet, SheetContent, SheetTitle } from "./Sheet.web";

/** Anel pela modalidade de entrada (só com a modalidade de teclado registrada no <html>) e nenhum contorno em repouso
 * nem no clique, também nas cores forçadas (forced-colors:outline-0). */
const MODALITY_RING = MENU_FOCUS_RING.split(" ");

describe("Sheet: foco inicial no X", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-input-modality");
  });

  it("o X leva o anel pela modalidade de entrada (teclado sim, clique não), não o de :focus-visible puro", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Filtros</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    const classes = close.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(MODALITY_RING));
    expect(classes.some((c) => /^focus-visible:outline-/.test(c))).toBe(false);

    // O módulo da gaveta lateral registra a modalidade no <html>.
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.documentElement.getAttribute("data-input-modality")).toBe("pointer");
  });
});
