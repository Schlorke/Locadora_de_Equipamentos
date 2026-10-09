// @vitest-environment jsdom
// Orçamento pelo WhatsApp com o número e o nome da própria locadora (achado 143). Antes a mensagem ia para o
// WhatsApp da GB (`openWhatsAppQuote(whatsappData, '555198205163')`) em qualquer locadora. Segunda rodada: no web o
// número é lido ao montar o formulário e o clique abre o WhatsApp sem esperar a rede, porque o bloqueador de pop-ups
// descarta `window.open` chamado depois de um `await` (o gesto do usuário já passou); no app, o número é lido no
// clique (o Linking não tem bloqueador) e o formulário não consulta a API antes do envio.
import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, type HttpClient } from '../../../shared/api'

const estado = vi.hoisted(() => ({
  nome: null as string | null,
  whatsapp: '',
  carregando: false,
}))
const avisos = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: avisos }))
vi.mock('../../../entities/organizacao', () => ({
  usePublicTenantSlug: () => 'locadora-a',
  useIdentidadePublica: () =>
    estado.nome
      ? { nome: estado.nome, cidade: null, uf: null, logoUrl: null }
      : null,
}))
vi.mock('../../../entities/configuracao', () => ({
  usePublicSettings: () => ({
    settings: { whatsappNumber: estado.whatsapp },
    isLoading: estado.carregando,
    error: null,
  }),
}))
vi.mock('./quote-api', () => ({ useQuoteApi: () => ({}) }))

import { useQuoteForm } from './use-quote-form'
import {
  useWhatsAppCarregado,
  useWhatsAppNoClique,
  type LeituraDoWhatsApp,
} from './whatsapp-da-locadora'

function preencher(
  usarLeitura: () => LeituraDoWhatsApp,
  request: ReturnType<typeof vi.fn> = vi.fn()
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(ApiClientProvider, {
      client: { request: request as HttpClient['request'] },
      children,
    })
  const { result } = renderHook(
    () =>
      useQuoteForm(
        { prefilledEquipment: { id: 'eq-1', name: 'Betoneira' } },
        usarLeitura()
      ),
    { wrapper }
  )
  act(() => {
    result.current.setValue('customerName', 'Ana Cliente')
    result.current.setValue('customerEmail', 'ana@cliente.example.test')
    result.current.setValue('customerPhone', '41988887777')
    result.current.setValue('rentalDays', 3)
  })
  return result
}

/**
 * `window.open` como o bloqueador de pop-ups do navegador: só abre durante o gesto do usuário (a parte síncrona do
 * clique). Chamado depois que o clique terminou (por exemplo, depois de um `await`), devolve `null` sem abrir nada.
 */
function abrirSoNoGesto() {
  const gesto = { ativo: false }
  const abertas: string[] = []
  const open = vi
    .spyOn(window, 'open')
    .mockImplementation((url?: string | URL) => {
      if (!gesto.ativo) return null
      abertas.push(String(url))
      return {} as Window
    })
  const clicar = (acao: () => unknown) => {
    gesto.ativo = true
    try {
      return acao()
    } finally {
      gesto.ativo = false
    }
  }
  return { open, abertas, clicar }
}

beforeEach(() => {
  estado.nome = null
  estado.whatsapp = ''
  estado.carregando = false
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('useQuoteForm: orçamento pelo WhatsApp no web (número lido ao montar)', () => {
  it('abre o WhatsApp da própria locadora no próprio clique, com o nome e a origem do site dela', async () => {
    estado.nome = 'Locadora A'
    estado.whatsapp = '(41) 99999-0000'
    const result = preencher(useWhatsAppCarregado)
    const popup = abrirSoNoGesto()
    await act(async () => {
      await popup.clicar(() => result.current.handleWhatsAppSubmit())
    })
    expect(popup.open).toHaveBeenCalledTimes(1)
    expect(popup.abertas).toHaveLength(1)
    const url = new URL(popup.abertas[0]!)
    expect(url.origin + url.pathname).toBe('https://wa.me/5541999990000')
    const texto = url.searchParams.get('text') ?? ''
    expect(
      texto.startsWith(`${window.location.origin}/equipamentos/eq-1\n\n`)
    ).toBe(true)
    expect(texto).toContain('*SOLICITAÇÃO DE ORÇAMENTO - LOCADORA A*')
    expect(texto).toContain('*Via Site Locadora A*')
    expect(texto).not.toMatch(/GB LOCA|GB Loca|locacoesgb/)
    expect(avisos.success).toHaveBeenCalledTimes(1)
  })

  it('número lido no clique, no navegador: o bloqueador descarta a janela (por isso o web lê ao montar)', async () => {
    const result = preencher(() => async () => '(41) 99999-0000')
    const popup = abrirSoNoGesto()
    await act(async () => {
      await popup.clicar(() => result.current.handleWhatsAppSubmit())
    })
    expect(popup.open).toHaveBeenCalledTimes(1)
    expect(popup.abertas).toEqual([])
  })

  it('sem WhatsApp nas configurações: avisa e não abre o número de outra locadora', async () => {
    const result = preencher(useWhatsAppCarregado)
    const popup = abrirSoNoGesto()
    await act(async () => {
      await popup.clicar(() => result.current.handleWhatsAppSubmit())
    })
    expect(popup.open).not.toHaveBeenCalled()
    expect(avisos.error).toHaveBeenCalledWith(
      'WhatsApp indisponível',
      expect.anything()
    )
  })

  it('configurações ainda carregando: pede para tentar de novo, sem abrir nada nem acusar falta de WhatsApp', async () => {
    estado.carregando = true
    estado.whatsapp = '(41) 99999-0000'
    const result = preencher(useWhatsAppCarregado)
    const popup = abrirSoNoGesto()
    await act(async () => {
      await popup.clicar(() => result.current.handleWhatsAppSubmit())
    })
    expect(popup.open).not.toHaveBeenCalled()
    expect(avisos.error).not.toHaveBeenCalled()
    expect(avisos.info).toHaveBeenCalledWith(
      'Carregando o contato da locadora',
      expect.anything()
    )
  })
})

describe('useWhatsAppNoClique: app (número lido no clique)', () => {
  it('nada consultado antes do clique; no clique, as configurações públicas da própria locadora', async () => {
    const request = vi.fn(async () => ({
      whatsappNumber: ' (41) 99999-0000 ',
    }))
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const result = preencher(useWhatsAppNoClique, request)
    expect(request).not.toHaveBeenCalled()
    await act(async () => result.current.handleWhatsAppSubmit())
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/api/settings/public?tenantSlug=locadora-a'
    )
    expect(open).toHaveBeenCalledTimes(1)
    expect(String(open.mock.calls[0]![0])).toMatch(
      /^https:\/\/wa\.me\/5541999990000\?/
    )
  })

  it.each([
    ['sem WhatsApp nas configurações', async () => ({ whatsappNumber: '' })],
    [
      'configurações indisponíveis',
      async () => Promise.reject(new Error('409')),
    ],
  ])(
    '%s: avisa e não abre o número de outra locadora',
    async (_caso, resposta) => {
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      const result = preencher(useWhatsAppNoClique, vi.fn(resposta))
      await act(async () => result.current.handleWhatsAppSubmit())
      expect(open).not.toHaveBeenCalled()
      expect(avisos.error).toHaveBeenCalledWith(
        'WhatsApp indisponível',
        expect.anything()
      )
    }
  )
})
