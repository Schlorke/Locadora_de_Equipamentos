// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useSitePublication } from './useSitePublication'
afterEach(cleanup)
const receipt = { published: true, publishedAt: '2026-10-04T12:00:00.000Z' }
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  const callback = vi.fn()
  const client = createHttpClient({ fetcher })
  const hook = renderHook(({ scope }) => useSitePublication(scope, callback), {
    initialProps: { scope: 'alfa' },
    wrapper: ({ children }: { children: ReactNode }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  return { ...hook, callback }
}
it('sem intenção não envia; confirmar exige revisão e bloqueia clique duplicado/fechamento', async () => {
  let resolve!: (response: Response) => void
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      })
  )
  const m = setup(fetcher)
  await act(async () => m.result.current.confirm())
  expect(fetcher).not.toHaveBeenCalled()
  act(() => m.result.current.begin())
  expect(fetcher).not.toHaveBeenCalled()
  let pending!: Promise<void>
  act(() => {
    pending = m.result.current.confirm()
    void m.result.current.confirm()
    m.result.current.dismiss()
  })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(m.result.current.dialogOpen).toBe(true)
  await act(async () => {
    resolve(Response.json(receipt))
    await pending
  })
  expect(m.callback).toHaveBeenCalledTimes(1)
  expect(m.result.current.state.kind).toBe('accepted')
})
it('resultado incerto aguarda repetição humana do mesmo comando, sem POST automático', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json(receipt))
  const m = setup(fetcher)
  act(() => m.result.current.begin())
  await act(async () => m.result.current.confirm())
  expect(m.result.current.state.kind).toBe('uncertain')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(m.callback).not.toHaveBeenCalled()
  act(() => m.result.current.dismiss())
  expect(m.result.current.dialogOpen).toBe(false)
  act(() => m.result.current.begin())
  await act(async () => m.result.current.confirm())
  expect(fetcher.mock.calls.map((call) => call[1].body)).toEqual(['{}', '{}'])
  expect(m.callback).toHaveBeenCalledTimes(1)
})
it('trocar locadora apaga confirmação e recusa handler antigo antes de POST', async () => {
  const fetcher = vi.fn(async () => Response.json(receipt)),
    m = setup(fetcher)
  act(() => m.result.current.begin())
  const stale = m.result.current.confirm
  m.rerender({ scope: 'bravo' })
  expect(m.result.current.state.kind).toBe('idle')
  await act(async () => {
    await stale()
    await m.result.current.confirm()
  })
  expect(fetcher).not.toHaveBeenCalled()
})
it('troca durante envio aborta e descarta aceite atrasado sem atualizar o novo checklist', async () => {
  let resolve!: (response: Response) => void
  const fetcher = vi.fn(
      (_path: string, _init?: RequestInit) =>
        new Promise<Response>((done) => {
          resolve = done
        })
    ),
    m = setup(fetcher)
  act(() => m.result.current.begin())
  let pending!: Promise<void>
  act(() => {
    pending = m.result.current.confirm()
  })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  m.rerender({ scope: 'bravo' })
  expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  await act(async () => {
    resolve(Response.json(receipt))
    await pending
  })
  expect(m.callback).not.toHaveBeenCalled()
  expect(m.result.current.state.kind).toBe('idle')
})
it('recusa de equipamento não declara sucesso', async () => {
  const m = setup(async () =>
    Response.json({ code: 'FIRST_EQUIPMENT_REQUIRED' }, { status: 409 })
  )
  act(() => m.result.current.begin())
  await act(async () => m.result.current.confirm())
  expect(m.result.current.state).toEqual({
    kind: 'problem',
    problem: 'equipment',
  })
  expect(m.callback).not.toHaveBeenCalled()
})
