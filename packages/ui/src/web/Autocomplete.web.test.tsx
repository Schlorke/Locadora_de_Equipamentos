// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutocompleteOption } from "../contract/autocomplete";
import { Autocomplete } from "./Autocomplete.web";

// A busca chega por adapter (`loadOptions`): o design system não conhece rotas de API do produto.
const betoneira: AutocompleteOption = {
  id: "eq-1",
  label: "Betoneira 400L",
  description: "Motor elétrico monofásico",
  group: "Concretagem",
  detail: "R$ 80,00/dia",
};

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function type(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Campo de busca de equipamentos" }), { target: { value } });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Autocomplete", () => {
  it("busca depois de 300ms a partir de 2 letras", async () => {
    const loadOptions = vi.fn().mockResolvedValue([betoneira]);
    render(<Autocomplete loadOptions={loadOptions} />);

    type("b");
    await advance(300);
    expect(loadOptions).not.toHaveBeenCalled();

    type("be");
    await advance(299);
    expect(loadOptions).not.toHaveBeenCalled();

    type("bet");
    await advance(299);
    expect(loadOptions).not.toHaveBeenCalled();
    await advance(1);
    expect(loadOptions).toHaveBeenCalledExactlyOnceWith("bet");

    await advance(0);
    expect(screen.getByRole("listbox", { name: "Sugestões" })).toBeTruthy();
    expect(screen.getByRole("option").textContent).toContain("Betoneira 400L");
  });

  it("não consulta o adapter quando desabilitado", async () => {
    const loadOptions = vi.fn().mockResolvedValue([betoneira]);
    render(<Autocomplete loadOptions={loadOptions} disabled />);

    type("betoneira");
    await advance(300);

    expect(loadOptions).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("mostra a lista acima da página e seleciona com onMouseDown sem tirar o foco do campo", async () => {
    const loadOptions = vi.fn().mockResolvedValue([betoneira]);
    const onSelect = vi.fn();
    render(<Autocomplete loadOptions={loadOptions} onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: "Campo de busca de equipamentos" }) as HTMLInputElement;
    expect(input.placeholder).toBe("Buscar...");

    type("be");
    await advance(300);
    await advance(0);

    const listbox = screen.getByRole("listbox", { name: "Sugestões" });
    expect(listbox.closest(".z-\\[99999\\]")).not.toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Limpar busca" })).toBeTruthy();

    const option = screen.getByRole("option");
    expect(fireEvent.mouseDown(option)).toBe(false);
    expect(screen.queryByRole("listbox")).toBeNull();
    await advance(0);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(betoneira);
    expect(input.value).toBe("Betoneira 400L");
    expect(screen.getByRole("button", { name: "Limpar seleção" })).toBeTruthy();
  });

  it("envia o texto livre com Enter e limpa a busca", async () => {
    const loadOptions = vi.fn().mockResolvedValue([]);
    const onSearch = vi.fn();
    render(<Autocomplete loadOptions={loadOptions} onSearch={onSearch} placeholder="Buscar equipamentos (ex: andaime, betoneira)" />);
    const input = screen.getByRole("combobox", { name: "Campo de busca de equipamentos" }) as HTMLInputElement;
    expect(input.placeholder).toBe("Buscar equipamentos (ex: andaime, betoneira)");

    type("  andaime  ");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("andaime");

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(input.value).toBe("");
    expect(screen.queryByRole("button", { name: "Limpar busca" })).toBeNull();
  });
});
