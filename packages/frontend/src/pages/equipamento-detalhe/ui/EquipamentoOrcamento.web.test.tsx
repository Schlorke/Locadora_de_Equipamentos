// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationSessionProvider, type SessionState } from "../../../entities/sessao";
import { useCartStore } from "../../../features/carrinho";
import { InternalRoutePrefixProvider } from "../../../shared/lib/navigation";
import { SmartQuoteButton } from "./EquipamentoOrcamento.web";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }));
const location = vi.hoisted(() => ({ pathname: "/equipamentos/eq-1" }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => location.pathname }));
const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));

const ana = { user: { id: "user-1", name: "Ana" }, expires: "2099-01-01T00:00:00.000Z" };
const period = { id: "daily", label: "Diário", period: "dia", multiplier: 1, discount: 0 };

function sessionValue(status: SessionState["status"]): SessionState {
  return { data: status === "authenticated" ? ana : null, status, update: async () => null, signOut: async () => undefined };
}

function renderButton(status: SessionState["status"], prefix: string | null = null) {
  const view = (next: SessionState["status"]) => (
    <InternalRoutePrefixProvider prefix={prefix}>
      <ApplicationSessionProvider value={sessionValue(next)}>
        <SmartQuoteButton
          equipmentId="eq-1"
          equipmentName="Betoneira 400L"
          pricePerDay={100}
          isAvailable
          selectedPeriod={period}
          finalPrice={100}
          startDate={new Date("2026-10-01T12:00:00.000Z")}
          endDate={new Date("2026-10-02T12:00:00.000Z")}
          selectedDays={2}
        >
          Solicitar Orçamento
        </SmartQuoteButton>
      </ApplicationSessionProvider>
    </InternalRoutePrefixProvider>
  );
  const result = render(view(status));
  return { ...result, setStatus: (next: SessionState["status"]) => result.rerender(view(next)) };
}

beforeEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ items: [] });
  router.push.mockClear();
  toastInfo.mockClear();
  location.pathname = "/equipamentos/eq-1";
  window.history.replaceState(null, "", "/");
});
afterEach(() => cleanup());

describe("SmartQuoteButton ('Solicitar Orçamento') e a sessão", () => {
  it("clique durante 'loading' espera a sessão: usuário logado segue para o orçamento, sem passar pelo login", async () => {
    const view = renderButton("loading");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));

    expect(router.push).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Solicitar Orçamento" }).getAttribute("aria-busy")).toBe("true");

    await act(async () => { view.setStatus("authenticated"); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/orcamento");
    expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining("/login"));
    expect(toastInfo).not.toHaveBeenCalled();
    expect(useCartStore.getState().items.map((item) => item.equipmentId)).toEqual(["eq-1"]);
    expect(screen.getByRole("button", { name: "Solicitar Orçamento" }).getAttribute("aria-busy")).toBeNull();
  });

  it("clique durante 'loading' de visitante vai ao login só depois que a sessão resolve", async () => {
    const view = renderButton("loading");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => { view.setStatus("unauthenticated"); });
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/login?callbackUrl=%2Fequipamentos%2Feq-1");
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("com a sessão já resolvida decide na hora", () => {
    renderButton("authenticated");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));
    expect(router.push).toHaveBeenCalledWith("/orcamento");

    cleanup();
    router.push.mockClear();
    renderButton("unauthenticated");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));
    expect(router.push).toHaveBeenCalledWith("/login?callbackUrl=%2Fequipamentos%2Feq-1");
  });

  it("no modo host o callbackUrl usa o caminho visível, nunca o segmento interno /{slug}", () => {
    location.pathname = "/locadora-a/equipamentos/eq-1";
    renderButton("unauthenticated", "/locadora-a");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));
    expect(router.push).toHaveBeenCalledWith("/login?callbackUrl=%2Fequipamentos%2Feq-1");
  });

  it("volta à página com a query da URL, pela mesma regra do 'Entrar' da área privada", () => {
    window.history.replaceState(null, "", "/equipamentos/eq-1?periodo=semanal");
    renderButton("unauthenticated");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));
    expect(router.push).toHaveBeenCalledWith("/login?callbackUrl=%2Fequipamentos%2Feq-1%3Fperiodo%3Dsemanal");
  });

  it("retorno que o login recusaria: vai ao login sem callbackUrl", () => {
    location.pathname = "/equipamentos/%2e%2e//evil.test";
    renderButton("unauthenticated");
    fireEvent.click(screen.getByRole("button", { name: "Solicitar Orçamento" }));
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});
