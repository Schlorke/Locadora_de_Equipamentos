'use client'

import Script from 'next/script'
import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { adoptSimplifiedLocatorStyle } from './locator-shadow-style.web'

/** Endereço da loja no formato do Quick Builder do Google (coordenadas e Place ID da própria locadora). */
export interface LocalDaLoja {
  title: string
  address1: string
  address2?: string
  coords: { lat: number; lng: number }
  placeId?: string
}

/** Configuração do localizador (formato Quick Builder do Google) para o local da própria locadora. */
const storeLocatorConfig = (location: LocalDaLoja) => ({
  locations: [location],
  mapOptions: {
    center: location.coords,
    fullscreenControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    zoom: 15,
    zoomControl: true,
    maxZoom: 17,
  },
})

const ECL_SCRIPT_URL =
  'https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.11/index.min.js'

/** Canal de solução para métricas do Google (Criador rápido de soluções) */
const SOLUTION_CHANNEL = 'GMP_QB_locatorplus_v11_cABCDE'

/** Traduções pt-BR para o ECL (não expõe i18n; aplicado via CSS + text node no Shadow DOM) */

/**
 * Molduras do mapa (altura, cantos e borda), as da produção: a padrão, de 400px, e a do cartão "Onde estamos" da página
 * de contato (origem histórica `eb4c0098:app/contato/page.tsx:296`, retirada em F), com borda e 450px a partir do `md`. A moldura mora no mapa (a fatia
 * dona); a página escolhe qual. O aviso sem chave do Google usa a mesma moldura.
 */
const ALTURA_DO_MAPA = 'h-[400px]'
const BORDA_DO_MAPA = 'border border-slate-200'
const MOLDURAS = {
  padrao: `${ALTURA_DO_MAPA} w-full overflow-hidden rounded-xl`,
  cartao: `${ALTURA_DO_MAPA} w-full overflow-hidden rounded-xl ${BORDA_DO_MAPA} md:h-[450px]`,
} as const
const AVISO_PADRAO = `flex ${ALTURA_DO_MAPA} items-center justify-center rounded-xl ${BORDA_DO_MAPA} bg-slate-50 text-slate-600`

interface GoogleStoreLocatorProps {
  /**
   * Local da própria locadora (`siteContent.storeLocation`, onda 134). Sem ele não há mapa nem aviso (achado 143:
   * nunca o endereço de outra locadora).
   */
  location?: LocalDaLoja | null
  /** Altura do container do mapa (default: 400px); tem precedência sobre `moldura`. */
  className?: string
  /** Moldura da produção: `cartao` no cartão "Onde estamos" do contato (borda, 400px e 450px no `md`). */
  moldura?: 'cartao'
  /** Modo simplificado: oculta barra de pesquisa e "All locations" (default: false) */
  simplified?: boolean
}

/**
 * Localizador de loja (Store Locator) usando Google Maps Extended Component Library.
 * Exibe o local da própria locadora com mapa, detalhes e rotas.
 *
 * Requer NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no .env.local.
 * Opcional: NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID para mapa customizado (Cloud).
 */
export function GoogleStoreLocator({
  location = null,
  className: classeRecebida,
  moldura,
  simplified = false,
}: GoogleStoreLocatorProps) {
  const className = classeRecebida ?? (moldura ? MOLDURAS[moldura] : undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [configured, setConfigured] = useState(false)

  const rawKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  // Evitar InvalidKeyMapError: não carregar o script com chave vazia ou placeholder
  const apiKey =
    rawKey &&
    !/sua-chave|your-api-key|your-key|xxx|example|placeholder|fake/i.test(
      rawKey.trim()
    )
      ? rawKey.trim()
      : ''
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? undefined

  // Em navegação SPA o script ECL já está no documento e onLoad do next/script pode não
  // disparar de novo — detectar ECL já carregado para garantir configuração em toda visita.
  useEffect(() => {
    if (scriptLoaded || !apiKey) return
    const isEclLoaded =
      typeof customElements !== 'undefined' &&
      customElements.get('gmpx-store-locator') !== undefined
    if (isEclLoaded) setScriptLoaded(true)
  }, [apiKey, scriptLoaded])

  const configureLocator = useCallback(() => {
    if (!containerRef.current || !apiKey || !location || configured) return

    const locator = containerRef.current.querySelector('gmpx-store-locator')
    if (!locator) return

    const configure = async () => {
      try {
        await (customElements as CustomElementRegistry).whenDefined(
          'gmpx-store-locator'
        )
        const el = containerRef.current?.querySelector('gmpx-store-locator')
        if (!el || !('configureFromQuickBuilder' in el)) return

        // Capabilities: simplificado para homepage, completo para /contato
        const capabilities = simplified
          ? {
              input: false,
              autocomplete: false,
              directions: false,
              distanceMatrix: false,
              details: false,
              actions: false,
            }
          : {
              input: true,
              autocomplete: true,
              directions: true,
              distanceMatrix: true,
              details: true,
              actions: true,
            }

        const applyConfig = () => {
          ;(
            el as { configureFromQuickBuilder: (_c: object) => void }
          ).configureFromQuickBuilder({
            ...storeLocatorConfig(location),
            capabilities,
            mapsApiKey: apiKey,
          })
          setConfigured(true)
        }

        // Garantir que o container já tenha dimensões (layout concluído) antes de
        // configurar o mapa — evita mapa em branco após navegação SPA.
        requestAnimationFrame(() => {
          requestAnimationFrame(applyConfig)
        })
      } catch {
        // customElements.whenDefined já resolvido ou elemento não existe
      }
    }

    configure()
  }, [apiKey, configured, simplified, location])

  // Atributo "key" do gmpx-api-loader (React reserva "key", então setamos via DOM)
  useEffect(() => {
    if (!containerRef.current || !apiKey) return
    const loader = containerRef.current.querySelector('gmpx-api-loader')
    if (loader) loader.setAttribute('key', apiKey)
  }, [apiKey])

  // Traduzir textos do ECL para pt-BR via CSS injection + text node replacement
  useEffect(() => {
    if (!configured || !containerRef.current) return

    const applyTranslations = () => {
      const storeLocator =
        containerRef.current?.querySelector('gmpx-store-locator')
      if (!storeLocator?.shadowRoot) return

      // Traduzir text nodes diretamente (apenas os nós de texto, não os elementos)
      const h1 = storeLocator.shadowRoot.querySelector('h1.search-title')
      if (h1) {
        h1.childNodes.forEach((node) => {
          if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.includes('Find a location near you')
          ) {
            node.textContent = node.textContent.replace(
              'Find a location near you',
              'Encontre a rota mais próxima de você'
            )
          }
        })
      }

      const sectionName =
        storeLocator.shadowRoot.querySelector('div.section-name')
      if (sectionName) {
        sectionName.childNodes.forEach((node) => {
          if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.includes('All locations')
          ) {
            node.textContent = node.textContent.replace(
              'All locations',
              'Todas as localizações'
            )
          }
        })
        // Atualizar também "Nearest locations"
        sectionName.childNodes.forEach((node) => {
          if (
            node.nodeType === Node.TEXT_NODE &&
            node.textContent?.includes('Nearest locations')
          ) {
            node.textContent = node.textContent.replace(
              'Nearest locations',
              'Localizações mais próximas'
            )
          }
        })
      }

      // 3. Traduzir "View details" e outros textos em links/botões
      const allElements = storeLocator.shadowRoot.querySelectorAll('*')
      allElements.forEach((el) => {
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const t = node.textContent
            if (t.includes('View details')) {
              node.textContent = t.replace('View details', 'Ver detalhes')
            }
            if (t.includes('Get directions')) {
              node.textContent = t.replace('Get directions', 'Como chegar')
            }
          }
        })
      })

      // 4. Traduzir placeholder do gmpx-place-picker
      const placePicker =
        storeLocator.shadowRoot.querySelector('gmpx-place-picker')
      if (placePicker) {
        placePicker.setAttribute('placeholder', 'Digite seu endereço ou CEP')
        if (placePicker.shadowRoot) {
          const input = placePicker.shadowRoot.querySelector('input')
          if (input && input.placeholder.includes('Enter')) {
            input.placeholder = 'Digite seu endereço ou CEP'
          }
        }
      }
    }

    // Aplicar em intervalos progressivos (ECL leva tempo para renderizar)
    const timers = [100, 300, 500, 1000, 2000, 3000, 5000].map((delay) =>
      window.setTimeout(applyTranslations, delay)
    )

    // Intervalo contínuo como fallback
    const interval = window.setInterval(applyTranslations, 2000)

    return () => {
      timers.forEach(clearTimeout)
      clearInterval(interval)
    }
  }, [configured])

  // Esconder o header "All locations (1)" e as bordas do store locator com uma folha adotada no Shadow DOM
  // (locator-shadow-style.web.ts). Apenas no modo simplificado (homepage)
  useEffect(() => {
    if (!containerRef.current || !simplified) return

    const hideHeader = () => {
      const storeLocator =
        containerRef.current?.querySelector('gmpx-store-locator')
      if (!storeLocator?.shadowRoot) return false

      adoptSimplifiedLocatorStyle(storeLocator.shadowRoot)
      return true
    }

    // Tentar várias vezes pois o Shadow DOM pode demorar a ser criado
    const interval = setInterval(() => {
      if (hideHeader()) {
        clearInterval(interval)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [scriptLoaded, configured, simplified])

  useEffect(() => {
    if (scriptLoaded && apiKey) configureLocator()
  }, [scriptLoaded, apiKey, configureLocator])

  // Sem o local da locadora: nenhum mapa e nenhum aviso (onda 134; quem chama tira o cartão do mapa).
  if (!location) return null

  if (!apiKey) {
    return (
      <div className={className ?? AVISO_PADRAO}>
        <p className="text-center text-sm">
          Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa.
        </p>
      </div>
    )
  }

  return (
    <>
      <Script
        src={ECL_SCRIPT_URL}
        strategy="lazyOnload"
        type="module"
        onLoad={() => setScriptLoaded(true)}
      />
      <div
        ref={containerRef}
        className={className ?? MOLDURAS.padrao}
        style={{
          // Variáveis CSS do Locator Plus (alinhadas ao design do projeto)
          // https://github.com/googlemaps/extended-component-library/blob/main/src/store_locator/README.md
          ['--gmpx-color-surface' as string]: '#fff', // token-check-allow: superfície do mapa da loja
          ['--gmpx-color-on-surface' as string]: '#212121', // token-check-allow: texto do mapa da loja
          ['--gmpx-color-on-surface-variant' as string]: '#757575', // token-check-allow: texto secundário do mapa
          ['--gmpx-color-primary' as string]: '#ea580c', // token-check-allow: laranja da marca no mapa
          ['--gmpx-color-outline' as string]: '#e2e8f0', // token-check-allow: contorno do mapa da loja
          ['--gmpx-fixed-panel-width-row-layout' as string]: '28.5em',
          ['--gmpx-fixed-panel-height-column-layout' as string]: '40%',
          ['--gmpx-font-family-base' as string]:
            'var(--font-inter), sans-serif',
          ['--gmpx-font-family-headings' as string]:
            'var(--font-heading), sans-serif',
          ['--gmpx-font-size-base' as string]: '0.875rem',
          ['--gmpx-hours-color-open' as string]: '#188038', // token-check-allow: verde de aberto no mapa
          ['--gmpx-hours-color-closed' as string]: '#d50000', // token-check-allow: vermelho de fechado no mapa
          ['--gmpx-rating-color' as string]: '#ffb300', // token-check-allow: estrela do mapa da loja
          ['--gmpx-rating-color-empty' as string]: '#e2e8f0', // token-check-allow: estrela vazia do mapa
        }}
      >
        {/* Custom elements do Extended Component Library (key do loader setada em useEffect) */}
        {createElement('gmpx-api-loader', {
          'solution-channel': SOLUTION_CHANNEL,
        })}
        {createElement('gmpx-store-locator', {
          ...(mapId ? { 'map-id': mapId } : {}),
        })}
      </div>
    </>
  )
}
