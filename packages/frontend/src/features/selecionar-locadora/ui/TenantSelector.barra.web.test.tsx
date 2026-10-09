// @vitest-environment jsdom
// Seletor de locadora do painel no web: barra compacta no topo da área privada. Antes era um bloco de ~460 px de
// altura quase vazio (título "Locadora" no meio, seletor no pé), porque o Text do design system grava o line-height
// sem unidade no estilo inline. A barra usa só componentes do design system e mantém o comportamento.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "../../../entities/organizacao";
import { TenantSelector } from "../index";

const membership = (slug: string, name: string): TenantContext => ({ tenant: { id: "t-" + slug, slug, name, status: "ACTIVE" }, membershipId: "m-" + slug, role: "ADMIN" });
const locadoraA = membership("locadora-a", "Locadora A");
const locadoraB = membership("locadora-b", "Locadora B");

type Props = Parameters<typeof TenantSelector>[0];
function renderBar(overrides: Partial<Props> = {}) {
  const props: Props = { memberships: [locadoraA, locadoraB], selection: locadoraA, loading: false, error: null, onSelect: vi.fn(), onRetry: vi.fn(), ...overrides };
  render(<TenantSelector {...props} />);
  return { props, bar: screen.getByRole("region", { name: "Locadora do painel" }) };
}

beforeAll(() => {
  // O seletor é o Select do Radix: no jsdom faltam estas APIs de ponteiro e rolagem.
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
});
afterEach(cleanup);

describe("seletor de locadora do painel (web)", () => {
  it("é uma barra: o rótulo 'Locadora' nomeia o seletor, sem título nem altura de linha no estilo inline", () => {
    const { bar } = renderBar();
    const selector = within(bar).getByRole("combobox", { name: "Locadora" });
    expect(selector.textContent).toContain("Locadora A");
    expect(within(bar).queryByRole("heading")).toBeNull();
    // O Text do design system grava `line-height: 24` (sem unidade: 24 vezes a fonte) e fazia a caixa enorme.
    expect(Array.from(bar.querySelectorAll<HTMLElement>("[style]")).filter((element) => element.style.lineHeight !== "")).toEqual([]);
  });

  it("trocar pelo teclado escolhe a locadora pelo id", async () => {
    const { bar, props } = renderBar();
    await act(async () => { fireEvent.keyDown(within(bar).getByRole("combobox", { name: "Locadora" }), { key: "Enter" }); });
    await act(async () => { fireEvent.keyDown(await screen.findByRole("option", { name: "Locadora B" }), { key: "Enter" }); });
    expect(props.onSelect).toHaveBeenCalledWith("t-locadora-b");
  });

  it("a pergunta do ?locadora= e as duas respostas ficam na própria barra", () => {
    const onConfirmSuggestion = vi.fn();
    const onDismissSuggestion = vi.fn();
    const { bar } = renderBar({ suggestion: locadoraB, onConfirmSuggestion, onDismissSuggestion });
    expect(within(bar).getByText("Você veio do endereço de Locadora B. Trocar a locadora do painel de Locadora A para Locadora B?")).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: "Trocar para Locadora B" }));
    fireEvent.click(within(bar).getByRole("button", { name: "Agora não" }));
    expect(onConfirmSuggestion).toHaveBeenCalledTimes(1);
    expect(onDismissSuggestion).toHaveBeenCalledTimes(1);
  });

  it("sem seleção, a pergunta oferece abrir o painel da locadora sugerida", () => {
    const { bar } = renderBar({ selection: null, suggestion: locadoraB, onConfirmSuggestion: vi.fn(), onDismissSuggestion: vi.fn() });
    expect(within(bar).getByText("Você veio do endereço de Locadora B. Abrir o painel de Locadora B?")).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Abrir Locadora B" })).toBeTruthy();
    expect(within(bar).getByRole("combobox", { name: "Locadora" }).textContent).toContain("Selecione uma locadora");
  });

  it("erro: a mensagem é anunciada e 'Tentar novamente' refaz a consulta", () => {
    const { bar, props } = renderBar({ memberships: [], selection: null, error: "Não foi possível carregar as locadoras." });
    expect(within(bar).getByRole("alert").textContent).toBe("Não foi possível carregar as locadoras.");
    fireEvent.click(within(bar).getByRole("button", { name: "Tentar novamente" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("carregando: seletor desabilitado com a espera; sem vínculo: o aviso na barra", () => {
    renderBar({ memberships: [], selection: null, loading: true });
    const loading = screen.getByRole("combobox", { name: "Locadora" });
    expect(loading.hasAttribute("disabled")).toBe(true);
    expect(loading.textContent).toContain("Carregando locadoras...");
    cleanup();
    const { bar } = renderBar({ memberships: [], selection: null });
    expect(within(bar).getByText("Nenhuma locadora está vinculada à sua conta.")).toBeTruthy();
  });
});
