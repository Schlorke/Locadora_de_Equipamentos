/**
 * 🎬 SISTEMA DE SCROLL REVEAL DA VITRINE
 *
 * Sistema inteligente de animações que detecta o tipo de navegação:
 * - Primeira visita: Executa animações suaves
 * - Navegação interna: Mostra elementos imediatamente
 *
 * Compatível com:
 * ✅ Elementos estáticos (Categories, Hero)
 * ✅ Elementos dinâmicos (FeaturedMaterials com ssr: false)
 * ✅ Componentes com carregamento assíncrono
 * ✅ Navegação entre páginas
 * ✅ Dispositivos móveis
 *
 * @author Equipe de desenvolvimento da plataforma
 * @version 2.1 - Atualizado para suportar .hero-image-inner
 * @see docs/scroll-reveal-system.md
 */

'use client'

import { useEffect, useState } from 'react'
import { useVisiblePathname } from '../../shared/lib/navigation/use-visible-pathname.web'

/**
 * Elementos cuja transição é do CSS (`styles/components.web.css`), valendo também durante a revelação: nesses a
 * revelação anima só opacity, transform e animation e nunca grava `transition` inline, que disputaria com o CSS.
 */
export const CSS_OWNED_TRANSITION =
  '.contact-form, .contact-card, .benefit-card, .material-card, .hero-image'

/** Transição inline da revelação (`none` enquanto o elemento espera), exceto nos elementos cuja transição é do CSS. */
function setRevealTransition(element: HTMLElement, value: string) {
  if (element.matches(CSS_OWNED_TRANSITION)) return
  element.style.transition = value
}

/**
 * Com `prefers-reduced-motion: reduce`, estes elementos ficam parados: a revelação não os esconde nem os anima e grava
 * o repouso (opacidade 1, sem transform e sem animação) por cima do estilo inline do JSX.
 */
export const STILL_WHEN_REDUCED_MOTION =
  '.material-card, .benefit-card, .contact-form, .contact-info, .contact-card, .cta-section, ' +
  '.section-title, .section-subtitle, .hero-title, .hero-subtitle, .hero-search, .hero-buttons, .hero-contact, .hero-image'

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Repouso de um elemento parado pelo movimento reduzido. */
function holdStill(element: HTMLElement) {
  element.style.opacity = '1'
  element.style.transform = 'none'
  element.style.animation = 'none'
}

export default function ScrollRevealInit() {
  const [isHydrated, setIsHydrated] = useState(false)
  // Só a fonte do caminho mudou (sem o prefixo interno /{slug} do host de locadora); o uso segue igual.
  const pathname = useVisiblePathname()

  // Aguardar hidratação completa
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return

    let cleanup: () => void = () => {}

    const run = () => {
      // CRÍTICO: O evento scrollRevealReady será disparado pela função
      // dispatchScrollRevealReady() que considera o tipo de navegação

      // Movimento reduzido: os elementos de STILL_WHEN_REDUCED_MOTION ficam em repouso e nenhum caminho da revelação
      // os esconde ou anima (o scrollRevealReady continua no mesmo instante).
      const reducedMotion = prefersReducedMotion()
      const isStill = (element: Element) =>
        reducedMotion && element.matches(STILL_WHEN_REDUCED_MOTION)
      const holdStillElements = () => {
        if (!reducedMotion) return
        document
          .querySelectorAll<HTMLElement>(STILL_WHEN_REDUCED_MOTION)
          .forEach(holdStill)
      }
      holdStillElements()

      const resetInlineCleanupFlags = () => {
        const flagged = document.querySelectorAll(
          '[data-inline-transition-cleared],[data-inline-motion-cleared]'
        )
        flagged.forEach((el) => {
          el.removeAttribute('data-inline-transition-cleared')
          el.removeAttribute('data-inline-motion-cleared')
        })
      }

      const clearInlineTransition = (element: HTMLElement, delay = 0) => {
        if (element.dataset.inlineTransitionCleared === 'true') return
        window.setTimeout(() => {
          if (element.style.transition === 'none') {
            element.style.removeProperty('transition')
          }
          element.dataset.inlineTransitionCleared = 'true'
        }, delay)
      }

      const clearInlineMotion = (element: HTMLElement, delay = 0) => {
        if (element.dataset.inlineMotionCleared === 'true') return
        window.setTimeout(() => {
          element.style.removeProperty('animation')
          // ATUALIZADO: Para hero-image-inner, badges e border
          // IMPORTANTE: DEFINIR opacity: 1 em vez de REMOVER
          // porque remover faz o elemento voltar ao valor do JSX (opacity: 0)
          // o que causa o periodicCheck reaplicar transition: none
          if (
            element.classList.contains('hero-image') ||
            element.classList.contains('hero-image-inner') ||
            element.classList.contains('hero-badge-left') ||
            element.classList.contains('hero-badge-right') ||
            element.classList.contains('hero-border')
          ) {
            // CORREÇÃO: Manter opacity: 1 para evitar ciclo de reaplicação
            element.style.opacity = '1'
            // Remover transform para permitir hover effects funcionarem
            element.style.removeProperty('transform')
            // CRÍTICO: Também remover transition para não bloquear hover scale
            element.style.removeProperty('transition')
          }
          element.dataset.inlineMotionCleared = 'true'
        }, delay)
      }

      const resetHeroInlineStyles = () => {
        // ATUALIZADO: Limpar .hero-image, .hero-image-inner, badges e border
        document
          .querySelectorAll<HTMLElement>(
            '.hero-image, .hero-image-inner, .hero-badge-left, .hero-badge-right, .hero-border'
          )
          .forEach((el) => {
            el.style.removeProperty('animation')
            el.style.removeProperty('opacity')
            el.style.removeProperty('transform')
            el.style.removeProperty('transition')
            delete el.dataset.inlineMotionCleared
            delete el.dataset.inlineTransitionCleared
          })
      }
      const getNavigationType = () => {
        // Verificar se existe performance.navigation (método mais antigo)
        if (performance.navigation) {
          return performance.navigation.type
        }

        // Método mais moderno
        const navEntries = performance.getEntriesByType(
          'navigation'
        ) as PerformanceNavigationTiming[]
        if (navEntries.length > 0 && navEntries[0]) {
          return navEntries[0].type
        }

        return 'navigate' // fallback
      }

      /**
       * 🧠 DETECÇÃO DE TIPO DE NAVEGAÇÃO
       *
       * Determina se deve executar animações baseado no tipo de acesso:
       * - Primeira visita: URL digitada, refresh, nova aba
       * - Navegação interna: Clique em links internos, histórico
       */
      const isInternalNavigation = () => {
        const navigationType = getNavigationType()
        const wasInternalClick =
          sessionStorage.getItem('internalNavigation') === 'true'

        // Limpar flag de navegação interna
        sessionStorage.removeItem('internalNavigation')

        // Se foi um clique interno OU se o tipo é 'navigate' e temos histórico de estar no site
        return (
          wasInternalClick ||
          (navigationType === 'navigate' &&
            sessionStorage.getItem('hasVisitedSite') === 'true')
        )
      }

      // Detectar se é dispositivo móvel
      const isMobile = () => {
        return (
          window.innerWidth <= 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          )
        )
      }

      // Página "Sobre" sempre executa animações, independente da navegação
      const isAboutPage = pathname === '/sobre'
      const shouldExecuteAnimations = isAboutPage || !isInternalNavigation()
      const isOnMobile = isMobile()

      // CRÍTICO: Disparar evento scrollRevealReady no momento correto
      // - Primeira visita: Após animação mais longa terminar (~2.6s)
      // - Navegação interna: Imediatamente (elementos já estão visíveis)
      const dispatchScrollRevealReady = () => {
        if (shouldExecuteAnimations) {
          // Primeira visita: Aguardar animação mais longa terminar
          // .hero-badge-right: delay 2.0s + duração 0.6s = 2.6s + 100ms margem = 2.7s
          const scrollRevealDuration = 2700
          setTimeout(() => {
            window.dispatchEvent(new Event('scrollRevealReady'))
          }, scrollRevealDuration)
        } else {
          // Navegação interna: Disparar após pequeno delay para garantir que elementos estão visíveis
          setTimeout(() => {
            window.dispatchEvent(new Event('scrollRevealReady'))
          }, 200)
        }
      }

      /**
       * 🎯 SELETORES DE ELEMENTOS ANIMADOS
       *
       * Todos os elementos que participam do sistema de scroll reveal.
       * Para adicionar novos elementos, inclua suas classes aqui.
       *
       * IMPORTANTE:
       * - .hero-image: Container externo (não animado diretamente)
       * - .hero-image-inner: Wrapper interno com backdrop-filter (ANIMADO)
       * - .hero-badge-left, .hero-badge-right: Badges (+200 e 10+)
       * - .hero-border: Border animado ao redor do carrossel
       */
      const selectors =
        '.hero-title, .hero-subtitle, .hero-search, .hero-buttons, .hero-contact, .hero-image-inner, .hero-badge-left, .hero-badge-right, .hero-badge-top-left, .hero-border, .hero-wave, ' +
        '.section-title, .section-subtitle, .material-card, .benefit-card, ' +
        '.contact-form, .contact-info, .cta-section, ' +
        '[data-scroll-reveal], [data-fade-only]'

      const initializeElement = (element: HTMLElement) => {
        // CORREÇÃO: Garantir que elementos sejam inicializados como invisíveis
        // desde o primeiro momento para evitar flash inicial

        if (isStill(element)) {
          holdStill(element)
        } else if (element.classList.contains('hero-wave')) {
          // Inicializar ondinha como invisível para animação de slide up
          element.style.opacity = '0'
          element.style.transform = 'translateY(20px)'
          setRevealTransition(element, 'none')
        } else if (
          element.classList.contains('section-title') ||
          element.classList.contains('section-subtitle')
        ) {
          // Inicializar títulos e subtítulos de seção para animação
          element.style.opacity = '0'
          element.style.transform = 'translateY(60px)'
          setRevealTransition(element, 'none')
        } else if (element.hasAttribute('data-scroll-reveal')) {
          // Inicializar elementos com data-scroll-reveal
          element.style.opacity = '0'
          element.style.transform = 'translate3d(0, 40px, 0)'
          setRevealTransition(element, 'none')
          element.style.willChange = 'opacity, transform'
          element.style.backfaceVisibility = 'hidden'
        } else if (element.hasAttribute('data-fade-only')) {
          // Inicializar elementos que devem apenas fazer fade-in (sem slide)
          element.style.opacity = '0'
          element.style.transform = 'none'
          setRevealTransition(element, 'opacity 0.8s ease-out')
          element.style.willChange = 'opacity'
        } else {
          // CORREÇÃO: Garantir que TODOS os elementos sejam invisíveis inicialmente
          element.style.opacity = '0'
          element.style.transform = 'translateY(60px)'
          setRevealTransition(element, 'none')
        }
      }

      // Marcar que o usuário já visitou o site
      sessionStorage.setItem('hasVisitedSite', 'true')

      // Função para mostrar todos os elementos imediatamente (sem animação)
      const showAllElementsImmediately = () => {
        const animatedElements = document.querySelectorAll(selectors)

        animatedElements.forEach((element) => {
          const htmlElement = element as HTMLElement
          if (isStill(htmlElement)) {
            holdStill(htmlElement)
            return
          }

          // CORREÇÃO: Identificar elementos hero que precisam manter hover effects
          const isHeroElement =
            htmlElement.classList.contains('hero-image') ||
            htmlElement.classList.contains('hero-image-inner') ||
            htmlElement.classList.contains('hero-badge-left') ||
            htmlElement.classList.contains('hero-badge-right') ||
            htmlElement.classList.contains('hero-border')

          if (htmlElement.classList.contains('hero-wave')) {
            // Ondinha - mostrar imediatamente na navegação interna
            htmlElement.style.opacity = '1'
            htmlElement.style.transform = 'translateY(0)'
            htmlElement.style.animation = 'none'
            setRevealTransition(htmlElement, 'none')
          } else if (isHeroElement) {
            // CORREÇÃO: Elementos hero - mostrar imediatamente MAS preservar transições
            // para que hover effects (como scale) continuem funcionando
            htmlElement.style.opacity = '1'
            htmlElement.style.animation = 'none'
            // NÃO aplicar transition: none aqui! Isso bloqueia hover scale
            // Também não modificar transform para preservar hover effects
          } else if (htmlElement.hasAttribute('data-scroll-reveal')) {
            // Elementos com data-scroll-reveal - mostrar imediatamente
            htmlElement.style.opacity = '1'
            htmlElement.style.transform = 'translate3d(0, 0, 0)'
            htmlElement.style.animation = 'none'
            setRevealTransition(htmlElement, 'none')
            htmlElement.style.willChange = 'auto'
          } else if (htmlElement.hasAttribute('data-fade-only')) {
            // Elementos com fade-only - mostrar imediatamente
            htmlElement.style.opacity = '1'
            htmlElement.style.transform = 'none'
            htmlElement.style.animation = 'none'
            setRevealTransition(htmlElement, 'none')
            htmlElement.style.willChange = 'auto'
          } else {
            // Legacy inline style approach
            htmlElement.style.opacity = '1'
            htmlElement.style.transform = 'translateY(0)'
            htmlElement.style.animation = 'none'
            setRevealTransition(htmlElement, 'none')
          }

          // CORREÇÃO: Não chamar clearInlineTransition para elementos hero
          // pois isso pode interferir com hover effects
          if (!isHeroElement) {
            clearInlineTransition(htmlElement, 150)
          }

          // Chamar clearInlineMotion para elementos hero (agora corrigido para não remover opacity)
          if (isHeroElement) {
            clearInlineMotion(htmlElement, 150)
          }
        })

        // Também mostrar os contact-cards imediatamente
        const contactCards = document.querySelectorAll('.contact-card')
        contactCards.forEach((card) => {
          const htmlCard = card as HTMLElement
          if (isStill(htmlCard)) {
            holdStill(htmlCard)
            return
          }
          htmlCard.style.opacity = '1'
          htmlCard.style.transform = 'translateX(0)'
          htmlCard.style.animation = 'none'
          clearInlineTransition(htmlCard, 150)
        })
      }

      // Função para inicializar elementos como invisíveis (para animação)
      const initializeElementsForAnimation = () => {
        const animatedElements = document.querySelectorAll(selectors)

        animatedElements.forEach((element) => {
          initializeElement(element as HTMLElement)
        })
      }

      // Função para configurar o observer (para animações)
      const setupObserver = () => {
        const observerOptions = {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px',
        }

        // Batching de callbacks usando requestAnimationFrame para reduzir TBT
        let rafId: number | null = null
        const pendingEntries: IntersectionObserverEntry[] = []
        let observerInstance: IntersectionObserver | null = null

        const processEntries = () => {
          const entries = pendingEntries.splice(0)
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const element = entry.target as HTMLElement

              if (isStill(element)) {
                holdStill(element)
                observerInstance?.unobserve(element)
                return
              }

              if (element.classList.contains('hero-title')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                element.style.animation =
                  'slide-in-left 1.2s ease-out 0.6s forwards'
              } else if (element.classList.contains('hero-subtitle')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                element.style.animation =
                  'slide-in-left 1s ease-out 0.8s forwards'
              } else if (element.classList.contains('hero-search')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                element.style.animation =
                  'slide-in-left 0.8s ease-out 1.0s forwards'
              } else if (element.classList.contains('hero-buttons')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                element.style.animation =
                  'slide-in-left 0.8s ease-out 1.2s forwards'
              } else if (element.classList.contains('hero-contact')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                element.style.animation =
                  'slide-in-left 0.6s ease-out 1.4s forwards'
              } else if (element.classList.contains('hero-image-inner')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                // Aplicar animação no .hero-image-inner (não no .hero-image)
                element.style.animation =
                  'slide-in-right 1.2s ease-out 0.6s forwards'
                clearInlineMotion(element, 1800)
              } else if (element.classList.contains('hero-badge-left')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                // Badge +200 - aparece da esquerda com delay
                element.style.animation =
                  'slide-in-left 0.6s ease-out 1.8s forwards'
                clearInlineMotion(element, 2400)
              } else if (element.classList.contains('hero-badge-right')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                // Badge 10+ - aparece da direita com delay
                element.style.animation =
                  'slide-in-right 0.6s ease-out 2.0s forwards'
                clearInlineMotion(element, 2600)
              } else if (element.classList.contains('hero-border')) {
                // ATUALIZADO: Delay aumentado para dar mais visibilidade ao flash branco
                // Border animado - vem junto com o bloco 3D, da direita para esquerda
                element.style.animation =
                  'slide-in-right 1.2s ease-out 0.6s forwards'
                clearInlineMotion(element, 1800)
              } else if (element.classList.contains('hero-wave')) {
                element.style.animation =
                  'slide-in-up 1.2s ease-out 0s forwards'
              }

              // Elementos com data-scroll-reveal
              else if (element.hasAttribute('data-scroll-reveal')) {
                element.style.animation =
                  'fade-in-up-smooth 0.6s ease-out 0.1s forwards'
                // Limpar will-change após animação para performance
                setTimeout(() => {
                  element.style.willChange = 'auto'
                }, 700)
              } else if (element.hasAttribute('data-fade-only')) {
                // Apenas opacidade, sem movimento
                requestAnimationFrame(() => {
                  setRevealTransition(element, 'opacity 0.8s ease-out')
                  requestAnimationFrame(() => {
                    element.style.opacity = '1'
                  })
                })
                setTimeout(() => {
                  element.style.willChange = 'auto'
                }, 800)
              }

              // Títulos de seção - legacy
              else if (element.classList.contains('section-title')) {
                element.style.animation =
                  'slide-in-up 0.8s ease-out 0.2s forwards'
              } else if (element.classList.contains('section-subtitle')) {
                element.style.animation =
                  'slide-in-up 0.6s ease-out 0.4s forwards'
              }

              // Cards de benefícios - EFEITO ESCADA SEQUENCIAL
              else if (element.classList.contains('benefit-card')) {
                const parent = element.parentElement
                if (parent) {
                  const allCards = Array.from(
                    parent.querySelectorAll('.benefit-card')
                  )
                  const index = allCards.indexOf(element)
                  const delay = 0.2 + index * 0.15
                  element.style.animation = `slide-in-up 0.7s ease-out ${delay}s forwards`
                }
              }

              // Cards de materiais - EFEITO ESCADA SEQUENCIAL
              else if (element.classList.contains('material-card')) {
                const parent = element.parentElement
                if (parent) {
                  const allCards = Array.from(
                    parent.querySelectorAll('.material-card')
                  )
                  const index = allCards.indexOf(element)
                  const delay = 0.3 + index * 0.15
                  element.style.animation = `slide-in-up 0.8s ease-out ${delay}s forwards`
                }
              }

              // Seção de contato
              else if (element.classList.contains('contact-form')) {
                element.style.animation =
                  'slide-in-left 1s ease-out 0.2s forwards'
              } else if (element.classList.contains('contact-info')) {
                const cards = element.querySelectorAll('.contact-card')
                cards.forEach((card, index) => {
                  const htmlCard = card as HTMLElement
                  htmlCard.style.opacity = '0'
                  htmlCard.style.transform = 'translateX(80px)'
                  htmlCard.style.animation = `slide-in-right 0.8s ease-out ${0.4 + index * 0.1}s forwards`
                })
                element.style.animation =
                  'slide-in-right 1s ease-out 0.2s forwards'
              }

              // CTA Section
              else if (element.classList.contains('cta-section')) {
                element.style.animation =
                  'fade-in-up-smooth 1.2s linear 0.3s forwards'
              }

              clearInlineTransition(element, 1800)
              observerInstance?.unobserve(element)
            }
          })
          rafId = null
        }

        observerInstance = new IntersectionObserver((entries) => {
          pendingEntries.push(...entries)
          if (rafId === null) {
            rafId = requestAnimationFrame(processEntries)
          }
        }, observerOptions)

        return observerInstance
      }

      // Lógica principal
      let observer: IntersectionObserver | null = null
      let mutation: MutationObserver | null = null
      let internalMutation: MutationObserver | null = null
      let periodicCheck: ReturnType<typeof setInterval> | null = null

      if (shouldExecuteAnimations) {
        /**
         * 🎬 MODO PRIMEIRA VISITA
         *
         * Executa animações completas para impressionar o usuário.
         * Configuração:
         * - Elementos inicializados como invisíveis IMEDIATAMENTE
         * - IntersectionObserver detecta viewport
         * - MutationObserver detecta novos elementos
         */

        // CORREÇÃO CRÍTICA: Inicializar elementos como invisíveis IMEDIATAMENTE
        // para evitar flash inicial
        resetInlineCleanupFlags()
        resetHeroInlineStyles()
        initializeElementsForAnimation()
        holdStillElements()

        // Disparar evento após animações terminarem (primeira visita)
        dispatchScrollRevealReady()

        // Aguardar a hidratação antes de configurar observers
        setTimeout(() => {
          requestAnimationFrame(() => {
            observer = setupObserver()
            mutation = new MutationObserver((records) => {
              records.forEach((record) => {
                record.addedNodes.forEach((node) => {
                  if (node.nodeType === 1) {
                    const el = node as HTMLElement
                    if (el.matches(selectors)) {
                      initializeElement(el)
                      observer?.observe(el)
                    }
                    el.querySelectorAll(selectors).forEach((child) => {
                      initializeElement(child as HTMLElement)
                      observer?.observe(child as HTMLElement)
                    })
                  }
                })
              })
            })
            mutation.observe(document.body, { childList: true, subtree: true })

            // Delay menor para mobile para animações mais rápidas
            const observerDelay = isOnMobile ? 50 : 100

            setTimeout(() => {
              const elementsToObserve = document.querySelectorAll(selectors)

              elementsToObserve.forEach((element) => {
                observer?.observe(element)
              })
            }, observerDelay)
          })
        }, 50) // Delay reduzido para melhor performance
      } else {
        /**
         * ⚡ MODO NAVEGAÇÃO INTERNA
         *
         * Mostra elementos imediatamente para fluidez.
         * Sistemas de backup:
         * - Delay maior para elementos dinâmicos (200ms)
         * - MutationObserver para novos elementos
         * - Verificação periódica para elementos perdidos
         */
        // Delay maior para aguardar elementos carregados dinamicamente
        setTimeout(() => {
          resetInlineCleanupFlags()
          resetHeroInlineStyles()
          showAllElementsImmediately()
          holdStillElements()
        }, 200)

        // Disparar evento imediatamente (navegação interna)
        dispatchScrollRevealReady()

        // Helper para verificar se é elemento hero
        const isHeroEl = (element: HTMLElement) =>
          element.classList.contains('hero-image') ||
          element.classList.contains('hero-image-inner') ||
          element.classList.contains('hero-badge-left') ||
          element.classList.contains('hero-badge-right') ||
          element.classList.contains('hero-border')

        // Função para processar novos elementos (batch)
        const processNewElements = (nodes: NodeList | Node[]) => {
          requestAnimationFrame(() => {
            nodes.forEach((node) => {
              if (node.nodeType === 1) {
                const el = node as HTMLElement

                if (el.matches(selectors)) {
                  // Mostrar elemento imediatamente
                  if (isStill(el)) {
                    holdStill(el)
                  } else if (el.classList.contains('hero-wave')) {
                    // Ondinha - garantir que apareça imediatamente
                    el.style.opacity = '1'
                    el.style.transform = 'translateY(0)'
                    el.style.animation = 'none'
                    setRevealTransition(el, 'none')
                    clearInlineTransition(el, 150)
                  } else if (isHeroEl(el)) {
                    // CORREÇÃO: Elementos hero - mostrar mas preservar transições
                    el.style.opacity = '1'
                    el.style.animation = 'none'
                    // NÃO aplicar transition: none nem mexer no transform.
                    clearInlineMotion(el, 150)
                  } else {
                    el.style.opacity = '1'
                    el.style.transform = 'translateY(0)'
                    el.style.animation = 'none'
                    setRevealTransition(el, 'none')
                    clearInlineTransition(el, 150)
                    clearInlineMotion(el, 150)
                  }
                }
                el.querySelectorAll(selectors).forEach((child) => {
                  const htmlChild = child as HTMLElement
                  if (isStill(htmlChild)) {
                    holdStill(htmlChild)
                  } else if (isHeroEl(htmlChild)) {
                    // CORREÇÃO: Elementos hero - mostrar mas preservar transições
                    htmlChild.style.opacity = '1'
                    htmlChild.style.animation = 'none'
                    clearInlineMotion(htmlChild, 150)
                  } else {
                    htmlChild.style.opacity = '1'
                    htmlChild.style.transform = 'translateY(0)'
                    htmlChild.style.animation = 'none'
                    setRevealTransition(htmlChild, 'none')
                    clearInlineTransition(htmlChild, 150)
                    clearInlineMotion(htmlChild, 150)
                  }
                })
              }
            })
          })
        }

        // Observer adicional para detectar novos elementos na navegação interna
        // Otimizado com requestAnimationFrame para reduzir TBT
        let pendingNodes: Node[] = []
        let rafScheduled = false

        const scheduleProcess = () => {
          if (rafScheduled) return
          rafScheduled = true
          requestAnimationFrame(() => {
            if (pendingNodes.length > 0) {
              processNewElements(pendingNodes)
              pendingNodes = []
            }
            rafScheduled = false
          })
        }

        internalMutation = new MutationObserver((records) => {
          // Coletar todos os nodes primeiro
          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              pendingNodes.push(node)
            })
          })
          // Agendar processamento no próximo frame
          scheduleProcess()
        })

        internalMutation.observe(document.body, {
          childList: true,
          subtree: true,
        })

        // Verificação periódica para elementos carregados dinamicamente
        // Otimizado: Intervalo aumentado e uso de requestAnimationFrame para reduzir TBT
        const processPeriodicCheck = () => {
          requestAnimationFrame(() => {
            const hiddenElements = document.querySelectorAll(
              `${selectors}[style*="opacity: 0"]`
            )

            // Processar em batches para evitar bloqueio longo
            const batchSize = 10
            let processed = 0

            const processBatch = () => {
              const end = Math.min(processed + batchSize, hiddenElements.length)

              for (let i = processed; i < end; i++) {
                const htmlElement = hiddenElements[i] as HTMLElement
                if (isStill(htmlElement)) {
                  holdStill(htmlElement)
                  continue
                }

                // CORREÇÃO: Verificar se elemento já foi processado para evitar loop
                if (htmlElement.dataset.inlineMotionCleared === 'true') {
                  // Elemento já foi processado, apenas garantir opacity: 1
                  htmlElement.style.opacity = '1'
                  continue
                }

                // CORREÇÃO: Para elementos hero, não aplicar transition: none
                // pois isso bloqueia o hover scale effect
                const isHeroElement =
                  htmlElement.classList.contains('hero-image') ||
                  htmlElement.classList.contains('hero-image-inner') ||
                  htmlElement.classList.contains('hero-badge-left') ||
                  htmlElement.classList.contains('hero-badge-right') ||
                  htmlElement.classList.contains('hero-border')

                htmlElement.style.opacity = '1'
                htmlElement.style.transform = 'translateY(0)'
                htmlElement.style.animation = 'none'

                // Só aplicar transition: none em elementos que não são hero
                if (!isHeroElement) {
                  setRevealTransition(htmlElement, 'none')
                  clearInlineTransition(htmlElement, 150)
                }
                clearInlineMotion(htmlElement, 150)
              }

              processed = end

              // Se ainda há elementos para processar, agendar próximo batch
              if (processed < hiddenElements.length) {
                requestAnimationFrame(processBatch)
              }
            }

            if (hiddenElements.length > 0) {
              processBatch()
            }
          })
        }

        // Intervalo aumentado de 500ms para 2000ms para reduzir TBT
        periodicCheck = setInterval(processPeriodicCheck, 2000)
      }

      // CORREÇÃO ESPECÍFICA: Garantir que a página sobre tenha scroll funcional mesmo com animações.
      // O overflow do documento na Sobre (recorte horizontal, rolagem vertical) fica no CSS: html:has(.sobre-page) e
      // body:has(.sobre-page) em styles/layout.web.css.
      if (isAboutPage) {
        document.body.style.position = 'relative'
        document.documentElement.style.position = 'relative'
        document.body.style.pointerEvents = 'auto'
        document.documentElement.style.pointerEvents = 'auto'
        document.body.style.touchAction = 'pan-y'
        document.documentElement.style.touchAction = 'pan-y'
      }

      /**
       * 🔄 SISTEMA DE ELEMENTOS DINÂMICOS
       *
       * Processa elementos carregados assincronamente (ex: FeaturedMaterials).
       * Funciona com componentes que usam ssr: false + API calls.
       *
       * Fluxo:
       * 1. Componente carrega e dispara evento 'featuredMaterialsLoaded'
       * 2. Sistema detecta evento e processa elementos
       * 3. Aplica comportamento baseado no tipo de navegação
       */
      const handleFeaturedMaterialsLoaded = () => {
        const featuredElements = document.querySelectorAll(
          '.section-title, .section-subtitle, .material-card'
        )

        if (shouldExecuteAnimations) {
          // Primeira visita: configurar para animação
          featuredElements.forEach((element) => {
            const htmlElement = element as HTMLElement
            if (isStill(htmlElement)) {
              holdStill(htmlElement)
            } else if (
              htmlElement.classList.contains('section-title') ||
              htmlElement.classList.contains('section-subtitle')
            ) {
              htmlElement.style.opacity = '0'
              htmlElement.style.transform = 'translateY(60px)'
              setRevealTransition(htmlElement, 'none')
              observer?.observe(htmlElement)
            }
          })
        } else {
          // Navegação interna: mostrar imediatamente
          featuredElements.forEach((element) => {
            const htmlElement = element as HTMLElement
            if (isStill(htmlElement)) {
              holdStill(htmlElement)
              return
            }
            htmlElement.style.opacity = '1'
            htmlElement.style.transform = 'translateY(0)'
            htmlElement.style.animation = 'none'
            setRevealTransition(htmlElement, 'none')
            clearInlineTransition(htmlElement, 150)
          })
        }
      }

      window.addEventListener(
        'featuredMaterialsLoaded',
        handleFeaturedMaterialsLoaded
      )

      // Cleanup function
      return () => {
        window.removeEventListener(
          'featuredMaterialsLoaded',
          handleFeaturedMaterialsLoaded
        )

        // Cleanup para primeira visita
        if (shouldExecuteAnimations) {
          observer?.disconnect()
          mutation?.disconnect()

          const allElements = document.querySelectorAll(selectors)
          allElements.forEach((element) => {
            const htmlElement = element as HTMLElement
            htmlElement.style.animation = 'none'
          })
        }
        // Cleanup para navegação interna
        else {
          internalMutation?.disconnect()
          if (periodicCheck) {
            clearInterval(periodicCheck)
          }
        }
      }
    }

    let hasStarted = false

    const start = () => {
      if (hasStarted) return
      hasStarted = true
      requestAnimationFrame(() => {
        cleanup = run()
      })
    }

    const schedule = () => {
      if ('requestIdleCallback' in window) {
        ;(
          window as Window & {
            requestIdleCallback: (
              _callback: () => void,
              _options?: { timeout: number }
            ) => void
          }
        ).requestIdleCallback(start, { timeout: 1500 })
      } else {
        setTimeout(start, 0)
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', schedule, { once: true })
    } else {
      schedule()
    }

    return () => {
      cleanup()
      document.removeEventListener('DOMContentLoaded', schedule)
    }
  }, [isHydrated, pathname])

  return null
}
