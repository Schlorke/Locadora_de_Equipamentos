/**
 * Sanitização HTML (native)
 *
 * React Native não tem DOM e não renderiza HTML: o conteúdo vai para <Text>.
 * Esta variante não limpa a marcação, ela a remove e devolve só o texto
 * visível. Elementos cujo conteúdo não é texto (script, style, …) saem
 * inteiros, comentários e tags saem, blocos e `<br>` viram quebras de linha
 * e as entidades são decodificadas uma única vez. `config` não se aplica,
 * porque nenhuma tag sobrevive. O resultado é texto puro: nunca o injete como
 * HTML (WebView, innerHTML).
 */

import type { SanitizeHtml, SanitizeHtmlStrict } from './sanitize-contract'

export { isSafeJsonLd, type SanitizeConfig } from './sanitize-contract'

/** Elementos cujo conteúdo não é texto visível. */
const HIDDEN_ELEMENTS =
  'script|style|template|noscript|iframe|object|embed|svg|math|head|title'
const HIDDEN_BLOCK = new RegExp(
  `<(${HIDDEN_ELEMENTS})\\b[\\s\\S]*?<\\/\\1\\s*>`,
  'gi'
)
/** Sem fechamento, o conteúdo vai até o fim do documento, como no navegador. */
const HIDDEN_UNCLOSED = new RegExp(
  `<(?:${HIDDEN_ELEMENTS})\\b[\\s\\S]*$`,
  'i'
)
const TAG_START = /[A-Za-z!/?]/
const TAG_NAME = /^<\/?([A-Za-z][A-Za-z0-9]*)/

/**
 * Marcas internas de quebra (uso privado do Unicode, removidas da entrada):
 * `<br>` força uma linha; blocos pedem uma quebra de linha ou de parágrafo.
 */
const BREAK = ''
const LINE = ''
const PARAGRAPH = ''
const MARKS = /[-]/g
const BREAK_RUN = /[ -]*[-][ -]*/g
const PARAGRAPH_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'dl',
  'table',
  'hr',
])
const LINE_TAGS = new Set([
  'div',
  'li',
  'tr',
  'dt',
  'dd',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'aside',
  'main',
  'figure',
  'figcaption',
  'address',
])
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function breakFor(tag: string): string {
  const name = TAG_NAME.exec(tag)?.[1]?.toLowerCase()
  if (!name) return ''
  if (name === 'br') return BREAK
  if (PARAGRAPH_TAGS.has(name)) return PARAGRAPH
  return LINE_TAGS.has(name) ? LINE : ''
}

/** Uma passada: remove comentários e tags (aspas só contam em valor de atributo). */
function stripTagsOnce(input: string): string {
  let text = ''
  let index = 0
  while (index < input.length) {
    const char = input[index]!
    if (char !== '<' || !TAG_START.test(input[index + 1] ?? '')) {
      text += char
      index += 1
      continue
    }
    if (input.startsWith('<!--', index)) {
      const end = input.indexOf('-->', index + 4)
      index = end === -1 ? input.length : end + 3
      continue
    }
    let end = index + 1
    let quote: string | null = null
    let afterEquals = false
    for (; end < input.length; end += 1) {
      const current = input[end]!
      if (quote) {
        if (current === quote) quote = null
      } else if (current === '>') break
      else if ((current === '"' || current === "'") && afterEquals) {
        quote = current
        continue
      }
      if (!quote && !/\s/.test(current)) afterEquals = current === '='
    }
    text += breakFor(input.slice(index, end + 1))
    index = end + 1
  }
  return text
}

/**
 * Repete até não sobrar nada a remover: a remoção não pode formar uma tag
 * nova (`<<b>script>` vira `<script>` depois da primeira passada). Cada passada
 * que muda o texto o encurta, então o laço termina.
 */
function stripMarkup(html: string): string {
  let current = html.replace(MARKS, '')
  for (;;) {
    const next = stripTagsOnce(
      current.replace(HIDDEN_BLOCK, '').replace(HIDDEN_UNCLOSED, '')
    )
    if (next === current) return next
    current = next
  }
}

/**
 * Espaços da fonte colapsam como no HTML (`<pre>` não é preservado); cada
 * sequência de marcas vira no máximo uma linha em branco.
 */
function layoutText(text: string): string {
  return text
    .replace(/[ \t\n\f\r]+/g, ' ')
    .replace(BREAK_RUN, (run) => {
      const breaks = run.split(BREAK).length - 1
      const block = run.includes(PARAGRAPH) ? 2 : run.includes(LINE) ? 1 : 0
      return '\n'.repeat(Math.min(2, Math.max(block, breaks)))
    })
    .replace(/^[ \n]+|[ \n]+$/g, '')
}

/** Decodificação única: `&amp;lt;` vira o texto `&lt;`, nunca `<`. */
function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|(amp|lt|gt|quot|apos|nbsp));/gi,
    (_match, decimal?: string, hex?: string, name?: string) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()]!
      const code = decimal ? Number(decimal) : Number.parseInt(hex!, 16)
      const valid =
        code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      return valid ? String.fromCodePoint(code) : '�'
    }
  )
}

/** Texto visível do HTML, para <Text>; nenhuma marcação sobrevive. */
export const sanitizeHtml: SanitizeHtml = (html) => {
  if (typeof html !== 'string') return ''
  return decodeEntities(layoutText(stripMarkup(html)))
}

/** No native o resultado já é texto puro; a variante estrita é a mesma. */
export const sanitizeHtmlStrict: SanitizeHtmlStrict = (html) =>
  sanitizeHtml(html)
