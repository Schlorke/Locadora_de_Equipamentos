// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateIntelligentPrice } from "../../../entities/equipamento";
import { buildQuotePricing } from "../../../entities/orcamento";
import { keyValueStorage } from "../../../shared/storage";
import { switchCartScope, useCartStore, type CartItem } from "./carrinho";

const item = (quantity: number): CartItem => ({
  equipmentId: "abc",
  equipmentName: "Betoneira",
  pricePerDay: 100,
  quantity,
  days: 1,
  finalPrice: 100,
});

describe("carrinho", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("substitui a quantidade quando o equipamento já está no carrinho", () => {
    useCartStore.getState().addItem(item(1));
    useCartStore.getState().addItem(item(3));
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);
  });

  it("soma a quantidade de itens diferentes no contador", () => {
    useCartStore.getState().addItem(item(2));
    useCartStore.getState().addItem({ ...item(1), equipmentId: "xyz", equipmentName: "Andaime" });
    expect(useCartStore.getState().getItemCount()).toBe(3);
  });
});

describe("carrinho: total estimado pela regra única da linha", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  // Preço exato da unidade × quantidade, arredondado UMA vez (ROUND_HALF_UP): o que o servidor grava.
  it.each<[string, Partial<CartItem>, number, number, number]>([
    ["diária 50,05 com 10% de desconto, 1 dia", { pricePerDay: 50.05, dailyDiscount: 10 }, 1, 3, 135.14],
    ["semanal direto 900, 9 dias", { pricePerDay: 150, weeklyUseDirectValue: true, weeklyDirectValue: 900 }, 9, 3, 3471.43],
    ["quinzenal direto 1000, 20 dias", { pricePerDay: 80, biweeklyUseDirectValue: true, biweeklyDirectValue: 1000 }, 20, 2, 2666.67],
  ])("%s: o total é o do servidor, nunca a unidade arredondada × quantidade", (_caso, pricing, days, quantity, expected) => {
    // Como a página do equipamento põe no carrinho: preço da unidade para os dias e quantidade 1.
    const finalPrice = calculateIntelligentPrice({ pricePerDay: 0, ...pricing }, days);
    useCartStore.getState().addItem({ ...item(1), ...pricing, days, finalPrice } as CartItem);
    // Botão "+" da página de orçamento.
    useCartStore.getState().updateItemQuantity("abc", quantity);
    const stored = useCartStore.getState().items[0]!;

    expect(useCartStore.getState().getTotalPrice()).toBe(expected);
    expect(buildQuotePricing(stored, days, quantity).total).toBe(expected);
  });

  it("soma as linhas em Decimal: dois itens de 10,10 e 20,20 dão 30,30 exatos", () => {
    useCartStore.getState().addItem({ ...item(1), pricePerDay: 10.1, finalPrice: 10.1 });
    useCartStore.getState().addItem({ ...item(1), equipmentId: "xyz", pricePerDay: 20.2, finalPrice: 20.2 });
    expect(useCartStore.getState().getTotalPrice()).toBe(30.3);
  });

  it("o total segue os dias e a quantidade atuais da linha, não o preço guardado quando o item entrou", () => {
    useCartStore.getState().addItem({ ...item(1), pricePerDay: 100, days: 1, finalPrice: 100 });
    useCartStore.getState().updateItemDays("abc", 3);
    useCartStore.getState().updateItemQuantity("abc", 2);
    expect(useCartStore.getState().getTotalPrice()).toBe(600);
  });
});

describe("switchCartScope", () => {
  // Escopos como o RuntimeBootstrap monta: [locadora, usuário].
  const visitanteA = JSON.stringify(["locadora-a", "anonymous"]);
  const anaA = JSON.stringify(["locadora-a", "user-1"]);
  const anaB = JSON.stringify(["locadora-b", "user-1"]);
  const equipamento = (equipmentId: string): CartItem => ({ ...item(1), equipmentId, equipmentName: equipmentId });
  /** Itens do carrinho salvo no aparelho para o escopo (`null` quando nada foi salvo). */
  const saved = (scope: string) => {
    const raw = window.localStorage.getItem("cart:" + encodeURIComponent(scope));
    return raw === null ? null : (JSON.parse(raw) as { state: { items: CartItem[] } }).state.items.map((entry) => entry.equipmentId);
  };
  const inMemory = () => useCartStore.getState().items.map((entry) => entry.equipmentId);

  beforeEach(async () => {
    // O store é do módulo: cada caso começa fora de qualquer escopo e sem nada salvo.
    await switchCartScope(null);
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["visitante → login", visitanteA, anaA],
    ["vitrine da locadora A → área da locadora B", anaA, anaB],
  ])("%s: o carrinho salvo do escopo anterior continua salvo e volta com ele", async (_caso, anterior, novo) => {
    expect(await switchCartScope(anterior)).toBe(true);
    useCartStore.getState().addItem(equipamento("eq-A"));
    expect(saved(anterior)).toEqual(["eq-A"]);

    expect(await switchCartScope(novo)).toBe(true);
    expect(saved(anterior)).toEqual(["eq-A"]);
    expect(inMemory()).toEqual([]);
    expect(saved(novo)).toEqual([]);

    expect(await switchCartScope(anterior)).toBe(true);
    expect(inMemory()).toEqual(["eq-A"]);
    expect(saved(anterior)).toEqual(["eq-A"]);
  });

  it("o que muda no carrinho enquanto o novo escopo carrega não é gravado no escopo anterior", async () => {
    await switchCartScope(anaA);
    useCartStore.getState().addItem(equipamento("eq-A"));

    const troca = switchCartScope(anaB);
    useCartStore.getState().addItem(equipamento("eq-durante-a-troca"));
    expect(saved(anaA)).toEqual(["eq-A"]);

    expect(await troca).toBe(true);
    expect(saved(anaA)).toEqual(["eq-A"]);
    // A carga do novo escopo substitui a memória e passa a gravar só no nome dele.
    expect(inMemory()).toEqual([]);
    useCartStore.getState().addItem(equipamento("eq-B"));
    expect(saved(anaB)).toEqual(["eq-B"]);
    expect(saved(anaA)).toEqual(["eq-A"]);
  });

  it("se a leitura do novo escopo falha, nada mais é gravado no escopo anterior", async () => {
    await switchCartScope(anaA);
    useCartStore.getState().addItem(equipamento("eq-A"));
    const read = keyValueStorage.getItem.bind(keyValueStorage);
    vi.spyOn(keyValueStorage, "getItem").mockImplementation((key: string) => {
      if (key === "cart:" + encodeURIComponent(anaB)) throw new Error("armazenamento indisponível");
      return read(key);
    });

    await expect(switchCartScope(anaB)).rejects.toThrow("armazenamento indisponível");
    useCartStore.getState().addItem(equipamento("eq-sem-escopo"));
    expect(saved(anaA)).toEqual(["eq-A"]);
    expect(saved(anaB)).toBeNull();

    // Uma troca seguinte que dá certo religa o carrinho ao armazenamento, no escopo dela.
    vi.restoreAllMocks();
    expect(await switchCartScope(anaA)).toBe(true);
    expect(inMemory()).toEqual(["eq-A"]);
    useCartStore.getState().addItem(equipamento("eq-A2"));
    expect(saved(anaA)).toEqual(["eq-A", "eq-A2"]);
  });
});
