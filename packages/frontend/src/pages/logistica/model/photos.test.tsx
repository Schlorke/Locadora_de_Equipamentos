// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useLogisticsPhotos } from './photos'
afterEach(cleanup)
function setup(
  pick: () => Promise<FormData[]>,
  fetcher = vi.fn(async () =>
    Response.json({ url: 'https://images.example.test/a.png' })
  )
) {
  const client = createHttpClient({ fetcher })
  const hook = renderHook(
    ({ id, editing }) => useLogisticsPhotos(id, editing, pick),
    {
      initialProps: { id: 'a', editing: true },
      wrapper: ({ children }) => (
        <ApiClientProvider client={client}>{children}</ApiClientProvider>
      ),
    }
  )
  return { hook, fetcher }
}
it('seleção acima do limite não envia nenhum arquivo', async () => {
  const { hook, fetcher } = setup(async () => [new FormData(), new FormData()])
  await expect(hook.result.current.choose!(1)).rejects.toThrow(
    'limite disponível'
  )
  expect(fetcher).not.toHaveBeenCalled()
})
it('resposta de upload após trocar a entrega é descartada', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn(
    async () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const { hook } = setup(async () => [], fetcher)
  let pending!: Promise<string>
  act(() => {
    pending = hook.result.current.upload(new FormData())
  })
  const result = pending.then(
    () => 'wrong',
    (error) => error.name
  )
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  hook.rerender({ id: 'b', editing: true })
  await act(async () => {
    finish(Response.json({ url: 'https://images.example.test/old.png' }))
    await result
  })
  expect(await result).toBe('AbortError')
})
it('403 e resposta sem URL não produzem arquivo', async () => {
  const forbidden = setup(
    async () => [],
    vi.fn(async () => Response.json({ error: 'Recusado' }, { status: 403 }))
  )
  await expect(
    forbidden.hook.result.current.upload(new FormData())
  ).rejects.toThrow('Recusado')
  forbidden.hook.unmount()
  const invalid = setup(
    async () => [],
    vi.fn(async () => Response.json({}))
  )
  await expect(
    invalid.hook.result.current.upload(new FormData())
  ).rejects.toThrow('Resposta inválida')
})
