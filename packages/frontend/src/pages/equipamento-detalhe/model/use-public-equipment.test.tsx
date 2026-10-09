// @vitest-environment jsdom
// S13: com o site da locadora em pausa, o detalhe (web e Expo) mostra a mensagem neutra do backend, sem quebrar.
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { usePublicEquipment } from './use-public-equipment'

afterEach(cleanup)

function hook(response: () => Response) {
  const fetcher = vi.fn(async () => response())
  const client = createHttpClient({
    baseUrl: 'https://app.plataforma.example',
    fetcher,
  })
  return renderHook(() => usePublicEquipment('eq-1', 'locadora-a'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
}

describe('usePublicEquipment com o site em pausa', () => {
  it('503 SITE_PAUSED: a mensagem neutra do contrato, sem equipamento', async () => {
    const { result } = hook(() =>
      Response.json(
        {
          error: 'Este site está temporariamente indisponível.',
          code: 'SITE_PAUSED',
        },
        { status: 503, headers: { 'Retry-After': '3600' } }
      )
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.equipment).toBeNull()
    expect(result.current.error).toBe(
      'Este site está temporariamente indisponível.'
    )
  })

  it('outras falhas continuam com a mensagem genérica', async () => {
    const { result } = hook(() =>
      Response.json({ error: 'fixture-private' }, { status: 500 })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(
      'Não foi possível carregar o equipamento. Tente novamente.'
    )
  })
})
