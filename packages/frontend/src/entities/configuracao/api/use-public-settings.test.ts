// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, type HttpClient } from '../../../shared/api'
import { usePublicSettings } from './use-public-settings'
afterEach(cleanup)
const wrapper =
  (request: ReturnType<typeof vi.fn>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(ApiClientProvider, {
      client: { request: request as HttpClient['request'] },
      children,
    })
describe('Tenant public settings', () => {
  it("does not select a default tenant or emit another company's contact data", async () => {
    const request = vi.fn()
    const { result } = renderHook(() => usePublicSettings(), {
      wrapper: wrapper(request),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(request).not.toHaveBeenCalled()
    expect(result.current.settings.companyPhone).toBe('')
    expect(result.current.settings.companyAddress).toBe('')
    expect(result.current.error).toContain('Selecione uma locadora')
  })
  it('passes an explicit slug and normalizes nullable fields without a fallback brand', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({
        companyPhone: null,
        contactEmail: 'contato@tenant.test',
        companyAddress: null,
      })
    const { result } = renderHook(
      () => usePublicSettings({ tenantSlug: 'locadora-a' }),
      { wrapper: wrapper(request) }
    )
    await waitFor(() =>
      expect(result.current.settings.contactEmail).toBe('contato@tenant.test')
    )
    expect(request.mock.calls[0]?.[0]).toBe(
      '/api/settings/public?tenantSlug=locadora-a'
    )
    expect(result.current.settings.companyPhone).toBe('')
    expect(result.current.settings.companyAddress).toBe('')
  })
  // Achado 147: horário e identificação legal da própria locadora; fora do contrato, nada (nunca um padrão).
  it('keeps contract-shaped business hours and legal identity and drops anything else', async () => {
    const hours = {
      monday: { closed: false, open: '08:00', close: '18:00' },
      sunday: { closed: true },
    }
    const legal = { legalName: 'Locadora Nova Ltda', cnpj: '11.222.333/0001-81' }
    const request = vi
      .fn()
      .mockResolvedValueOnce({ businessHours: hours, legalIdentity: legal })
      .mockResolvedValueOnce({
        businessHours: { monday: { open: '8h', close: '18h' } },
        legalIdentity: { legalName: null, cnpj: '11222333000181' },
      })
    const first = renderHook(
      () => usePublicSettings({ tenantSlug: 'locadora-a' }),
      { wrapper: wrapper(request) }
    )
    await waitFor(() =>
      expect(first.result.current.settings.legalIdentity).toEqual(legal)
    )
    expect(first.result.current.settings.businessHours).toEqual(hours)
    const second = renderHook(
      () => usePublicSettings({ tenantSlug: 'locadora-b' }),
      { wrapper: wrapper(request) }
    )
    await waitFor(() => expect(second.result.current.isLoading).toBe(false))
    expect(second.result.current.settings.businessHours).toBeNull()
    expect(second.result.current.settings.legalIdentity).toBeNull()
    // Sem resposta (sem locadora): nenhum horário nem CNPJ.
    const none = renderHook(() => usePublicSettings(), {
      wrapper: wrapper(vi.fn()),
    })
    await waitFor(() => expect(none.result.current.isLoading).toBe(false))
    expect(none.result.current.settings.businessHours).toBeNull()
    expect(none.result.current.settings.legalIdentity).toBeNull()
  })

  it('discards a late response from a previously selected company', async () => {
    let resolveOld!: (data: unknown) => void
    const request = vi.fn().mockImplementation((path: string) =>
      path.includes('locadora-a')
        ? new Promise((resolve) => {
            resolveOld = resolve
          })
        : Promise.resolve({ contactEmail: 'nova@tenant.test' })
    )
    const { result, rerender } = renderHook(
      ({ slug }) => usePublicSettings({ tenantSlug: slug }),
      { initialProps: { slug: 'locadora-a' }, wrapper: wrapper(request) }
    )
    rerender({ slug: 'locadora-b' })
    await waitFor(() =>
      expect(result.current.settings.contactEmail).toBe('nova@tenant.test')
    )
    await act(async () => resolveOld({ contactEmail: 'antiga@tenant.test' }))
    expect(result.current.settings.contactEmail).toBe('nova@tenant.test')
  })
})

// Onda 134: conteúdo institucional chave a chave e disponibilidade dos textos legais, sem padrão de outra locadora.
describe('conteúdo institucional e textos legais na leitura pública', () => {
  it('mantém o conteúdo válido, descarta só a chave inválida e ignora a desconhecida', async () => {
    const request = vi.fn().mockResolvedValue({
      siteContent: {
        experienceYears: 12,
        fleetSize: 'duzentos',
        novoCampo: { qualquer: true },
        commitments: { support24h: true, novoCompromisso: true },
      },
      legalDocuments: { terms: true, privacy: false, returnPolicy: true },
    })
    const { result } = renderHook(
      () => usePublicSettings({ tenantSlug: 'locadora-a' }),
      { wrapper: wrapper(request) }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.siteContent).toEqual({
      experienceYears: 12,
      commitments: { support24h: true },
    })
    expect(result.current.settings.legalDocuments).toEqual({
      terms: true,
      privacy: false,
      returnPolicy: true,
    })
  })

  it('sem os campos (backend antigo) ou fora do contrato: nenhum conteúdo e nenhum texto legal', async () => {
    for (const resposta of [
      {},
      { siteContent: [], legalDocuments: { terms: 'sim' } },
      { siteContent: 'texto', legalDocuments: null },
    ]) {
      const request = vi.fn().mockResolvedValue(resposta)
      const { result } = renderHook(
        () => usePublicSettings({ tenantSlug: 'locadora-a' }),
        { wrapper: wrapper(request) }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.settings.siteContent).toEqual({})
      expect(result.current.settings.legalDocuments).toEqual({
        terms: false,
        privacy: false,
        returnPolicy: false,
      })
      cleanup()
    }
  })

  it('com os dados iniciais do servidor (SSR), a mesma normalização, sem consultar a API', () => {
    const request = vi.fn()
    const { result } = renderHook(
      () =>
        usePublicSettings({
          initialData: {
            siteContent: { experienceYears: 0, clientsServed: 500 },
          } as never,
        }),
      { wrapper: wrapper(request) }
    )
    expect(request).not.toHaveBeenCalled()
    expect(result.current.settings.siteContent).toEqual({ clientsServed: 500 })
  })
})
