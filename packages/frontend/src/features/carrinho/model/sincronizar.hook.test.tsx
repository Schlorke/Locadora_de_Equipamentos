// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../../../shared/api'
import { useCartStore, switchCartScope, type CartItem } from './carrinho'
import { useCartSync } from './sincronizar'

const scope = JSON.stringify(['locadora-a', 'ana'])
const other = JSON.stringify(['locadora-b', 'ana'])
const local = (equipmentId = 'betoneira', quantity = 1): CartItem => ({
  equipmentId,
  equipmentName: equipmentId,
  quantity,
  days: 7,
  pricePerDay: 100,
})
const server = (equipmentId = 'betoneira', quantity = 1) => ({
  equipmentId,
  quantity,
  days: 7,
  pricePerDay: '90',
  finalPrice: '630',
  equipment: { name: equipmentId, pricePerDay: '100', weeklyDiscount: 10 },
})
const flush = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}
function api() {
  const request = vi.fn().mockResolvedValue({ items: [] })
  return { request, client: { request } as HttpClient }
}
function start(client: HttpClient, selected: string | null = scope) {
  return renderHook(
    ({ selected }) => useCartSync({ client, scope: selected }),
    { initialProps: { selected } }
  )
}
beforeEach(async () => {
  await switchCartScope(null)
  localStorage.clear()
  await switchCartScope(scope)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sincronização do carrinho no escopo confirmado', () => {
  it('mesclagem gravada com resposta perdida: remoção sobrevive à recarga sem apagar itens somente remotos', async () => {
    const { client, request } = api()
    useCartStore.getState().addItem(local())
    request.mockRejectedValueOnce(new Error('resposta perdida'))
    const first = start(client)
    await flush()
    act(() => useCartStore.getState().removeItem('betoneira'))
    first.unmount()
    await switchCartScope(other)
    await switchCartScope(scope)
    expect(useCartStore.getState().removedEquipmentIds).toEqual(['betoneira'])
    request.mockResolvedValueOnce({ items: [server(), server('remoto')] })
    vi.useFakeTimers()
    const next = start(client)
    await flush()
    expect(next.result.current.error).toBeNull()
    expect(
      useCartStore.getState().items.map((item) => item.equipmentId)
    ).toEqual(['remoto'])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(JSON.parse(request.mock.calls[2]![1].body)).toEqual({
      items: [{ equipmentId: 'remoto', quantity: 1, days: 7 }],
    })
  })

  it('limpar durante a primeira leitura mantém a intenção de carrinho vazio', async () => {
    const { client, request } = api()
    let finish!: (value: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    start(client)
    act(() => useCartStore.getState().clearCart())
    await act(async () => {
      finish({ items: [server()] })
    })
    expect(useCartStore.getState().items).toEqual([])
    expect(useCartStore.getState().remotePending).toBe(true)
  })

  it('operações sem mudança de quantidade/dias não deixam uma gravação pendente', async () => {
    const { client, request } = api()
    request.mockResolvedValue({ items: [server()] })
    start(client)
    await flush()
    vi.useFakeTimers()
    act(() => {
      useCartStore.getState().updateItemQuantity('betoneira', 1)
      useCartStore.getState().updateItemDays('betoneira', 7)
      useCartStore
        .getState()
        .addItem({ ...useCartStore.getState().items[0]!, pricePerDay: 120 })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(useCartStore.getState().remotePending).toBe(false)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('mescla com localCartItems e restaura os itens remotos em uma única hidratação, sem loop', async () => {
    const { client, request } = api()
    useCartStore.getState().addItem(local())
    request.mockResolvedValue({ items: [server(), server('andaime')] })
    const view = start(client)
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
    const [path, options] = request.mock.calls[0]!
    expect(path).toBe('/api/cart/merge')
    expect(JSON.parse(options.body)).toEqual({
      localCartItems: [{ equipmentId: 'betoneira', quantity: 1, days: 7 }],
    })
    expect(
      useCartStore.getState().items.map((item) => item.equipmentId)
    ).toEqual(['betoneira', 'andaime'])
    expect(useCartStore.getState().getTotalPrice()).toBe(1260)
    expect(view.result.current).toMatchObject({
      isReady: true,
      isSyncing: false,
      error: null,
    })
    view.rerender({ selected: scope })
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('restaura o carrinho remoto quando o aparelho está vazio, sem criar carrinho via POST', async () => {
    const { client, request } = api()
    request.mockResolvedValue({ items: [server()] })
    start(client)
    await flush()
    expect(
      request.mock.calls.map((call) => [call[0], call[1]?.method ?? 'GET'])
    ).toEqual([['/api/cart/sync', 'GET']])
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('sem escopo validado não lê nem escreve a API', async () => {
    const { client, request } = api()
    useCartStore.getState().addItem(local())
    const view = start(client, null)
    await flush()
    expect(request).not.toHaveBeenCalled()
    expect(view.result.current.isReady).toBe(true)
  })

  it('debounce envia somente a última quantidade, e remoção usa replace com array vazio', async () => {
    const { client, request } = api()
    request.mockResolvedValue({ items: [server()] })
    start(client)
    await flush()
    vi.useFakeTimers()
    act(() => {
      useCartStore.getState().updateItemQuantity('betoneira', 2)
      useCartStore.getState().updateItemQuantity('betoneira', 3)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(JSON.parse(request.mock.calls[1]![1].body)).toEqual({
      items: [{ equipmentId: 'betoneira', quantity: 3, days: 7 }],
    })
    act(() => useCartStore.getState().removeItem('betoneira'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(JSON.parse(request.mock.calls[2]![1].body)).toEqual({ items: [] })
    expect(useCartStore.getState().remotePending).toBe(false)
  })

  it('não regrava a API por atualizar somente preço/metadata', async () => {
    const { client, request } = api()
    request.mockResolvedValue({ items: [server()] })
    start(client)
    await flush()
    vi.useFakeTimers()
    act(() =>
      useCartStore
        .getState()
        .hydrateItems(
          useCartStore
            .getState()
            .items.map((item) => ({ ...item, pricePerDay: 120 }))
        )
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().remotePending).toBe(false)
  })

  it('escritas são serializadas e uma edição durante o POST segue sem perder a mais recente', async () => {
    const { client, request } = api()
    request.mockResolvedValueOnce({ items: [server()] })
    let finish!: (value: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    request.mockResolvedValue({ message: 'ok' })
    start(client)
    await flush()
    vi.useFakeTimers()
    act(() => useCartStore.getState().updateItemQuantity('betoneira', 2))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    act(() => useCartStore.getState().updateItemQuantity('betoneira', 5))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(request).toHaveBeenCalledTimes(2)
    await act(async () => {
      finish({ message: 'ok' })
    })
    expect(useCartStore.getState().remotePending).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(JSON.parse(request.mock.calls[2]![1].body).items[0].quantity).toBe(5)
    expect(useCartStore.getState().remotePending).toBe(false)
  })

  it('falha inicial conserva itens e deixa retry explícito sem repetição automática', async () => {
    const { client, request } = api()
    useCartStore.getState().addItem(local())
    request.mockRejectedValue(new Error('offline'))
    const view = start(client)
    await flush()
    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(view.result.current).toMatchObject({
      isReady: true,
      isSyncing: false,
    })
    expect(view.result.current.error).toContain('salvos neste aparelho')
    request.mockResolvedValue({ items: [server()] })
    act(() => view.result.current.retry())
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
    expect(view.result.current.error).toBeNull()
  })

  it('remoção offline sobrevive à recarga do escopo; retry substitui antes de ler e não ressuscita itens', async () => {
    const { client, request } = api()
    request.mockResolvedValueOnce({ items: [server()] })
    const view = start(client)
    await flush()
    vi.useFakeTimers()
    request.mockRejectedValueOnce(new Error('offline'))
    act(() => useCartStore.getState().clearCart())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(useCartStore.getState().remotePending).toBe(true)
    view.unmount()
    await switchCartScope(other)
    await switchCartScope(scope)
    expect(useCartStore.getState()).toMatchObject({
      items: [],
      remoteReady: true,
      remotePending: true,
    })
    request
      .mockResolvedValueOnce({ message: 'ok' })
      .mockResolvedValueOnce({ items: [] })
    const next = start(client)
    await flush()
    expect(
      request.mock.calls
        .slice(2)
        .map((call) => [call[0], call[1]?.method ?? 'GET'])
    ).toEqual([
      ['/api/cart/sync', 'POST'],
      ['/api/cart/sync', 'GET'],
    ])
    expect(JSON.parse(request.mock.calls[2]![1].body)).toEqual({ items: [] })
    expect(next.result.current.error).toBeNull()
    expect(useCartStore.getState().remotePending).toBe(false)
  })

  it('um escopo já sincronizado sem edição usa GET, respeitando remoções feitas em outro aparelho', async () => {
    const { client, request } = api()
    useCartStore.getState().acceptServerItems([local()], false)
    start(client)
    await flush()
    expect(request.mock.calls[0]![0]).toBe('/api/cart/sync')
    expect(request.mock.calls[0]![1].method).toBeUndefined()
    expect(useCartStore.getState().items).toEqual([])
  })

  it('não perde adições, mudanças ou remoções feitas durante a leitura, nem os itens só remotos', async () => {
    const { client, request } = api()
    const kept = local()
    const removed = local('removido')
    useCartStore.getState().addItem(kept)
    useCartStore.getState().addItem(removed)
    let finish!: (value: unknown) => void
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    start(client)
    act(() => {
      useCartStore.getState().updateItemQuantity(kept.equipmentId, 4)
      useCartStore.getState().removeItem(removed.equipmentId)
      useCartStore.getState().addItem(local('novo'))
    })
    await act(async () => {
      finish({ items: [server(), server('removido'), server('remoto')] })
    })
    expect(
      useCartStore
        .getState()
        .items.map((item) => [item.equipmentId, item.quantity])
    ).toEqual([
      ['betoneira', 4],
      ['remoto', 1],
      ['novo', 1],
    ])
    expect(useCartStore.getState().remotePending).toBe(true)
  })

  it.each(['outra locadora', 'ida e volta'])(
    'ignora resposta tardia após %s, mesmo se o transporte não respeitar abort',
    async (kind) => {
      const { client, request } = api()
      let finish!: (value: unknown) => void
      request.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      const view = start(client)
      await switchCartScope(other)
      if (kind === 'ida e volta') await switchCartScope(scope)
      useCartStore.getState().addItem(local('novo-escopo'))
      await act(async () => {
        finish({ items: [server('antigo')] })
      })
      expect(
        useCartStore.getState().items.map((item) => item.equipmentId)
      ).toEqual(['novo-escopo'])
      view.unmount()
      expect(request.mock.calls[0]![1].signal.aborted).toBe(true)
    }
  )

  it('resposta malformada não apaga o carrinho local', async () => {
    const { client, request } = api()
    useCartStore.getState().addItem(local())
    request.mockResolvedValue({ items: null })
    const view = start(client)
    await flush()
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(view.result.current.error).not.toBeNull()
  })
})
