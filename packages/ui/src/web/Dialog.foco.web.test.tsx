// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog } from "./Dialog.web";
import { MENU_FOCUS_RING } from "./focus-ring";

/** Anel pela modalidade de entrada (só com a modalidade de teclado registrada no <html>) e nenhum contorno em repouso
 * nem no clique, também nas cores forçadas (forced-colors:outline-0). */
const MODALITY_RING = MENU_FOCUS_RING.split(" ");

describe("Dialog: foco inicial no X", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-input-modality");
  });

  it("o X recebe o foco ao abrir e o anel segue a modalidade de entrada (teclado sim, clique não)", async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>Orçamento</Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar" />
            </Dialog.Header>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const close = screen.getByRole("button", { name: "Fechar" });
    // O diálogo move o foco inicial por código para o X, que o Chromium trata como :focus-visible mesmo após clique.
    await waitFor(() => expect(document.activeElement).toBe(close));

    const classes = close.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(MODALITY_RING));
    // Nenhum anel em :focus-visible puro: ele apareceria no diálogo aberto por clique.
    expect(classes.some((c) => /^focus-visible:outline-/.test(c))).toBe(false);

    // O módulo do diálogo registra a modalidade no <html> (clique → ponteiro, tecla → teclado).
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.documentElement.getAttribute("data-input-modality")).toBe("pointer");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.documentElement.getAttribute("data-input-modality")).toBe("keyboard");
  });
});
