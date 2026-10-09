// @vitest-environment jsdom
// ScrollRevealInit: o instante do scrollRevealReady (sincronia crítica do carrossel 3D, docs/features/
// equipment-3d-carousel.md) e o que a revelação grava inline. Transição dos cartões e overflow da página Sobre são do
// CSS (styles/components.web.css e styles/layout.web.css): a revelação não grava inline que dispute com eles.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollRevealInit, {
  CSS_OWNED_TRANSITION,
  STILL_WHEN_REDUCED_MOTION,
} from './ScrollRevealInit.web'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('../../shared/lib/navigation/use-visible-pathname.web', () => ({
  useVisiblePathname: () => route.pathname,
}))

/** IntersectionObserver de teste: `intersect(el)` entrega o elemento como visível ao callback da revelação. */
type ObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver
) => void
const observers: Array<{ callback: ObserverCallback; targets: Set<Element> }> =
  []
class TestIntersectionObserver {
  private readonly entry: { callback: ObserverCallback; targets: Set<Element> }
  constructor(callback: ObserverCallback) {
    this.entry = { callback, targets: new Set() }
    observers.push(this.entry)
  }
  observe(el: Element) {
    this.entry.targets.add(el)
  }
  unobserve(el: Element) {
    this.entry.targets.delete(el)
  }
  disconnect() {
    this.entry.targets.clear()
  }
}
function intersect(el: Element) {
  for (const o of observers)
    if (o.targets.has(el))
      o.callback(
        [
          {
            target: el,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        o as unknown as IntersectionObserver
      )
}

const PAGE = `
  <section class="hero">
    <h1 class="hero-title">Título</h1>
    <div class="hero-image group"><div class="hero-image-inner transition-transform duration-500"></div></div>
  </section>
  <h2 class="section-title">Destaques</h2>
  <div class="grid">
    <div class="material-card transition-all duration-300">Material</div>
    <div class="benefit-card transition-all duration-500">Categoria</div>
  </div>
  <form class="contact-form transition-all duration-500"></form>
  <div class="contact-info"><div class="contact-card transition-all duration-500"></div></div>
`
const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!
const CARDS = [
  '.material-card',
  '.benefit-card',
  '.contact-form',
  '.contact-card',
  '.hero-image',
]

let readyAt: number[] = []
const onReady = () => readyAt.push(Date.now())

/** Monta o componente e avança até a revelação começar (setTimeout 0 + requestAnimationFrame); devolve o instante. */
async function start(): Promise<number> {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  render(<ScrollRevealInit />)
  for (
    let i = 0;
    i < 20 && !setItem.mock.calls.some(([key]) => key === 'hasVisitedSite');
    i++
  )
    await vi.advanceTimersByTimeAsync(1)
  const startedAt = Date.now()
  expect(setItem.mock.calls.some(([key]) => key === 'hasVisitedSite')).toBe(
    true
  )
  setItem.mockRestore()
  return startedAt
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'Date',
      'performance',
    ],
  })
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
  document.body.innerHTML = PAGE
  document.documentElement.removeAttribute('style')
  document.body.removeAttribute('style')
  sessionStorage.clear()
  readyAt = []
  window.addEventListener('scrollRevealReady', onReady)
})

afterEach(() => {
  window.removeEventListener('scrollRevealReady', onReady)
  cleanup()
  observers.length = 0
  vi.unstubAllGlobals()
  vi.useRealTimers()
  route.pathname = '/'
})

describe('ScrollRevealInit: instante do scrollRevealReady', () => {
  it('primeira visita: dispara 2700 ms depois do início da revelação, uma vez', async () => {
    const startedAt = await start()
    await vi.advanceTimersByTimeAsync(2699 - (Date.now() - startedAt))
    expect(readyAt).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(readyAt).toEqual([startedAt + 2700])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(readyAt).toHaveLength(1)
  })

  it('navegação interna: dispara 200 ms depois do início', async () => {
    sessionStorage.setItem('internalNavigation', 'true')
    const startedAt = await start()
    await vi.advanceTimersByTimeAsync(199 - (Date.now() - startedAt))
    expect(readyAt).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(readyAt).toEqual([startedAt + 200])
  })

  it('página Sobre: sempre como primeira visita (2700 ms), mesmo em navegação interna', async () => {
    route.pathname = '/sobre'
    sessionStorage.setItem('internalNavigation', 'true')
    const startedAt = await start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(readyAt).toEqual([startedAt + 2700])
  })
})

describe('ScrollRevealInit: selos do hero e da Sobre (onda 134)', () => {
  // Os selos voltaram com o conteúdo institucional da própria locadora (anos de mercado, frota e clientes do painel).
  // A revelação deles é a de 55763c1e: entram da esquerda (1,8 s) e da direita (2,0 s) e terminam antes do
  // scrollRevealReady, que continua em 2700 ms com ou sem selos (docs/features/equipment-3d-carousel.md).
  const SELOS = `
    <div class="hero-image group">
      <div class="hero-image-inner"></div>
      <div class="hero-badge-left" style="opacity: 0"></div>
      <div class="hero-badge-right" style="opacity: 0"></div>
      <div class="hero-border" style="opacity: 0"></div>
    </div>`

  it('primeira visita: cada selo anima no seu tempo, fica visível no fim e o evento continua em 2700 ms', async () => {
    document.body.insertAdjacentHTML('beforeend', SELOS)
    const left = document.querySelectorAll<HTMLElement>('.hero-badge-left')[0]!
    const right =
      document.querySelectorAll<HTMLElement>('.hero-badge-right')[0]!
    const startedAt = await start()
    await vi.advanceTimersByTimeAsync(200)
    intersect(left)
    intersect(right)
    await vi.advanceTimersByTimeAsync(20)
    expect(left.style.animation).toBe(
      'slide-in-left 0.6s ease-out 1.8s forwards'
    )
    expect(right.style.animation).toBe(
      'slide-in-right 0.6s ease-out 2.0s forwards'
    )
    await vi.advanceTimersByTimeAsync(3000)
    expect(readyAt).toEqual([startedAt + 2700])
    // Fim da animação: o inline sai e a opacidade fica 1 (o JSX grava opacity: 0).
    for (const selo of [left, right]) {
      expect(selo.style.animation).toBe('')
      expect(selo.style.opacity).toBe('1')
    }
  })

  it('navegação interna: os selos aparecem de uma vez, sem animação', async () => {
    sessionStorage.setItem('internalNavigation', 'true')
    document.body.insertAdjacentHTML('beforeend', SELOS)
    await start()
    await vi.advanceTimersByTimeAsync(200)
    for (const selo of document.querySelectorAll<HTMLElement>(
      '.hero-badge-left, .hero-badge-right'
    )) {
      expect(selo.style.opacity).toBe('1')
      expect(selo.style.animation).toBe('none')
    }
  })
})

describe('ScrollRevealInit: transição dos cartões fica com o CSS', () => {
  it('primeira visita: esconde e anima os cartões sem gravar transition inline; os demais recebem transition none', async () => {
    await start()
    for (const selector of CARDS.filter(
      (s) => s !== '.contact-card' && s !== '.hero-image'
    )) {
      // A revelação continua agindo no cartão (escondido e deslocado)...
      expect($(selector).style.opacity, selector).toBe('0')
      expect($(selector).style.transform, selector).toBe('translateY(60px)')
    }
    // ...mas a transição é a do CSS: nenhum cartão recebe transition inline.
    for (const selector of CARDS)
      expect($(selector).style.transition, selector).toBe('')
    // Elementos cuja transição não é do CSS continuam com transition: none enquanto esperam.
    expect($('.section-title').style.transition).toBe('none')
    expect($('.hero-image-inner').style.transition).toBe('none')

    await vi.advanceTimersByTimeAsync(200)
    for (const selector of [
      '.material-card',
      '.benefit-card',
      '.contact-form',
      '.contact-info',
      '.hero-image-inner',
    ])
      intersect($(selector))
    await vi.advanceTimersByTimeAsync(20)
    expect($('.material-card').style.animation).toContain('slide-in-up')
    expect($('.contact-form').style.animation).toContain('slide-in-left')
    expect($('.contact-card').style.animation).toContain('slide-in-right')
    for (const selector of CARDS)
      expect($(selector).style.transition, selector).toBe('')
    await vi.advanceTimersByTimeAsync(2000)
    for (const selector of CARDS)
      expect($(selector).style.transition, selector).toBe('')
  })

  it('navegação interna: mostra os cartões de uma vez sem transition inline, inclusive os que chegam depois', async () => {
    sessionStorage.setItem('internalNavigation', 'true')
    await start()
    await vi.advanceTimersByTimeAsync(200)
    expect($('.material-card').style.opacity).toBe('1')
    expect($('.material-card').style.animation).toBe('none')
    expect($('.section-title').style.transition).toBe('none')
    for (const selector of CARDS)
      expect($(selector).style.transition, selector).toBe('')

    // Cartão carregado depois (MutationObserver) e cartão escondido achado pela verificação periódica.
    const late = document.createElement('div')
    late.className = 'benefit-card'
    const lateTitle = document.createElement('h2')
    lateTitle.className = 'section-title'
    document.body.append(late, lateTitle)
    const hidden = document.createElement('div')
    hidden.className = 'material-card'
    hidden.dataset.hidden = '1'
    await vi.advanceTimersByTimeAsync(50)
    expect(late.style.opacity).toBe('1')
    expect(late.style.transition).toBe('')
    expect(lateTitle.style.transition).toBe('none')
    document.body.append(hidden)
    await vi.advanceTimersByTimeAsync(50)
    hidden.style.opacity = '0'
    await vi.advanceTimersByTimeAsync(2100)
    expect(hidden.style.opacity).toBe('1')
    expect(hidden.style.transition).toBe('')
  })

  it('cada elemento de CSS_OWNED_TRANSITION tem a transição na camada components de styles/components.web.css', () => {
    const css = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        'styles',
        'components.web.css'
      ),
      'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const forced: string[] = []
    for (
      let at = css.indexOf('@layer components');
      at !== -1;
      at = css.indexOf('@layer components', at + 1)
    ) {
      let depth = 0
      let end = css.indexOf('{', at)
      do {
        if (css[end] === '{') depth++
        else if (css[end] === '}') depth--
        end++
      } while (depth > 0 && end < css.length)
      forced.push(css.slice(at, end))
    }
    const rules = forced.flatMap((block) =>
      Array.from(block.matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => ({
        selectors: m[1]!.split(',').map((s) => s.trim()),
        body: m[2]!,
      }))
    )
    for (const selector of CSS_OWNED_TRANSITION.split(',').map((s) =>
      s.trim()
    )) {
      expect(
        rules.some(
          (r) =>
            r.selectors.includes(selector) &&
            /(^|;|\s)transition\s*:/.test(r.body)
        ),
        selector
      ).toBe(true)
    }
  })
})

describe('ScrollRevealInit: movimento reduzido', () => {
  /** Elementos parados com o estilo inline que o JSX grava (escondidos e deslocados, como no Hero e nas seções). */
  const STILL = [
    '.hero-title',
    '.section-title',
    '.material-card',
    '.benefit-card',
    '.contact-form',
    '.contact-info',
    '.contact-card',
    '.hero-image',
  ]
  const atRest = (selector: string) => {
    const el = $(selector)
    return {
      selector,
      opacity: el.style.opacity,
      transform: el.style.transform,
      animation: el.style.animation,
    }
  }
  const rest = (selector: string) => ({
    selector,
    opacity: '1',
    transform: 'none',
    animation: 'none',
  })

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
    }))
    for (const selector of STILL.filter((s) => s !== '.hero-image')) {
      $(selector).style.opacity = '0'
      $(selector).style.transform = 'translateY(60px)'
    }
  })

  it('STILL_WHEN_REDUCED_MOTION cobre os mesmos elementos que o CSS forçava parados', () => {
    const selectors = STILL_WHEN_REDUCED_MOTION.split(',').map((s) => s.trim())
    expect(selectors).toEqual([
      '.material-card',
      '.benefit-card',
      '.contact-form',
      '.contact-info',
      '.contact-card',
      '.cta-section',
      '.section-title',
      '.section-subtitle',
      '.hero-title',
      '.hero-subtitle',
      '.hero-search',
      '.hero-buttons',
      '.hero-contact',
      '.hero-image',
    ])
  })

  it('primeira visita: os elementos parados ficam em repouso antes e depois da interseção; os demais seguem animando', async () => {
    const startedAt = await start()
    expect(STILL.map(atRest)).toEqual(STILL.map(rest))
    // hero-image-inner não é parado: continua escondido à espera da revelação.
    expect($('.hero-image-inner').style.opacity).toBe('0')

    await vi.advanceTimersByTimeAsync(200)
    for (const selector of [
      '.hero-title',
      '.section-title',
      '.material-card',
      '.benefit-card',
      '.contact-form',
      '.contact-info',
      '.hero-image-inner',
    ])
      intersect($(selector))
    await vi.advanceTimersByTimeAsync(20)
    expect(STILL.map(atRest)).toEqual(STILL.map(rest))
    expect($('.hero-image-inner').style.animation).toContain('slide-in-right')

    // A sincronia do carrossel 3D não muda: scrollRevealReady 2700 ms depois do início.
    await vi.advanceTimersByTimeAsync(3000)
    expect(readyAt).toEqual([startedAt + 2700])
    expect(STILL.map(atRest)).toEqual(STILL.map(rest))
  })

  it('navegação interna: repouso também nos que chegam depois e nos achados pela verificação periódica', async () => {
    sessionStorage.setItem('internalNavigation', 'true')
    await start()
    await vi.advanceTimersByTimeAsync(200)
    expect(STILL.map(atRest)).toEqual(STILL.map(rest))

    const late = document.createElement('div')
    late.className = 'benefit-card'
    late.style.opacity = '0'
    late.style.transform = 'translateY(60px)'
    document.body.append(late)
    await vi.advanceTimersByTimeAsync(50)
    expect([
      late.style.opacity,
      late.style.transform,
      late.style.animation,
    ]).toEqual(['1', 'none', 'none'])

    $('.material-card').style.opacity = '0'
    $('.material-card').style.transform = 'translateY(60px)'
    await vi.advanceTimersByTimeAsync(2100)
    expect(atRest('.material-card')).toEqual(rest('.material-card'))
  })

  it('sem a preferência, os mesmos elementos continuam escondidos e animados pela revelação', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
    }))
    await start()
    expect($('.hero-title').style.opacity).toBe('0')
    expect($('.material-card').style.transform).toBe('translateY(60px)')
  })
})

describe('ScrollRevealInit: página Sobre', () => {
  it('não grava overflow inline no html nem no body (o recorte é do CSS); o resto da correção continua', async () => {
    route.pathname = '/sobre'
    await start()
    for (const el of [document.documentElement, document.body]) {
      expect(el.style.overflow).toBe('')
      expect(el.style.overflowX).toBe('')
      expect(el.style.overflowY).toBe('')
      expect(el.style.position).toBe('relative')
      expect(el.style.pointerEvents).toBe('auto')
      expect(el.style.touchAction).toBe('pan-y')
    }
  })
})
