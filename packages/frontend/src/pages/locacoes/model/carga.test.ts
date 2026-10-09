// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { useRentalsData } from './carga'
import type { Rental } from './contratos'

const notify = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
const rental = (id: string, userId: string): Rental => ({
  id,
  startdate: '2026-10-03',
  enddate: '2026-10-05',
  total: 100,
  status: 'PENDING',
  users: {
    id: userId,
    name: userId,
    email: userId + '@example.test',
    phone: null,
  },
  rental_items: [],
})
const a = rental('r-a', 'u-a'),
  b = rental('r-b', 'u-b')
function setup(
  fetcher: (input: string, init?: RequestInit) => Promise<Response>
) {
  let client: HttpClient = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(() => useRentalsData(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  return {
    ...hook,
    replace(next: HttpClient) {
      client = next
      hook.rerender()
    },
  }
}
function reply(path: string, init?: RequestInit) {
  if (path.endsWith('/documents'))
    return Response.json({
      documents: [{ id: path.includes('u-a') ? 'doc-a' : 'doc-b' }],
    })
  if (path.endsWith('/contract'))
    return Response.json({ contract: { id: 'contract-a', status: 'PENDING' } })
  if (path.endsWith('/client-documents'))
    return Response.json({ document: { id: 'upload-a' } })
  return Response.json(
    init?.method === 'PATCH' ? { ok: true } : { rentals: [a, b] }
  )
}
it('lista, pagina, gera contrato e faz check-in/check-out com os payloads anteriores', async () => {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) =>
    reply(path, init)
  )
  const hook = setup(fetcher)
  await waitFor(() => expect(hook.result.current.rentals).toHaveLength(2))
  expect(hook.result.current.statusFilter).toBe('PENDING')
  expect(hook.result.current.tableTotalPages).toBe(1)
  act(() => hook.result.current.setSelectedRental(a))
  await waitFor(() =>
    expect(hook.result.current.clientDocuments[0]?.id).toBe('doc-a')
  )
  await act(async () => hook.result.current.handleGenerateContract(a.id))
  expect(hook.result.current.selectedRental?.contract?.id).toBe('contract-a')
  await act(async () => hook.result.current.handleCheckIn(a.id))
  expect(hook.result.current.selectedRental).toBeNull()
  act(() => hook.result.current.setSelectedRental(b))
  await act(async () => hook.result.current.handleCheckOut(b.id))
  expect(notify.success.mock.calls.map(([message]) => message)).toEqual([
    'Contrato gerado com sucesso',
    'Check-in realizado com sucesso',
    'Check-out realizado com sucesso',
  ])
  const contract = fetcher.mock.calls.find(([path]) =>
    path.endsWith('/contract')
  )!
  expect(contract[1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(contract[1]?.body).toBeUndefined()
  const patches = fetcher.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([, init]) => JSON.parse(String(init?.body)))
  expect(patches[0]).toMatchObject({
    status: 'ACTIVE',
    checkInAt: expect.stringMatching(/^\d{4}-/),
  })
  expect(patches[1]).toMatchObject({
    status: 'COMPLETED',
    checkOutAt: expect.stringMatching(/^\d{4}-/),
  })
})
it('envia arquivo, tipo e metadata sem Content-Type manual; relê o titular selecionado', async () => {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) =>
    reply(path, init)
  )
  const hook = setup(fetcher)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => hook.result.current.setSelectedRental(a))
  await waitFor(() =>
    expect(hook.result.current.clientDocuments).toHaveLength(1)
  )
  await act(async () =>
    hook.result.current.handleUploadClientDocument(
      a.id,
      'SIGNED_CONTRACT',
      new File(['private'], 'proof.pdf', { type: 'application/pdf' })
    )
  )
  const [, init] = fetcher.mock.calls.find(([path]) =>
    path.endsWith('/client-documents')
  )!
  const form = init?.body as FormData
  expect(form.get('file')).toMatchObject({
    name: 'proof.pdf',
    type: 'application/pdf',
    size: 7,
  })
  expect(form.get('type')).toBe('SIGNED_CONTRACT')
  expect(JSON.parse(String(form.get('captureMetadata')))).toEqual({
    capturedAt: expect.stringMatching(/^\d{4}-/),
    source: 'admin-rentals-page',
  })
  expect(init?.headers).not.toHaveProperty('Content-Type')
  expect(
    fetcher.mock.calls.filter(([path]) => path.endsWith('/u-a/documents'))
  ).toHaveLength(2)
  expect(notify.success).toHaveBeenCalledWith('Documento enviado com sucesso')
})
it.each(['read', 'upload', 'contract', 'check-in'] as const)(
  'descarta %s atrasado ao trocar a locação sem toast ou refresh antigo',
  async (action) => {
    let resolve!: (response: Response) => void, init: RequestInit | undefined
    const fetcher = vi.fn(async (path: string, options?: RequestInit) => {
      if (
        (action === 'read' && path.endsWith('/u-a/documents')) ||
        path.endsWith('/client-documents') ||
        path.endsWith('/contract') ||
        options?.method === 'PATCH'
      ) {
        init = options
        return new Promise<Response>((done) => {
          resolve = done
        })
      }
      return reply(path, options)
    })
    const hook = setup(fetcher)
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    act(() => hook.result.current.setSelectedRental(a))
    let pending: Promise<void> = Promise.resolve()
    if (action !== 'read') {
      await waitFor(() =>
        expect(hook.result.current.clientDocuments).toHaveLength(1)
      )
      act(() => {
        pending =
          action === 'upload'
            ? hook.result.current.handleUploadClientDocument(
                a.id,
                'SELFIE',
                new File(['bytes'], 'x.png')
              )
            : action === 'contract'
              ? hook.result.current.handleGenerateContract(a.id)
              : hook.result.current.handleCheckIn(a.id)
      })
    }
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    act(() => hook.result.current.setSelectedRental(b))
    expect(hook.result.current.clientDocuments).toEqual([])
    await waitFor(() =>
      expect(hook.result.current.clientDocuments[0]?.id).toBe('doc-b')
    )
    expect(init?.signal?.aborted).toBe(true)
    await act(async () => {
      resolve(
        Response.json({
          documents: [{ id: 'private-a' }],
          contract: { id: 'old' },
          ok: true,
        })
      )
      await pending
    })
    expect(hook.result.current.selectedRental?.id).toBe(b.id)
    expect(hook.result.current.clientDocuments[0]?.id).toBe('doc-b')
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
    expect(
      fetcher.mock.calls.filter(([path]) => path.endsWith('/api/admin/rentals'))
    ).toHaveLength(1)
  }
)
it('um transporte substituído não aplica a lista da locadora anterior', async () => {
  let resolve!: (response: Response) => void
  const hook = setup(
    async () =>
      new Promise((done) => {
        resolve = done
      })
  )
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  hook.replace(
    createHttpClient({ fetcher: async () => Response.json({ rentals: [b] }) })
  )
  await waitFor(() => expect(hook.result.current.rentals[0]?.id).toBe(b.id))
  await act(async () => resolve(Response.json({ rentals: [a] })))
  expect(hook.result.current.rentals[0]?.id).toBe(b.id)
  expect(notify.error).not.toHaveBeenCalled()
})

it('preserva status inicial, exclusão de rejeitados/cancelados e página dez com reset de filtros', async () => {
  const cancelled = { ...b, id: 'cancelled', status: 'CANCELLED' }
  const rejected = {
    ...a,
    id: 'rejected',
    quote: { id: 'q', name: 'x', email: 'x', status: 'REJECTED' },
  }
  const list = Array.from({ length: 11 }, (_, i): Rental => ({
    ...a,
    id: 'r' + i,
    users: { ...a.users, name: 'Cliente ' + i },
  })).concat(cancelled, rejected)
  const hook = setup(async () => Response.json({ rentals: list }))
  await waitFor(() =>
    expect(hook.result.current.filteredRentals).toHaveLength(11)
  )
  expect(hook.result.current.paginatedRentals).toHaveLength(10)
  act(() => hook.result.current.setTablePage(2))
  expect(hook.result.current.paginatedRentals).toHaveLength(1)
  act(() => hook.result.current.setSearchTerm('Cliente 3'))
  await waitFor(() => expect(hook.result.current.tableCurrentPage).toBe(1))
  expect(hook.result.current.filteredRentals[0]?.id).toBe('r3')
  act(() => {
    hook.result.current.setSearchTerm('')
    hook.result.current.setStatusFilter('all')
  })
  await waitFor(() =>
    expect(hook.result.current.filteredRentals).toHaveLength(11)
  )
  act(() => hook.result.current.setStatusFilter('CANCELLED'))
  await waitFor(() =>
    expect(hook.result.current.filteredRentals).toHaveLength(1)
  )
  expect(hook.result.current.filteredRentals[0]?.id).toBe('cancelled')
})
