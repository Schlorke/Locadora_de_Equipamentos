import { describe, expect, it, vi } from "vitest";
import { createAreaExits, HOME_HREF } from "./area-exits";

function setup(canGoBack: boolean, signOut: () => Promise<unknown> = vi.fn(async () => undefined)) {
  const router = { canGoBack: vi.fn(() => canGoBack), back: vi.fn(), replace: vi.fn() };
  return { router, signOut, exits: createAreaExits({ router, signOut }) };
}

describe("createAreaExits", () => {
  it("voltar usa a pilha quando existe", () => {
    const { router, exits } = setup(true);
    exits.back();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("voltar sem histórico leva ao início", () => {
    const { router, exits } = setup(false);
    exits.back();
    expect(router.replace).toHaveBeenCalledWith(HOME_HREF);
  });

  it("sair encerra a sessão antes de ir ao início", async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => { order.push("signOut"); });
    const { router, exits } = setup(true, signOut);
    router.replace.mockImplementation(() => { order.push("replace"); });
    await exits.signOut();
    expect(order).toEqual(["signOut", "replace"]);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("falha ao sair não navega e propaga o erro para a tela", async () => {
    const { router, exits } = setup(true, vi.fn(async () => { throw new Error("Não foi possível encerrar a sessão."); }));
    await expect(exits.signOut()).rejects.toThrow("Não foi possível encerrar a sessão.");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
