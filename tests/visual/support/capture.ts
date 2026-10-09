/**
 * Captura de estilo computado da linha de base visual. `captureInPage` roda dentro da página (serializada pelo
 * Playwright, por isso autossuficiente); o resto roda no Node e prepara a página para ser determinística.
 */
import type { BrowserContext, Page } from 'playwright/test'

/** Elemento capturado: chave estável (caminho DOM), rótulo legível (papel/nome/texto) e estilo relevante. */
export type CapturedElement = [
  key: string,
  label: string,
  style: Record<string, string>,
]

/** Uma captura: página inteira, recorte de receita do /catalog ou diferença de um estado sobre a base. */
export type Capture =
  | { kind: 'full' | 'scoped'; elements: CapturedElement[] }
  | { kind: 'delta'; of: string; changed: CapturedElement[]; removed: string[] }

/** Conteúdo de um arquivo da linha de base (tools/visual-baseline/format.mjs grava e lê). */
export interface CaptureFile {
  version: 1
  scenario: string
  viewport: string
  url: string
  captures: Record<string, Capture>
  /** Chamadas de API sem fixture (respondidas com 404 determinístico). */
  unmappedApis: string[]
  /** Esperas em que a página não parou dentro do limite (0 esperado). */
  unstableWaits: number
}

export interface CaptureScope {
  /**
   * `document`: todos os elementos visíveis de <body>. `recipe`: só a receita do /catalog cujo título de estado é
   * `marker` (o elemento seguinte a ele), mais o que abre fora dela (portais, toasts, overlays).
   */
  kind: 'document' | 'recipe'
  marker?: string
}

/** Roda na página: percorre os elementos visíveis e devolve estilo computado com valores iniciais omitidos. */
export function captureInPage(scope: CaptureScope): CapturedElement[] {
  const PROPERTIES = [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'overflow-x',
    'overflow-y',
    'visibility',
    'opacity',
    'transform',
    'translate',
    'scale',
    'rotate',
    'color',
    'background-color',
    'background-image',
    'box-shadow',
    'text-shadow',
    'filter',
    'backdrop-filter',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
    'outline-style',
    'outline-width',
    'outline-color',
    'outline-offset',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'row-gap',
    'column-gap',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'letter-spacing',
    'text-transform',
    'text-decoration-line',
    'text-align',
    'cursor',
    'accent-color',
    'scrollbar-color',
    'scrollbar-width',
    'fill',
    'stroke',
  ]
  // Herdadas: gravadas só quando diferem do pai (a mudança aparece uma vez, onde nasce).
  const INHERITED = new Set([
    'color',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'letter-spacing',
    'text-transform',
    'text-align',
    'cursor',
    'visibility',
    'accent-color',
    'scrollbar-color',
    'fill',
    'stroke',
  ])
  // Valores iniciais: omitidos para manter a linha de base legível e pequena.
  const INITIAL: Record<string, string[]> = {
    position: ['static'],
    'z-index': ['auto'],
    'overflow-x': ['visible'],
    'overflow-y': ['visible'],
    opacity: ['1'],
    transform: ['none'],
    translate: ['none'],
    scale: ['none'],
    rotate: ['none'],
    'background-color': ['rgba(0, 0, 0, 0)'],
    'background-image': ['none'],
    'box-shadow': ['none'],
    'text-shadow': ['none'],
    filter: ['none'],
    'backdrop-filter': ['none'],
    'border-top-width': ['0px'],
    'border-right-width': ['0px'],
    'border-bottom-width': ['0px'],
    'border-left-width': ['0px'],
    'border-top-style': ['none'],
    'border-right-style': ['none'],
    'border-bottom-style': ['none'],
    'border-left-style': ['none'],
    'border-top-left-radius': ['0px'],
    'border-top-right-radius': ['0px'],
    'border-bottom-right-radius': ['0px'],
    'border-bottom-left-radius': ['0px'],
    'outline-style': ['none'],
    'outline-offset': ['0px'],
    'padding-top': ['0px'],
    'padding-right': ['0px'],
    'padding-bottom': ['0px'],
    'padding-left': ['0px'],
    'margin-top': ['0px'],
    'margin-right': ['0px'],
    'margin-bottom': ['0px'],
    'margin-left': ['0px'],
    'row-gap': ['normal'],
    'column-gap': ['normal'],
    'text-decoration-line': ['none'],
    'scrollbar-width': ['auto'],
  }
  const SIDES = ['top', 'right', 'bottom', 'left']
  const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'LINK',
    'META',
    'NOSCRIPT',
    'TEMPLATE',
    'TITLE',
    'HEAD',
    'BR',
    'WBR',
    'NEXTJS-PORTAL',
    'NEXT-ROUTE-ANNOUNCER',
  ])

  const keyOf = (element: Element): string => {
    const segments: string[] = []
    for (
      let node: Element | null = element;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      const tag = node.tagName.toLowerCase()
      const testId = node.getAttribute('data-testid')
      let index = 1
      for (
        let sibling = node.previousElementSibling;
        sibling;
        sibling = sibling.previousElementSibling
      )
        if (sibling.tagName === node.tagName) index += 1
      segments.unshift(
        testId ? `${tag}[data-testid="${testId}"]` : `${tag}:${index}`
      )
    }
    return segments.join('>')
  }
  const labelOf = (element: Element): string => {
    const role = element.getAttribute('role') ?? ''
    const name =
      element.getAttribute('aria-label') ??
      element.getAttribute('title') ??
      element.getAttribute('alt') ??
      element.getAttribute('placeholder') ??
      ''
    let text = ''
    for (const child of Array.from(element.childNodes))
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? ''
    text = text.replace(/\s+/g, ' ').trim()
    return [
      role && `[${role}]`,
      name && `"${name.slice(0, 40)}"`,
      text && text.slice(0, 40),
    ]
      .filter(Boolean)
      .join(' ')
  }
  // Deslocamentos, margens e paddings pelo valor computado (Typed OM: `auto`, `5%`, `16px`), não pelo valor
  // usado que getComputedStyle devolve e que depende do layout medido naquele instante.
  const COMPUTED_ONLY = /^(?:top|right|bottom|left|margin-.+|padding-.+)$/
  const styleOf = (
    computed: CSSStyleDeclaration,
    parent: CSSStyleDeclaration | null,
    only?: string[],
    inline?: CSSStyleDeclaration,
    typed?: StylePropertyMapReadOnly
  ): Record<string, string> => {
    const style: Record<string, string> = {}
    for (const property of only ?? PROPERTIES) {
      const value =
        typed && COMPUTED_ONLY.test(property)
          ? (typed.get(property)?.toString() ?? '')
          : computed.getPropertyValue(property).trim()
      if (
        INHERITED.has(property)
          ? parent !== null &&
            parent.getPropertyValue(property).trim() === value
          : INITIAL[property]?.includes(value)
      )
        continue
      // Deslocamentos só de elementos posicionados, e nunca os que o JavaScript grava no style do elemento
      // (posição de legenda/tooltip de gráfico e de popovers, medida em tempo real): não são decisão de CSS.
      if (
        ['top', 'right', 'bottom', 'left'].includes(property) &&
        (computed.getPropertyValue('position') === 'static' ||
          (inline?.getPropertyValue(property) ?? '') !== '')
      )
        continue
      // Estilo e cor de uma borda de largura 0 não aparecem (o preflight do Tailwind põe `solid` em tudo).
      const side = SIDES.find(
        (s) =>
          property === `border-${s}-color` || property === `border-${s}-style`
      )
      if (
        side &&
        (computed.getPropertyValue(`border-${side}-width`) === '0px' ||
          computed.getPropertyValue(`border-${side}-style`) === 'none')
      )
        continue
      if (
        (property === 'outline-color' || property === 'outline-width') &&
        computed.getPropertyValue('outline-style') === 'none'
      )
        continue
      // Matrizes de transform com 3 casas: a fase de animações por requestAnimationFrame varia na 5ª casa. url() sem a
      // origem (esquema, host e porta): a captura não depende da porta do servidor (VISUAL_WEB_PORT).
      style[property] =
        property === 'transform' ||
        property === 'translate' ||
        property === 'scale' ||
        property === 'rotate'
          ? value.replace(/-?\d+\.\d+(?:e-?\d+)?/g, (n) =>
              String(Number(Number(n).toFixed(3)))
            )
          : value.replace(/url\("https?:\/\/[^/"]+/g, 'url("')
    }
    return style
  }

  const roots: Element[] = []
  if (scope.kind === 'recipe') {
    const marker = Array.from(document.querySelectorAll('p, span, div')).find(
      (element) =>
        element.childElementCount === 0 && element.textContent === scope.marker
    )
    const recipe = marker?.nextElementSibling
    if (!recipe) throw new Error(`receita não encontrada: ${scope.marker}`)
    roots.push(recipe)
    const main = Array.from(document.body.children).find((child) =>
      child.contains(recipe)
    )
    for (const child of Array.from(document.body.children))
      if (child !== main) roots.push(child)
    // Toasts e overlays que abrem fora da receita, mesmo dentro da árvore principal.
    for (const overlay of Array.from(
      document.querySelectorAll(
        '[data-sonner-toaster], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper]'
      )
    )) {
      if (!roots.some((root) => root.contains(overlay))) roots.push(overlay)
    }
  } else {
    roots.push(document.body)
  }

  const result: CapturedElement[] = []
  const seen = new Set<Element>()
  const visit = (element: Element) => {
    if (seen.has(element) || SKIP_TAGS.has(element.tagName)) return
    seen.add(element)
    const computed = getComputedStyle(element)
    // Visível: tem caixa, não está com visibility:hidden (os filhos ainda podem estar visíveis) e não fica
    // inteiro antes do início do documento (ex.: o span de medição de texto do recharts em top:-20000px).
    const box = element.getBoundingClientRect()
    const visible =
      element.getClientRects().length > 0 &&
      computed.visibility !== 'hidden' &&
      box.bottom + window.scrollY >= 0 &&
      box.right + window.scrollX >= 0
    if (visible) {
      const parent = element.parentElement
        ? getComputedStyle(element.parentElement)
        : null
      const key = keyOf(element)
      result.push([
        key,
        labelOf(element),
        styleOf(
          computed,
          parent,
          undefined,
          (element as HTMLElement).style,
          element.computedStyleMap()
        ),
      ])
      for (const pseudo of ['::before', '::after']) {
        const pseudoStyle = getComputedStyle(element, pseudo)
        const content = pseudoStyle.getPropertyValue('content')
        if (content && content !== 'none' && content !== 'normal')
          result.push([
            key + pseudo,
            content.slice(0, 40),
            { content, ...styleOf(pseudoStyle, computed) },
          ])
      }
      if (
        (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') &&
        element.getAttribute('placeholder')
      ) {
        result.push([
          key + '::placeholder',
          '',
          styleOf(getComputedStyle(element, '::placeholder'), null, [
            'color',
            'opacity',
            'font-size',
            'font-weight',
          ]),
        ])
      }
    }
    // O conteúdo interno de <svg> (paths dos ícones) herda do próprio svg.
    if (element.tagName.toLowerCase() === 'svg') return
    for (const child of Array.from(element.children)) visit(child)
  }
  for (const root of roots) visit(root)
  return result
}

/** Deixa a página determinística: aleatoriedade com semente e armazenamento local preparado. */
export async function installDeterminism(
  context: BrowserContext,
  localStorageSeed: Record<string, string> = {}
) {
  await context.addInitScript((seed: Record<string, string>) => {
    let state = 0x9e3779b9
    Math.random = () => {
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    try {
      for (const [key, value] of Object.entries(seed))
        window.localStorage.setItem(key, value)
    } catch {
      /* armazenamento indisponível: a página segue sem a semente */
    }
    // Contador de mutações do DOM: o relógio só avança quando a página parou de mudar em tempo real.
    const counter = window as unknown as { __visualMutations: number }
    counter.__visualMutations = 0
    new MutationObserver((records) => {
      counter.__visualMutations += records.length
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
  }, localStorageSeed)
}

/**
 * Encerra animações CSS/WAAPI: as finitas vão ao estado final; as infinitas param no início. O relógio falso
 * (page.clock) já governa timers e requestAnimationFrame; isto cobre o que roda no compositor.
 */
export async function freezeAnimations(page: Page): Promise<number> {
  return page.evaluate(() => {
    let touched = 0
    for (const animation of document.getAnimations()) {
      if (animation.playState !== 'running') continue
      touched += 1
      const timing = animation.effect?.getComputedTiming()
      if (timing && timing.endTime === Infinity) {
        animation.pause()
        animation.currentTime = 0
      } else {
        try {
          animation.finish()
        } catch {
          animation.cancel()
        }
      }
    }
    return touched
  })
}

/** Mutações do DOM desde a carga (contador do init script de installDeterminism). */
export const mutationCount = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __visualMutations?: number }).__visualMutations ??
      0
  )
