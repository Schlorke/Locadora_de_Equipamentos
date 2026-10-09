// @vitest-environment jsdom
// S13: catálogo (web e Expo) de locadora com o site em pausa: a API responde 503 SITE_PAUSED e a tela mostra a
// mensagem neutra do backend, sem itens e sem quebrar.
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useEquipmentCatalog } from './use-equipment-catalog'

afterEach(cleanup)

describe('useEquipmentCatalog com o site em pausa', () => {
  it('mostra a mensagem neutra e nenhum equipamento', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: 'Este site está temporariamente indisponível.',
          code: 'SITE_PAUSED',
        },
        { status: 503, headers: { 'Retry-After': '3600' } }
      )
    )
    const client = createHttpClient({
      baseUrl: 'https://app.plataforma.example',
      fetcher,
    })
    const { result } = renderHook(
      () => useEquipmentCatalog({ categoria: null, tenantSlug: 'locadora-a' }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ApiClientProvider client={client}>{children}</ApiClientProvider>
        ),
      }
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe(
      'Este site está temporariamente indisponível.'
    )
    expect(result.current.equipments).toEqual([])
    expect(result.current.categories).toEqual([])
  })
})
