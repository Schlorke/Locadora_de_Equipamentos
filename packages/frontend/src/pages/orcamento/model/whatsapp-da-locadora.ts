'use client'
import { useCallback } from 'react'
import { usePublicSettings } from '../../../entities/configuracao'
import { usePublicTenantSlug } from '../../../entities/organizacao'
import { useApiClient } from '../../../shared/api'

/**
 * WhatsApp da própria locadora para o orçamento pelo WhatsApp (achado 143: nunca um número fixo de outra locadora).
 * `string`: o número já está em mãos e o clique abre o WhatsApp sem esperar a rede; `null`: ainda carregando;
 * `Promise`: o número é lido no clique.
 */
export type LeituraDoWhatsApp = () => string | null | Promise<string>

/**
 * Web: lê as configurações públicas ao montar o formulário. No navegador, `window.open` chamado depois de um `await`
 * perde o gesto do usuário e o bloqueador de pop-ups (Safari, Firefox) descarta a janela; com o número já lido, o
 * clique abre o WhatsApp de forma síncrona.
 */
export function useWhatsAppCarregado(): LeituraDoWhatsApp {
  const { settings, isLoading } = usePublicSettings()
  const numero = settings.whatsappNumber.trim()
  return useCallback(() => (isLoading ? null : numero), [isLoading, numero])
}

/**
 * App nativo: lê as configurações públicas só no clique (o formulário não consulta a API antes do envio). O WhatsApp
 * abre pelo `Linking`, que não tem bloqueador de pop-ups, então a espera pela rede não perde a abertura.
 */
export function useWhatsAppNoClique(): LeituraDoWhatsApp {
  const api = useApiClient()
  const tenantSlug = usePublicTenantSlug()
  return useCallback(async () => {
    if (!tenantSlug) return ''
    try {
      const settings = await api.request<{ whatsappNumber?: unknown }>(
        '/api/settings/public?tenantSlug=' + encodeURIComponent(tenantSlug)
      )
      return typeof settings?.whatsappNumber === 'string'
        ? settings.whatsappNumber.trim()
        : ''
    } catch {
      return ''
    }
  }, [api, tenantSlug])
}
