// @vitest-environment jsdom
// Foco do gatilho do intervalo de datas (barra de filtros do e-mail no painel): o anel da marca só pelo teclado
// (FOCUS_RING, contorno de 2px no token --focus-ring), como decidido pelo usuário. Um anel próprio no :focus
// (focus:ring-2 focus:ring-orange-500 e borda orange-500) aparecia também no clique do mouse e no laranja 500.
import { FOCUS_RING } from "@gb-locacoes/ui";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DateRangePicker } from "./DateRangePicker.web";

afterEach(cleanup);

describe("DateRangePicker (web): foco do gatilho", () => {
  it("fechado, o gatilho mostra só o anel de foco da marca no :focus-visible; nada muda no :focus do clique", () => {
    render(<DateRangePicker startDate={null} endDate={null} onDateChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Selecionar período/ });
    // Fechado, o Radix não grava aria-controls: a moldura de gatilho (variante controls:) não vale aqui.
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.hasAttribute("aria-controls")).toBe(false);
    const classes = trigger.className.split(/\s+/);
    for (const cls of FOCUS_RING.split(" ")) expect(classes, cls).toContain(cls);
    // :focus vale também no clique; a aparência do foco só pode mudar no :focus-visible (teclado).
    expect(classes.filter((cls) => cls.startsWith("focus:"))).toEqual([]);
    expect(classes.filter((cls) => /focus/.test(cls) && /orange/.test(cls))).toEqual([]);
  });
});
