'use client'

import Decimal from 'decimal.js'
import { keyValueStorage } from '../../../shared/storage'
import { create } from 'zustand'
import {
  persist,
  createJSONStorage,
  type PersistStorage,
} from 'zustand/middleware'
import { sanitizeCartItemPricing } from '../../../entities/equipamento'
import { getAutoRentalDateRange } from '../../../entities/locacao'
import { buildQuotePricing } from '../../../entities/orcamento'

export interface CartItem {
  equipmentId: string
  equipmentName: string
  pricePerDay: number
  quantity: number
  days: number
  selectedPeriod?: {
    id: string
    label: string
    period: string
    multiplier: number
    discount: number
    popular?: boolean
  }
  finalPrice?: number
  maxStock?: number
  description?: string
  category?: { name: string }
  images?: string[]
  startDate?: Date
  endDate?: Date
  includeWeekends?: boolean
  includeWeekendsConfirmed?: boolean
  dailyDiscount?: number
  weeklyDiscount?: number
  biweeklyDiscount?: number
  monthlyDiscount?: number
  dailyDirectValue?: number
  weeklyDirectValue?: number
  biweeklyDirectValue?: number
  monthlyDirectValue?: number
  dailyUseDirectValue?: boolean
  weeklyUseDirectValue?: boolean
  biweeklyUseDirectValue?: boolean
  monthlyUseDirectValue?: boolean
}

interface CartState {
  items: CartItem[]
  remoteReady: boolean
  remotePending: boolean
  removedEquipmentIds: string[]
  remoteCleared: boolean
  addItem: (item: CartItem) => void
  removeItem: (equipmentId: string) => void
  updateItemQuantity: (equipmentId: string, quantity: number) => void
  updateItemDays: (equipmentId: string, days: number) => void
  updateItemIncludeWeekends: (
    equipmentId: string,
    includeWeekends: boolean
  ) => void
  hydrateItems: (items: CartItem[]) => void
  acceptServerItems: (items: CartItem[], pending: boolean) => void
  markServerSaved: (key: string) => void
  clearCart: () => void
  getItemCount: () => number
  getTotalPrice: () => number
}

/**
 * Total da linha pela regra única do orçamento (`buildQuotePricing`, a mesma do servidor): preço
 * exato da unidade × quantidade, arredondado uma vez em centavos (ROUND_HALF_UP), com os dias e a
 * quantidade atuais da linha, como a página mostra o subtotal do item. `finalPrice` (a unidade já
 * arredondada, guardada quando o item entrou) nunca entra na conta: multiplicá-la pela quantidade
 * diverge do servidor por centavos.
 */
function cartLineTotal(item: CartItem): Decimal {
  const days = Number(item.days) || 1
  const quantity = Number(item.quantity) || 1
  return new Decimal(buildQuotePricing(item, days, quantity).total)
}

const storage = createJSONStorage<CartState>(() => keyValueStorage)
export const cartInput = (items: CartItem[]) =>
  items.map(({ equipmentId, quantity, days }) => ({
    equipmentId,
    quantity,
    days,
  }))
export const cartKey = (items: CartItem[]) => JSON.stringify(cartInput(items))
const pendingFor = (state: CartState, items: CartItem[]) =>
  state.remotePending ||
  (state.remoteReady && cartKey(items) !== cartKey(state.items))
/** Armazenamento que não lê nem grava: o carrinho fica desligado do aparelho enquanto troca de escopo. */
const detachedStorage: PersistStorage<CartState> = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      remoteReady: false,
      remotePending: false,
      removedEquipmentIds: [],
      remoteCleared: false,

      addItem: (item) =>
        set((state) => {
          const safeItem = sanitizeCartItemPricing(item)
          const existingItemIndex = state.items.findIndex(
            (i) => i.equipmentId === safeItem.equipmentId
          )

          if (existingItemIndex >= 0) {
            const updatedItems = [...state.items]
            updatedItems[existingItemIndex] = {
              ...updatedItems[existingItemIndex],
              ...safeItem,
              quantity: safeItem.quantity,
            }
            return {
              items: updatedItems,
              remotePending: pendingFor(state, updatedItems),
              removedEquipmentIds: state.removedEquipmentIds.filter(
                (id) => id !== safeItem.equipmentId
              ),
            }
          }

          return {
            items: [...state.items, safeItem],
            remotePending: pendingFor(state, [...state.items, safeItem]),
            removedEquipmentIds: state.removedEquipmentIds.filter(
              (id) => id !== safeItem.equipmentId
            ),
          }
        }),

      removeItem: (equipmentId) =>
        set((state) => ({
          items: state.items.filter((i) => i.equipmentId !== equipmentId),
          remotePending: pendingFor(
            state,
            state.items.filter((i) => i.equipmentId !== equipmentId)
          ),
          removedEquipmentIds: state.remoteReady
            ? state.removedEquipmentIds
            : [...new Set([...state.removedEquipmentIds, equipmentId])],
        })),

      updateItemQuantity: (equipmentId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.equipmentId === equipmentId ? { ...i, quantity } : i
          ),
          remotePending: pendingFor(
            state,
            state.items.map((i) =>
              i.equipmentId === equipmentId ? { ...i, quantity } : i
            )
          ),
        })),

      updateItemDays: (equipmentId, days) =>
        set((state) => ({
          remotePending:
            state.remotePending ||
            (state.remoteReady &&
              state.items.some(
                (i) =>
                  i.equipmentId === equipmentId &&
                  i.days !== Math.max(1, Number(days) || 1)
              )),
          items: state.items.map((i) => {
            if (i.equipmentId !== equipmentId) {
              return i
            }

            const safeDays = Math.max(1, Number(days) || 1)
            if (!i.startDate) {
              return { ...i, days: safeDays }
            }

            const startDate =
              i.startDate instanceof Date ? i.startDate : new Date(i.startDate)
            if (Number.isNaN(startDate.getTime())) {
              return { ...i, days: safeDays }
            }

            const { startDate: normalizedStartDate, endDate } =
              getAutoRentalDateRange({
                requestDate: startDate,
                days: safeDays,
                includeWeekends: i.includeWeekends ?? false,
              })

            return {
              ...i,
              days: safeDays,
              startDate: normalizedStartDate,
              endDate,
            }
          }),
        })),

      updateItemIncludeWeekends: (equipmentId, includeWeekends) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.equipmentId === equipmentId
              ? { ...i, includeWeekends, includeWeekendsConfirmed: true }
              : i
          ),
        })),

      hydrateItems: (items) =>
        set((state) => ({
          items: items.map((item) => sanitizeCartItemPricing(item)),
          remotePending:
            state.remotePending ||
            (state.remoteReady && cartKey(items) !== cartKey(state.items)),
        })),

      acceptServerItems: (items, pending) =>
        set({
          items: items.map((item) => sanitizeCartItemPricing(item)),
          remoteReady: true,
          remotePending: pending,
          removedEquipmentIds: [],
          remoteCleared: false,
        }),
      markServerSaved: (key) =>
        set((state) => ({ remotePending: cartKey(state.items) !== key })),

      clearCart: () =>
        set((state) => ({
          items: [],
          remotePending: pendingFor(state, []),
          remoteCleared: !state.remoteReady,
          removedEquipmentIds: [],
        })),

      getItemCount: () => {
        const { items } = get()
        return items.reduce((total, item) => total + item.quantity, 0)
      },

      // Soma em Decimal do total de cada linha (centavos exatos): o "Total Estimado" é a soma dos subtotais.
      getTotalPrice: () =>
        get()
          .items.reduce(
            (total, item) => total.plus(cartLineTotal(item)),
            new Decimal(0)
          )
          .toNumber(),
    }),
    {
      name: 'cart-unselected',
      skipHydration: true,
      storage,
    }
  )
)

let cartScopeRevision = 0

/** Token interno da feature: invalida respostas HTTP inclusive numa ida e volta ao mesmo escopo. */
export const getCartScopeRevision = () => cartScopeRevision

/**
 * Troca o escopo do carrinho (locadora + usuário): esvazia a memória na hora e carrega o carrinho salvo do novo escopo.
 *
 * O `persist` grava todo `setState` no nome atual. Por isso o carrinho fica desligado do armazenamento durante a
 * troca: esvaziar a memória não apaga o carrinho salvo do escopo anterior, e o que mudar antes de o novo escopo
 * carregar (a carga substitui a memória) não chega a nenhum dos dois. Nome novo e armazenamento voltam juntos, só na
 * troca mais recente e depois da leitura. Se a leitura falhar, o carrinho continua desligado até uma troca dar certo:
 * gravar no nome anterior misturaria os escopos.
 *
 * @returns `false` quando uma troca mais nova substituiu esta.
 */
export async function switchCartScope(scope: string | null): Promise<boolean> {
  const revision = ++cartScopeRevision
  useCartStore.persist.setOptions({ storage: detachedStorage })
  useCartStore.setState({
    items: [],
    remoteReady: false,
    remotePending: false,
    removedEquipmentIds: [],
    remoteCleared: false,
  })
  const name = scope ? 'cart:' + encodeURIComponent(scope) : 'cart-unselected'
  const raw = scope ? await keyValueStorage.getItem(name) : null
  if (revision !== cartScopeRevision) return false
  let items: CartItem[] = []
  let remoteReady = false,
    remotePending = false
  let removedEquipmentIds: string[] = [],
    remoteCleared = false
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed?.state?.items)) items = parsed.state.items
      remoteReady = parsed?.state?.remoteReady === true
      remotePending = remoteReady && parsed?.state?.remotePending === true
      if (Array.isArray(parsed?.state?.removedEquipmentIds))
        removedEquipmentIds = parsed.state.removedEquipmentIds.filter(
          (id: unknown) => typeof id === 'string'
        )
      remoteCleared = parsed?.state?.remoteCleared === true
    } catch {
      await keyValueStorage.removeItem(name)
    }
  }
  if (revision !== cartScopeRevision) return false
  useCartStore.persist.setOptions({ name, storage })
  useCartStore.getState().hydrateItems(items)
  useCartStore.setState({
    remoteReady,
    remotePending,
    removedEquipmentIds,
    remoteCleared,
  })
  return true
}
