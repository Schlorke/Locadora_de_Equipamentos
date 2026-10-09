// @vitest-environment jsdom
// WhatsApp flutuante da vitrine (achado 143): o número e o nome são os da própria locadora. O teste anterior conferia o
// código-fonte e afirmava o defeito (`const whatsappNumber = '5551998205163'`, o WhatsApp da GB para qualquer locadora).
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  whatsappNumber: "",
  identidade: null as null | { nome: string; cidade: null; uf: null; logoUrl: null },
}));
vi.mock("../../../entities/configuracao", () => ({
  usePublicSettings: () => ({ settings: { whatsappNumber: estado.whatsappNumber } }),
}));
vi.mock("../../../entities/organizacao", async (original) => ({
  ...(await original<typeof import("../../../entities/organizacao")>()),
  useIdentidadePublica: () => estado.identidade,
}));

import WhatsAppFAB, { numeroDoWhatsApp } from "./WhatsAppFab.web";

beforeEach(() => {
  estado.whatsappNumber = "";
  estado.identidade = null;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("WhatsApp flutuante", () => {
  it.each([
    ["(41) 99999-0000", "5541999990000"],
    ["+55 (41) 99999-0000", "5541999990000"],
    ["41 3000-0000", "554130000000"],
    ["", null],
    ["123", null],
  ])("número %s → %s", (valor, esperado) => {
    expect(numeroDoWhatsApp(valor)).toBe(esperado);
  });

  it("locadora sem WhatsApp: nenhum botão (nunca o número de outra locadora)", () => {
    estado.identidade = { nome: "Locadora Nova", cidade: null, uf: null, logoUrl: null };
    const { container } = render(<WhatsAppFAB />);
    expect(container.innerHTML).toBe("");
  });

  it("abre o wa.me da própria locadora com o nome dela na mensagem e no topo do chat", () => {
    vi.useFakeTimers();
    estado.whatsappNumber = "(41) 99999-0000";
    estado.identidade = { nome: "Locadora Alfa", cidade: null, uf: null, logoUrl: null };
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<WhatsAppFAB />);
    fireEvent.click(screen.getByLabelText("Abrir chat do WhatsApp"));
    expect(screen.getByRole("heading", { name: "Locadora Alfa" })).toBeTruthy();
    expect(screen.getByText("LA")).toBeTruthy();
    fireEvent.click(screen.getByText(/solicitar um orçamento de equipamentos/));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(String(open.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe("https://wa.me/5541999990000");
    expect(url.searchParams.get("text")).toBe(
      "Olá! Vim do site da Locadora Alfa e gostaria de solicitar um orçamento de equipamentos",
    );
    expect(document.body.textContent).not.toMatch(/GB Loca|\bGB\b/);
  });

  it("mantém as frases do bot, os rótulos e as classes do botão", () => {
    // Caminho do disco (o `URL` do jsdom não serve ao `fs`).
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "WhatsAppFab.web.tsx"), "utf8");
    expect(source).toContain("https://wa.me/${whatsappNumber}?text=");
    expect(source).toContain("window.location.href = whatsappURL");
    expect(source).toContain("window.open(whatsappURL, '_blank')");
    expect(source).toContain("Olá! Precisa de equipamentos para sua obra?");
    expect(source).toContain("Obrigado pela mensagem!");
    expect(source).toContain('placeholder="Digite sua mensagem..."');
    expect(source).toContain('aria-label="Abrir chat do WhatsApp"');
    expect(source).toContain('aria-label="Fechar chat do WhatsApp"');
    expect(source).toContain('className="w-14 h-14 rounded-full text-white hover:text-white');
    expect(source).not.toContain("!important");
    expect(source).not.toMatch(/["'`\s]!(w|h)-14/);
    expect(source).toContain("useState(1)");
  });
});
