// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CloseButton } from "./CloseButton.web";

/** Anel de foco por teclado com o token --focus-ring (a mesma receita em todos os botões de fechar e itens de menu). */
const RING = [
  "focus-visible:outline-solid",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
  "focus-visible:outline-focus-ring",
];

describe("CloseButton: foco", () => {
  afterEach(cleanup);

  it("recebe foco pelo teclado e mostra o anel só em :focus-visible, sem remover o contorno", () => {
    render(
      <>
        <button type="button">antes</button>
        <CloseButton aria-label="Fechar dialog" />
      </>,
    );
    const botao = screen.getByRole("button", { name: "Fechar dialog" });
    expect(botao.tabIndex).toBe(0);
    botao.focus();
    expect(document.activeElement).toBe(botao);

    const classes = botao.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(RING));
    expect(classes.some((c) => /^focus(-visible)?:(outline-none|outline-hidden|ring-0)$/.test(c))).toBe(false);
  });

  it("mantém a sombra do botão fora do foco e a tira no foco, como a regra global fazia", () => {
    render(<CloseButton />);
    const botao = screen.getByRole("button", { name: "Close" });
    const classes = botao.className.split(/\s+/);
    expect(classes).toContain("shadow-lg");
    expect(classes).toContain("focus:shadow-none");
  });
});
