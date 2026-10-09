import { describe, expect, it } from "vitest";
import { cartNotificationHelpers } from "./notificacoes";

describe("aviso de carrinho abandonado", () => {
  it("mantém o texto, o destino e o plural", () => {
    expect(cartNotificationHelpers.cartAbandoned(1)).toEqual({
      type: "equipment",
      title: "Carrinho Abandonado",
      message: "Você tem 1 item aguardando no seu carrinho. Finalize sua compra!",
      priority: "medium",
      actionUrl: "/orcamento",
    });
    expect(cartNotificationHelpers.cartAbandoned(2).message).toBe(
      "Você tem 2 items aguardando no seu carrinho. Finalize sua compra!",
    );
  });
});
