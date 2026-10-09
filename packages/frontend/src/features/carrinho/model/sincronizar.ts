'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type HttpClient } from '../../../shared/api'
import {
  cartInput,
  cartKey,
  getCartScopeRevision,
  useCartStore,
  type CartItem,
} from './carrinho'

type PriceKey =
  | 'dailyDiscount'
  | 'weeklyDiscount'
  | 'biweeklyDiscount'
  | 'monthlyDiscount'
  | 'dailyDirectValue'
  | 'weeklyDirectValue'
  | 'biweeklyDirectValue'
  | 'monthlyDirectValue'
type ModeKey =
  | 'dailyUseDirectValue'
  | 'weeklyUseDirectValue'
  | 'biweeklyUseDirectValue'
  | 'monthlyUseDirectValue'
interface ServerCartItem {
  equipmentId: string
  equipment: {
    name: string
    maxStock?: number
    description?: string
    category?: { name: string }
    images?: string[]
    pricePerDay?: number | string
  } & Partial<
    Record<PriceKey, number | string | null> & Record<ModeKey, boolean | null>
  >
  pricePerDay: number | string
  quantity: number
  days: number
  finalPrice?: number | string | null
}

export function mapServerCartItem(
  item: ServerCartItem,
  local?: CartItem
): CartItem {
  return {
    ...local,
    equipmentId: item.equipmentId,
    equipmentName: item.equipment.name,
    // A taxa da linha já tem desconto. O motor local recebe a base do catálogo.
    pricePerDay: Number(item.equipment.pricePerDay ?? item.pricePerDay),
    quantity: item.quantity,
    days: item.days,
    finalPrice: item.finalPrice == null ? undefined : Number(item.finalPrice),
    maxStock: item.equipment.maxStock,
    description: item.equipment.description,
    category: item.equipment.category,
    images: item.equipment.images,
    dailyDiscount: Number(item.equipment.dailyDiscount ?? 0),
    weeklyDiscount: Number(item.equipment.weeklyDiscount ?? 0),
    biweeklyDiscount: Number(item.equipment.biweeklyDiscount ?? 0),
    monthlyDiscount: Number(item.equipment.monthlyDiscount ?? 0),
    dailyDirectValue: Number(item.equipment.dailyDirectValue ?? 0),
    weeklyDirectValue: Number(item.equipment.weeklyDirectValue ?? 0),
    biweeklyDirectValue: Number(item.equipment.biweeklyDirectValue ?? 0),
    monthlyDirectValue: Number(item.equipment.monthlyDirectValue ?? 0),
    dailyUseDirectValue: item.equipment.dailyUseDirectValue ?? false,
    weeklyUseDirectValue: item.equipment.weeklyUseDirectValue ?? false,
    biweeklyUseDirectValue: item.equipment.biweeklyUseDirectValue ?? false,
    monthlyUseDirectValue: item.equipment.monthlyUseDirectValue ?? false,
  }
}

type SyncState = {
  scope: string | null
  ready: boolean
  isSyncing: boolean
  error: string | null
}

/**
 * O app fornece somente um escopo CLIENT confirmado e um cliente com a locadora fixada.
 * Primeiro mescla/restaura; depois substitui nas edições, inclusive remoções. O carrinho
 * anônimo continua separado. Nenhum efeito depende do array que ele próprio hidrata.
 */
export function useCartSync({
  scope,
  client,
}: {
  scope: string | null
  client: HttpClient
}) {
  const latestScope = useRef(scope)
  latestScope.current = scope
  const [retryRevision, setRetryRevision] = useState(0)
  const [state, setState] = useState<SyncState>({
    scope: null,
    ready: true,
    isSyncing: false,
    error: null,
  })
  const retry = useCallback(() => setRetryRevision((value) => value + 1), [])

  useEffect(() => {
    if (!scope) return
    const revision = getCartScopeRevision(),
      name = 'cart:' + encodeURIComponent(scope)
    const abort = new AbortController()
    let active = true,
      writing = false,
      initialized = false,
      lastSaved = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    const current = () =>
      active &&
      latestScope.current === scope &&
      getCartScopeRevision() === revision &&
      useCartStore.persist.getOptions().name === name
    const update = (next: Partial<SyncState>) => {
      if (current()) setState((previous) => ({ ...previous, scope, ...next }))
    }
    const failure = () =>
      update({
        ready: true,
        isSyncing: false,
        error:
          'Não foi possível sincronizar o carrinho. Os itens continuam salvos neste aparelho.',
      })
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        void save()
      }, 300)
    }

    const save = async () => {
      if (!current() || !initialized || writing) return
      const body = cartKey(useCartStore.getState().items)
      if (body === lastSaved) return
      writing = true
      update({ isSyncing: true })
      try {
        await client.request('/api/cart/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"items":' + body + '}',
          signal: abort.signal,
        })
        if (current()) {
          lastSaved = body
          useCartStore.getState().markServerSaved(body)
          update({ error: null })
        }
      } catch {
        failure()
      } finally {
        writing = false
        update({ isSyncing: false })
        // Uma edição durante a escrita segue depois dela; falha sozinha não cria loop de retry.
        if (current() && cartKey(useCartStore.getState().items) !== body)
          schedule()
      }
    }

    const unsubscribe = useCartStore.subscribe((next, previous) => {
      if (
        initialized &&
        current() &&
        next.items !== previous.items &&
        cartKey(next.items) !== lastSaved
      )
        schedule()
    })
    update({ ready: false, isSyncing: true, error: null })
    void (async () => {
      const snapshot = useCartStore.getState(),
        before = snapshot.items
      try {
        // A marca persiste com o escopo. Retry/reload de uma remoção que falhou usa
        // replace, nunca merge (que ressuscitaria o item removido).
        if (snapshot.remoteReady && snapshot.remotePending) {
          await client.request('/api/cart/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cartInput(before) }),
            signal: abort.signal,
          })
          if (!current()) return
        }
        const result =
          !snapshot.remoteReady && before.length
            ? await client.request<{ items: ServerCartItem[] }>(
                '/api/cart/merge',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ localCartItems: cartInput(before) }),
                  signal: abort.signal,
                }
              )
            : await client.request<{ items: ServerCartItem[] }>(
                '/api/cart/sync',
                { signal: abort.signal }
              )
        if (!current()) return
        if (!Array.isArray(result?.items))
          throw new Error('Resposta inválida do carrinho.')
        const after = useCartStore.getState(),
          latest = after.items
        const server = result.items.map((item) =>
          mapServerCartItem(
            item,
            before.find((local) => local.equipmentId === item.equipmentId)
          )
        )
        lastSaved = cartKey(server)
        // Rotas públicas podem editar enquanto a leitura está pendente. Conserva adições,
        // alterações e remoções locais, sem perder itens que existiam apenas no servidor.
        const visibleServer = server.filter(
          (item) =>
            !after.remoteCleared &&
            !after.removedEquipmentIds.includes(item.equipmentId)
        )
        const items =
          latest === before &&
          !after.remoteCleared &&
          after.removedEquipmentIds.length === 0
            ? visibleServer
            : visibleServer
                .flatMap((item) => {
                  const original = before.find(
                    (row) => row.equipmentId === item.equipmentId
                  )
                  const edited = latest.find(
                    (row) => row.equipmentId === item.equipmentId
                  )
                  if (original && !edited) return []
                  return [
                    edited && edited !== original
                      ? { ...item, ...edited }
                      : item,
                  ]
                })
                .concat(
                  latest.filter(
                    (item) =>
                      !visibleServer.some(
                        (row) => row.equipmentId === item.equipmentId
                      )
                  )
                )
        useCartStore
          .getState()
          .acceptServerItems(items, cartKey(items) !== lastSaved)
        initialized = true
        update({ ready: true, isSyncing: false, error: null })
        if (cartKey(items) !== lastSaved) schedule()
      } catch {
        failure()
      }
    })()
    return () => {
      active = false
      abort.abort()
      unsubscribe()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [scope, client, retryRevision])

  const fresh = state.scope === scope
  return {
    isReady: !scope || (fresh && state.ready),
    isSyncing: !!scope && (!fresh || state.isSyncing),
    error: scope && fresh ? state.error : null,
    retry,
  }
}
