'use client'

import { Autocomplete } from '@gb-locacoes/ui'
import { useApiClient } from '../../../shared/api'
import { usePublicTenantSlug } from '../../../entities/organizacao'
import {
  anos,
  comMais,
  maisAntes,
  usePublicSettings,
  type PublicSettings,
} from '../../../entities/configuracao'
import { cn } from '../../../shared/lib/cn.web'
import { ArrowRight, MapPin, Phone, Play } from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { HeroBackgroundCarousel } from './HeroBackgroundCarousel.web'
import { HeroCarouselDots } from './HeroCarouselDots.web'
import { HeroWaveAnimation } from './HeroWaveAnimation.web'

// 🚀 Lazy load do Equipment3DCarousel (Three.js) para reduzir bundle inicial e TBT
// Carrega apenas quando necessário, melhorando métricas de performance críticas
const Equipment3DCarousel = dynamic(
  () =>
    import('./Equipment3DCarousel.web').then((mod) => ({
      default: mod.default,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-gradient-to-br from-orange-500/20 to-orange-700/20 rounded-2xl flex items-center justify-center">
        <div className="text-white text-lg">Carregando modelos 3D...</div>
      </div>
    ),
  }
)

import type { Equipment3DModel } from './Equipment3DCarousel.web'

const HERO_EQUIPMENT_MODELS: Equipment3DModel[] = [
  {
    id: 'compressor',
    name: 'Compressor de Ar',
    modelUrl: '/models/Compressor.glb',
    description: 'Compressores de alta pressão',
  },
  {
    id: 'betoneira',
    name: 'Betoneira',
    modelUrl: '/models/Betoneira.glb',
    description: 'Betoneiras para preparo de concreto',
  },
  {
    id: 'andaime',
    name: 'Andaime',
    modelUrl: '/models/Andaime.glb',
    description: 'Andaimes para trabalhos em altura',
  },
]

/**
 * Subtítulo do hero sem texto da locadora: só o texto do modelo de site, sem fato de uma empresa (o padrão anterior
 * citava os anos de mercado da GB; achado 143).
 */
export const HERO_SUBTITULO_PADRAO =
  'Soluções em locação de equipamentos para obras e serviços em altura. Segurança, qualidade e manutenção constante.'

/**
 * Subtítulo do hero (onda 134): com os anos de mercado que a própria locadora declarou no painel, a redação da produção
 * ("Há N anos oferecendo..."); sem eles, o texto do modelo. Nunca o texto "Sobre nós" (achado 1.9.1 do plano).
 */
export function subtituloDoHero(experienceYears?: number | null): string {
  return experienceYears
    ? `Há ${anos(experienceYears)} oferecendo soluções em locação de equipamentos para obras e serviços em altura. Segurança, qualidade e manutenção constante.`
    : HERO_SUBTITULO_PADRAO
}

type HeroProps = {
  initialSettings?: Partial<PublicSettings> | null
}

export default function Hero({ initialSettings }: HeroProps = {}) {
  const router = useRouter()
  const api = useApiClient()
  const tenantSlug = usePublicTenantSlug()
  const loadSuggestions = useCallback(
    async (query: string) => {
      if (!tenantSlug) return []
      const rows = await api.request<
        Array<{
          id: string
          name: string
          description: string
          pricePerDay: string
          category: { name: string }
        }>
      >(
        `/api/equipamentos/search?tenantSlug=${encodeURIComponent(tenantSlug)}&q=${encodeURIComponent(query)}`
      )
      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: row.description,
        group: row.category.name,
        detail: `R$ ${Number(row.pricePerDay).toFixed(2)}/dia`,
      }))
    },
    [api, tenantSlug]
  )
  const { settings, isLoading } = usePublicSettings({
    initialData: initialSettings ?? undefined,
  })
  // Anos de mercado e frota da própria locadora (conteúdo do painel; onda 134): cada selo só com o próprio número.
  const anosDeMercado = settings.siteContent.experienceYears ?? null
  const frota = settings.siteContent.fleetSize ?? null
  // Telefone e WhatsApp da própria locadora (no host web, já no recorte do SSR), cada um só quando informado (vazio ou
  // só espaços não conta): o "|" da produção só entre os dois e, sem nenhum, o bloco do telefone sai (a região de
  // entrega fica). Carregando, o hero inteiro fica no fundo silencioso abaixo, sem o bloco.
  const telefone = settings.companyPhone.trim()
  const whatsapp = settings.whatsappNumber.trim()
  // No celular, um número só: o WhatsApp, como na produção; sem ele, o telefone (nunca o ícone sozinho).
  const numeroNoCelular = whatsapp || telefone
  const [isScrollRevealReady, setIsScrollRevealReady] = useState(false)
  const [forceBackgroundVisible, setForceBackgroundVisible] = useState(false)
  const [currentImage, setCurrentImage] = useState(0)
  const containerClasses = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'

  // Aguardar scroll-reveal-init estar pronto antes de iniciar animações do flash
  useEffect(() => {
    const handleScrollRevealReady = () => {
      setIsScrollRevealReady(true)
    }

    window.addEventListener('scrollRevealReady', handleScrollRevealReady)

    return () => {
      window.removeEventListener('scrollRevealReady', handleScrollRevealReady)
    }
  }, [])

  useEffect(() => {
    if (isScrollRevealReady) {
      setForceBackgroundVisible(false)
      return
    }

    const timeout = window.setTimeout(() => {
      setForceBackgroundVisible(true)
    }, 600)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [isScrollRevealReady])

  // Extrair imagens do carousel
  const carouselImages = useMemo(() => {
    const heroCarousel = settings?.heroCarousel

    if (!Array.isArray(heroCarousel)) {
      return []
    }

    return heroCarousel
      .map((item) => item?.imageUrl)
      .filter((image): image is string => Boolean(image))
  }, [settings?.heroCarousel])
  const hasImages = carouselImages.length > 0
  const showHeroDots = hasImages && carouselImages.length > 1
  const waveAnimation =
    (settings.waveAnimation as 'none' | 'static' | 'animated' | undefined) ||
    'animated'

  const initialHeroCarousel = Array.isArray(initialSettings?.heroCarousel)
    ? initialSettings?.heroCarousel
    : undefined
  const hasInitialImages =
    Array.isArray(initialHeroCarousel) && initialHeroCarousel.length > 0
  const shouldShowWhite = hasImages
  const loadingShouldShowWhite = hasImages || hasInitialImages

  const handleEquipmentSelect = (equipment: { id: string }) => {
    // Sempre que onSelect for chamado (seja por seleção ou clique na lupa com item selecionado)
    // redireciona para a página de detalhes do equipamento
    if (equipment.id) {
      router.push(`/equipamentos/${equipment.id}`)
    }
  }

  const handleSearch = (query: string) => {
    // Chamado apenas quando não há equipamento selecionado
    // Redireciona para a página de equipamentos com a busca por texto
    router.push(`/equipamentos?search=${encodeURIComponent(query)}`)
  }

  const paddingBottomClasses =
    waveAnimation !== 'none'
      ? 'pb-12 md:pb-16 lg:pb-20'
      : 'pb-12 md:pb-16 lg:pb-20'

  const overlayOffsetClasses =
    waveAnimation !== 'none'
      ? 'bottom-12 md:bottom-16 lg:bottom-20'
      : 'bottom-0'
  const shouldRevealBackground = isScrollRevealReady || forceBackgroundVisible

  useEffect(() => {
    if (!showHeroDots) return

    const interval = window.setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % carouselImages.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [showHeroDots, carouselImages.length])

  useEffect(() => {
    if (!hasImages && currentImage !== 0) {
      setCurrentImage(0)
      return
    }

    if (hasImages && currentImage >= carouselImages.length) {
      setCurrentImage(0)
    }
  }, [hasImages, carouselImages.length, currentImage])

  // Durante loading, usa background previsto a partir de dados iniciais
  if (isLoading) {
    return (
      <section
        className={cn(
          'relative text-white overflow-hidden bg-slate-50',
          // padding-bottom para compensar altura da onda
          paddingBottomClasses
        )}
      >
        {!loadingShouldShowWhite && (
          <div
            className={cn(
              'absolute inset-x-0 top-0 pointer-events-none bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800',
              overlayOffsetClasses
            )}
          />
        )}

        {/* Loading silencioso - aguarda settings carregarem */}
      </section>
    )
  }

  return (
    <section
      className={cn(
        'relative text-white overflow-hidden bg-slate-50',
        paddingBottomClasses
      )}
      role="region"
      aria-roledescription={hasImages ? 'carousel' : undefined}
    >
      <HeroBackgroundCarousel
        images={carouselImages}
        overlayOffsetClasses={overlayOffsetClasses}
        shouldShowWhite={shouldShowWhite}
        shouldRevealBackground={shouldRevealBackground}
        currentImage={currentImage}
      />

      <div className={cn(containerClasses, 'relative z-10 w-full py-14')}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-6">
            <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold leading-tight motion-safe:opacity-0">
              Locação de Equipamentos para{' '}
              <span className="text-yellow-300 relative">
                Construção Civil
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-yellow-300 rounded-full transform scale-x-0 animate-scale-x"></div>
              </span>
            </h1>
            <p className="hero-subtitle text-lg md:text-xl leading-relaxed motion-safe:opacity-0">
              {subtituloDoHero(anosDeMercado)}
            </p>
            <div className="hero-search bg-white rounded-2xl p-2 max-w-md border border-white/20 transition-all duration-300 relative z-[9998] motion-safe:opacity-0">
              <Autocomplete
                loadOptions={loadSuggestions}
                disabled={!tenantSlug}
                placeholder="Buscar equipamentos (ex: andaime, betoneira)"
                onSelect={handleEquipmentSelect}
                onSearch={handleSearch}
                className="w-full"
              />
            </div>
            <div className="hero-buttons flex flex-col sm:flex-row gap-4 motion-safe:opacity-0">
              <Link
                href="/equipamentos"
                className="inline-flex items-center justify-center hover:bg-yellow-600 gap-2 px-6 h-12 bg-yellow-500 hover:text-white text-gray-900 font-semibold rounded-xl hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl group text-sm"
              >
                Ver Catálogo de Equipamentos
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/orcamento"
                className="inline-flex items-center justify-center gap-2 px-6 h-12 bg-white hover:bg-gray-50 text-gray-900 hover:text-orange-600 font-semibold rounded-xl hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl group border-2 border-white text-sm"
              >
                <Play className="h-4 w-4 group-hover:scale-110 transition-transform" />
                Solicitar Orçamento
              </Link>
            </div>
            <div className="hero-contact flex flex-col sm:flex-row gap-4 pt-2 text-orange-100 motion-safe:opacity-0">
              {telefone || whatsapp ? (
                <div className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer group">
                  <Phone className="h-5 w-5 group-hover:animate-bounce" />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <div className="sm:hidden">
                      <a
                        href={`tel:+55${numeroNoCelular.replace(/\D/g, '')}`}
                        className="hover:underline"
                      >
                        {numeroNoCelular}
                      </a>
                    </div>
                    <div className="hidden sm:flex sm:items-center sm:gap-2">
                      {telefone ? (
                        <a
                          href={`tel:+55${telefone.replace(/\D/g, '')}`}
                          className="hover:underline"
                        >
                          {telefone}
                        </a>
                      ) : null}
                      {telefone && whatsapp ? <span>|</span> : null}
                      {whatsapp ? (
                        <a
                          href={`tel:+55${whatsapp.replace(/\D/g, '')}`}
                          className="hover:underline"
                        >
                          {whatsapp}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer group">
                <MapPin className="h-5 w-5 group-hover:animate-pulse" />
                <span>Entregamos em toda região</span>
              </div>
            </div>
          </div>
          {/* ========================================
              SOLUÇÃO DEFINITIVA - BACKDROP-FILTER + HOVER SCALE
              ========================================

              Problema resolvido:
              - Backdrop-filter agora aumenta junto com o canvas no hover
              - Não há mais bordas sem blur visíveis

              Mudanças:
              1. Container externo (.hero-image):
                 - SEM backdrop-filter
                 - SEM opacity inline
                 - Apenas overflow-hidden para cantos arredondados

              2. Wrapper interno (.hero-image-inner):
                 - COM backdrop-filter (aumenta junto com scale)
                 - COM opacity (para ScrollReveal funcionar)
                 - COM group-hover:scale-[1.04]

              3. Badges:
                 - Fora do wrapper interno
                 - Não são afetados pelo scale
                 - Completamente visíveis

              Estrutura:
              .hero-image (overflow-hidden apenas)
                ├── .hero-image-inner (backdrop + opacity + scale)
                │     └── Equipment3DCarousel
                ├── Badge da frota (fora, não afetado; só com a frota da locadora)
                ├── Badge dos anos (fora, não afetado; só com os anos da locadora)
                └── Border animado (fora, não afetado)
          */}
          <div className="hero-image group relative w-full lg:w-[540px] aspect-square mx-auto rounded-2xl">
            {/* Wrapper interno com backdrop-filter, opacity e scale */}
            <div
              className="hero-image-inner relative h-full w-full rounded-2xl duration-500 group-hover:scale-[1.04]"
              style={{
                opacity: 0,
                // Backdrop-filter AQUI - aumenta junto com o scale
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              }}
            >
              <Equipment3DCarousel
                models={HERO_EQUIPMENT_MODELS}
                autoRotate={true}
                autoRotateInterval={6000}
                className="transform transition-transform duration-500"
                height="100%"
                // Sincronização explícita com ScrollReveal:
                // O primeiro modelo não executa Bounds.fit() até o ScrollReveal terminar
                isRevealComplete={isScrollRevealReady}
              />
            </div>

            {/* Badges e elementos decorativos - FORA do wrapper com scale */}
            {/* Não são afetados pelo hover scale */}
            {/* Adicionadas classes hero-badge-* e opacity: 0 para participar do ScrollReveal */}
            {/* Onda 134: cada selo só com o número que a própria locadora declarou no painel (frota e anos). */}
            {frota ? (
              <div
                className="hero-badge-left hidden sm:block absolute -bottom-2 -left-2 bg-yellow-500 text-gray-900 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20"
                style={{ opacity: 0 }}
              >
                <div className="text-2xl font-bold animate-count-up">
                  {maisAntes(frota)}
                </div>
                <div className="text-sm font-medium">
                  Equipamentos Disponíveis
                </div>
              </div>
            ) : null}

            {anosDeMercado ? (
              <div
                className="hero-badge-right hidden sm:block absolute -top-2 -right-2 bg-white/90 backdrop-blur-sm text-orange-600 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer z-20"
                style={{ opacity: 0 }}
              >
                <div className="text-2xl font-bold">
                  {comMais(anosDeMercado)}
                </div>
                <div className="text-sm font-medium">Anos de Experiência</div>
              </div>
            ) : null}

            <div
              className="hero-border absolute inset-[-1rem] border-2 border-white/20 rounded-2xl animate-pulse pointer-events-none group-hover:scale-105 transform transition-transform"
              style={{ opacity: 0 }}
            ></div>
          </div>
        </div>
        <HeroCarouselDots
          images={carouselImages}
          currentImage={currentImage}
          onDotClick={setCurrentImage}
        />
      </div>

      <HeroWaveAnimation waveAnimation={waveAnimation} />
    </section>
  )
}
