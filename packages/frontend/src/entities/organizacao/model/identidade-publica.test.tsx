// @vitest-environment jsdom
// Identidade pública da locadora (achado 143, T12): só o cartão que o host informou, nunca um padrão de outra.
import { createElement, type ReactNode } from 'react'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, type HttpClient } from '../../../shared/api'
import { PublicTenantProvider } from './public-tenant'
import {
  IdentidadePublicaProvider,
  useIdentidadePublica,
  useMarcaDoAcesso,
} from './identidade-publica'
import type { IdentidadePublica } from './marca'

afterEach(cleanup)

const LOCADORA: IdentidadePublica = {
  nome: 'Locadora Alfa',
  cidade: 'Curitiba',
  uf: 'PR',
  logoUrl: null,
}

function wrapper(
  request: ReturnType<typeof vi.fn>,
  slug: string | null,
  informada?: IdentidadePublica | null
) {
  return ({ children }: { children: ReactNode }) => {
    const comSlug = createElement(PublicTenantProvider, {
      value: slug,
      children,
    })
    const comIdentidade =
      informada === undefined
        ? comSlug
        : createElement(IdentidadePublicaProvider, {
            value: informada,
            children: comSlug,
          })
    return createElement(ApiClientProvider, {
      client: { request: request as HttpClient['request'] },
      children: comIdentidade,
    })
  }
}

describe('identidade pública da locadora', () => {
  it('host informou o cartão: usa sem consultar a rede', () => {
    const request = vi.fn()
    const { result } = renderHook(useIdentidadePublica, {
      wrapper: wrapper(request, 'locadora-alfa', LOCADORA),
    })
    expect(result.current).toEqual(LOCADORA)
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    ['host informou que não há locadora', null],
    ['sem identidade informada (raiz legada, app)', undefined],
  ] as const)(
    '%s: null, sem consultar e nunca uma marca padrão',
    (_caso, informada) => {
      const request = vi.fn()
      const { result } = renderHook(
        () => [useIdentidadePublica(), useMarcaDoAcesso()] as const,
        {
          wrapper: wrapper(request, 'locadora-b', informada),
        }
      )
      expect(result.current[0]).toBeNull()
      expect(result.current[1]).toEqual({
        sigla: '',
        rodape: 'Sistema de Acesso',
      })
      expect(request).not.toHaveBeenCalled()
    }
  )
})
