// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { useFinancialExport } from './export.web'

const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  const popup = {
    document: document.implementation.createHTMLDocument(),
    closed: false,
    close: vi.fn(),
  }
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  const created = vi.fn((_blob: Blob) => 'blob:fixture'),
    revoked = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = created
      static revokeObjectURL = revoked
    }
  )
  let active = true
  const client = {
    ...createHttpClient({ baseUrl: 'https://api.example.test', fetcher }),
    isCurrent: () => active,
  }
  const hook = renderHook(() => useFinancialExport(client))
  return {
    ...hook,
    popup,
    created,
    revoked,
    retire() {
      active = false
    },
  }
}
it.each([
  ['pdf', 'relatorio-financeiro-oficio.pdf'],
  ['xlsx', 'relatorio-financeiro.xlsx'],
  ['csv', 'relatorio-financeiro.csv'],
] as const)(
  'preserva bytes e nome da exportação %s',
  async (format, filename) => {
    const fetcher = vi.fn<
      (path: string, init?: RequestInit) => Promise<Response>
    >(async () => new Response(new Uint8Array([0, 255, 128, 10])))
    const hook = setup(fetcher)
    let downloaded = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloaded = this.download
    })
    await act(async () =>
      hook.result.current('format=' + format + '&ids=p1%2Cp2', format)
    )
    expect(downloaded).toBe(filename)
    expect(
      new Uint8Array(await hook.created.mock.calls[0]![0].arrayBuffer())
    ).toEqual(new Uint8Array([0, 255, 128, 10]))
    expect(fetcher.mock.calls[0]![0]).toBe(
      'https://api.example.test/api/admin/financial/export?format=' +
        format +
        '&ids=p1%2Cp2'
    )
    expect(hook.revoked).toHaveBeenCalledWith('blob:fixture')
    expect(hook.popup.close).toHaveBeenCalled()
  }
)
it('não libera arquivo antigo nem erro após encerrar o escopo', async () => {
  let resolve!: (response: Response) => void
  const hook = setup(
    async () =>
      new Promise<Response>((done) => {
        resolve = done
      })
  )
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current('format=pdf', 'pdf')
  })
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  hook.retire()
  await act(async () => {
    resolve(new Response('old'))
    await pending
  })
  expect(hook.created).not.toHaveBeenCalled()
  expect(hook.popup.close).toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})
it('recusa JSON negativo em vez de baixar um relatório falso', async () => {
  const hook = setup(async () =>
    Response.json({ error: 'Acesso negado' }, { status: 403 })
  )
  await act(async () => hook.result.current('format=csv', 'csv'))
  expect(hook.created).not.toHaveBeenCalled()
  expect(notify.error).toHaveBeenCalledWith(
    'Erro ao exportar relatório financeiro'
  )
})
