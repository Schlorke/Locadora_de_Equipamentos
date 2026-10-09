"use client";

import { useCartStore } from "./carrinho";

export function useCartNotifications() {
  const { items, getItemCount, getTotalPrice } = useCartStore();

  const itemCount = getItemCount();
  const totalPrice = getTotalPrice();

  return {
    itemCount,
    totalPrice,
    hasItems: items.length > 0,
    items,
  };
}

export const cartNotificationHelpers = {
  cartAbandoned: (itemsCount: number) => ({
    type: "equipment" as const,
    title: "Carrinho Abandonado",
    message: `Você tem ${itemsCount} item${itemsCount > 1 ? "s" : ""} aguardando no seu carrinho. Finalize sua compra!`,
    priority: "medium" as const,
    actionUrl: "/orcamento",
  }),
};
