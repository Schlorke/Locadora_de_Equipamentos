// Paridade Tailwind 3 × 4 sem navegador: resolve, a partir do CSS compilado, o estilo que cada utilitário do produto dá
// a um elemento (e aos filhos, para space-*/divide-*) e a condição de cada cadeia de variantes, na forma canônica que
// torna comparáveis a saída do Tailwind 4 do web e a do Tailwind 3.4.17 da produção (main eb4c0098).
//
// Um motor de cascata pequeno: achata o CSS (aninhamento e @layer do Tailwind 4), avalia @media/@supports para uma
// largura e um tamanho de fonte do navegador (rem/em das media queries), casa seletores numa árvore fixa (html > body >
// section.group.peer > elemento > 3 filhos p) num estado (repouso, foco por teclado, foco por mouse), aplica a
// cascata (origem do navegador, camada, especificidade, ordem; revert e revert-layer; lógicas viram físicas), resolve
// var() (com @property, herança e fallback com palavra-chave global) e normaliza valores (cores em sRGB, calc, rem em
// px, sombras sem camadas nulas, degradê sem paradas padrão, transform sem funções identidade). Da folha do navegador
// (Chromium) só entra o anel de foco do :focus-visible, o único estilo dela que uma classe de contorno deixa aparecer.
// Usado por tests/visual/tailwind-parity.test.ts e pelo gerador da fixture da produção.

// ---------------------------------------------------------------------------------------------------------------
// CSS achatado

/** Junta o seletor aninhado ao do pai (& = pai; sem &, descendente). */
function nest(parents, selector) {
  if (!parents) return [selector]
  return parents.map((p) =>
    selector.includes('&') ? selector.replace(/&/g, p) : `${p} ${selector}`
  )
}

/**
 * Regras planas { sels, conds, layer, order, decls } na ordem do CSS. Declarações depois de uma regra aninhada viram
 * outra regra com o mesmo seletor (semântica atual do aninhamento). Guarda @property e a ordem das camadas.
 */
export function flattenCss(root) {
  const rules = []
  const properties = new Map()
  const layers = []
  let order = 0
  const noteLayer = (name) => {
    if (name && !layers.includes(name)) layers.push(name)
  }
  const walk = (container, sels, conds, layer) => {
    let pending = []
    const flush = () => {
      if (pending.length && sels)
        rules.push({ sels, conds, layer, order: order++, decls: pending })
      pending = []
    }
    for (const node of container.nodes ?? []) {
      if (node.type === 'decl') {
        pending.push({
          prop: node.prop.startsWith('--')
            ? node.prop
            : node.prop.toLowerCase(),
          value: node.value,
          important: !!node.important,
        })
      } else if (node.type === 'rule') {
        flush()
        walk(
          node,
          node.selectors.flatMap((s) => nest(sels, s.trim())),
          conds,
          layer
        )
      } else if (node.type === 'atrule') {
        // `@media(max-width:1170px)` sem espaço (variante arbitrária do Tailwind 3): o postcss lê tudo como nome.
        const glued = /^(media|supports)(\(.*)$/i.exec(node.name)
        const name = (glued ? glued[1] : node.name).toLowerCase()
        if (glued) node.params = `${glued[2]} ${node.params}`.trim()
        if (name === 'layer') {
          if (!node.nodes) {
            for (const l of node.params.split(',')) noteLayer(l.trim())
            continue
          }
          flush()
          const l = layer
            ? `${layer}.${node.params.trim()}`
            : node.params.trim()
          noteLayer(l)
          walk(node, sels, conds, l)
        } else if (name === 'property') {
          const info = { inherits: true, initial: undefined }
          for (const d of node.nodes ?? []) {
            if (d.type !== 'decl') continue
            if (d.prop === 'inherits') info.inherits = d.value.trim() === 'true'
            if (d.prop === 'initial-value') info.initial = d.value.trim()
          }
          properties.set(node.params.trim(), info)
        } else if (name === 'media' || name === 'supports') {
          flush()
          walk(node, sels, [...conds, { name, params: node.params }], layer)
        } else flush()
      }
    }
    flush()
  }
  walk(root, null, [], null)
  return { rules, properties, layers }
}

// ---------------------------------------------------------------------------------------------------------------
// Condições (@media, @supports)

// Nas media queries, rem e em valem a fonte padrão do navegador (16px, ou a que a pessoa escolheu: env.remPx).
const toPx = (value, remPx = 16) => {
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(value.trim())
  if (!m) return NaN
  return Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? remPx : 1)
}
function mediaFeature(feature, env) {
  const f = feature
    .trim()
    .replace(/^\(|\)$/g, '')
    .trim()
  const px = (v) => toPx(v, env.remPx)
  let m = /^(min|max)-width\s*:\s*(.+)$/.exec(f)
  if (m) return m[1] === 'min' ? env.width >= px(m[2]) : env.width <= px(m[2])
  m = /^width\s*(>=|<=|>|<)\s*(.+)$/.exec(f)
  if (m) {
    const v = px(m[2])
    return {
      '>=': env.width >= v,
      '<=': env.width <= v,
      '>': env.width > v,
      '<': env.width < v,
    }[m[1]]
  }
  m = /^(.+?)\s*(>=|<=|>|<)\s*width$/.exec(f)
  if (m) {
    const v = px(m[1])
    return {
      '>=': v >= env.width,
      '<=': v <= env.width,
      '>': v > env.width,
      '<': v < env.width,
    }[m[2]]
  }
  m = /^([\w-]+)\s*:\s*([\w-]+)$/.exec(f)
  if (m) {
    const [, name, value] = m
    if (name === 'hover') return value === 'hover'
    if (name === 'any-hover') return value === 'hover'
    if (name === 'pointer' || name === 'any-pointer') return value === 'fine'
    if (name === 'prefers-reduced-motion') return value === 'no-preference'
    if (name === 'prefers-color-scheme') return value === 'light'
    if (name === 'forced-colors')
      return value === (env.forcedColors ? 'active' : 'none')
    if (name === 'orientation')
      return value === (env.width > 900 ? 'landscape' : 'portrait')
    return false
  }
  return false
}
function mediaQuery(query, env) {
  let q = query.trim().toLowerCase()
  let negate = false
  if (q.startsWith('not ')) {
    negate = true
    q = q.slice(4).trim()
  }
  const parts = q.split(/\s+and\s+/)
  let ok = true
  for (const part of parts) {
    const p = part.trim()
    if (p === 'all' || p === 'screen' || p === 'only screen') continue
    if (p === 'print' || p === 'speech') ok = false
    else if (p.startsWith('(')) ok = ok && mediaFeature(p, env)
    else ok = false
  }
  return negate ? !ok : ok
}
export function conditionHolds(cond, env) {
  if (cond.name === 'media')
    return splitTop(cond.params, ',').some((q) => mediaQuery(q, env))
  // @supports: só a regra de reserva do Tailwind 4 para navegadores sem @property é falsa no Chromium atual.
  if (cond.name === 'supports')
    return !/-webkit-hyphens|-moz-orient/.test(cond.params)
  return false
}

// ---------------------------------------------------------------------------------------------------------------
// Seletores

/** Divide no nível superior (fora de () [] e aspas) pelo separador de um caractere. */
export function splitTop(text, sep) {
  const out = []
  let depth = 0
  let quote = null
  let cur = ''
  for (const ch of text) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export const unescapeCss = (s) =>
  s
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/\\(.)/g, '$1')

const parsedSelectors = new Map()
/** Lê um seletor complexo: [{ combinator, compound }], da esquerda para a direita (em cache). */
export function parseComplex(selector) {
  let parsed = parsedSelectors.get(selector)
  if (!parsed)
    parsedSelectors.set(selector, (parsed = parseComplexUncached(selector)))
  return parsed
}
function parseComplexUncached(selector) {
  const parts = []
  let comb = null
  let cur = ''
  let depth = 0
  let quote = null
  const push = () => {
    if (cur.trim()) {
      parts.push({ combinator: comb, compound: parseCompound(cur.trim()) })
      comb = null
    }
    cur = ''
  }
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i]
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '\\') {
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(selector.slice(i + 1))
      const take = hex ? hex[0].length : 1
      cur += ch + selector.slice(i + 1, i + 1 + take)
      i += take
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth -= 1
    if (depth === 0 && (ch === '>' || ch === '+' || ch === '~')) {
      push()
      comb = ch
      continue
    }
    if (depth === 0 && /\s/.test(ch)) {
      push()
      if (comb === null && parts.length) comb = ' '
      continue
    }
    cur += ch
  }
  push()
  return parts
}

function parseCompound(text) {
  const c = {
    tag: null,
    classes: [],
    ids: [],
    attrs: [],
    pseudos: [],
    pseudoElement: null,
  }
  let i = 0
  const readIdent = () => {
    let out = ''
    while (i < text.length) {
      const ch = text[i]
      if (ch === '\\') {
        const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(text.slice(i + 1))
        const take = hex ? hex[0].length : 1
        out += ch + text.slice(i + 1, i + 1 + take)
        i += 1 + take
        continue
      }
      if (/[\w-]/.test(ch) || ch.charCodeAt(0) > 127) {
        out += ch
        i += 1
      } else break
    }
    return unescapeCss(out)
  }
  const readParens = () => {
    let depth = 0
    let out = ''
    for (; i < text.length; i += 1) {
      const ch = text[i]
      if (ch === '(') {
        depth += 1
        if (depth === 1) continue
      }
      if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          i += 1
          break
        }
      }
      out += ch
    }
    return out
  }
  while (i < text.length) {
    const ch = text[i]
    if (ch === '*') {
      c.tag = '*'
      i += 1
    } else if (ch === '.') {
      i += 1
      c.classes.push(readIdent())
    } else if (ch === '#') {
      i += 1
      c.ids.push(readIdent())
    } else if (ch === '[') {
      let depth = 0
      let out = ''
      for (; i < text.length; i += 1) {
        const x = text[i]
        if (x === '[') depth += 1
        if (x === ']') depth -= 1
        out += x
        if (depth === 0) {
          i += 1
          break
        }
      }
      const m =
        /^\[\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*))\s*(i)?)?\s*\]$/.exec(
          out
        )
      c.attrs.push(
        m
          ? {
              name: m[1],
              op: m[2] ?? null,
              value: m[3] ?? m[4] ?? m[5] ?? null,
            }
          : { name: out, op: '?', value: null }
      )
    } else if (ch === ':') {
      if (text[i + 1] === ':') {
        i += 2
        c.pseudoElement = readIdent().toLowerCase()
        if (text[i] === '(') readParens()
      } else {
        i += 1
        const name = readIdent().toLowerCase()
        const arg = text[i] === '(' ? readParens() : null
        c.pseudos.push({ name, arg })
      }
    } else if (/[\w-]/.test(ch)) c.tag = readIdent().toLowerCase()
    else i += 1
  }
  return c
}

const SELECTOR_LIST_PSEUDOS = new Set([
  'is',
  'where',
  'not',
  'has',
  'matches',
  '-webkit-any',
])
const specificities = new Map()
/** Especificidade [a, b, c] de um seletor complexo (em cache). */
export function specificity(selector) {
  let s = specificities.get(selector)
  if (!s) specificities.set(selector, (s = specificityUncached(selector)))
  return s
}
function specificityUncached(selector) {
  const total = [0, 0, 0]
  for (const { compound } of parseComplex(selector)) {
    total[0] += compound.ids.length
    total[1] += compound.classes.length + compound.attrs.length
    if (compound.tag && compound.tag !== '*') total[2] += 1
    if (compound.pseudoElement) total[2] += 1
    for (const p of compound.pseudos) {
      if (p.name === 'where') continue
      if (SELECTOR_LIST_PSEUDOS.has(p.name)) {
        const best = splitTop(p.arg ?? '', ',')
          .map((s) => specificity(s.replace(/^[>+~]\s*/, '')))
          .sort(cmpSpec)
          .pop() ?? [0, 0, 0]
        total[0] += best[0]
        total[1] += best[1]
        total[2] += best[2]
      } else total[1] += 1
    }
  }
  return total
}
const cmpSpec = (a, z) => a[0] - z[0] || a[1] - z[1] || a[2] - z[2]

// Árvore fixa: html > body > section.group.peer (+ parentClasses) > elemento (tag, classes, atributos) > p × n.
// `state` é o estado do elemento: { focus, focusVisible, hover, active }; :hover, :active e :focus-within valem também
// nos ancestrais, como no navegador.
export function buildTree({
  tag = 'div',
  classes = [],
  attrs = {},
  children = 0,
  childClasses = [],
  parentClasses = [],
  state = {},
}) {
  const mk = (t, cls = [], at = {}, parent = null) => {
    const node = {
      tag: t,
      classes: new Set(cls),
      attrs: { ...at, class: cls.join(' ') },
      parent,
      children: [],
      text: false,
      state: {},
    }
    if (parent) parent.children.push(node)
    return node
  }
  const html = mk('html', [], { lang: 'pt-BR' })
  const body = mk('body', [], {}, html)
  const section = mk('section', ['group', 'peer', ...parentClasses], {}, body)
  const el = mk(tag, classes, attrs, section)
  el.state = { ...state, focusWithin: !!state.focus }
  for (let a = el.parent; a; a = a.parent)
    a.state = {
      hover: !!state.hover,
      active: !!state.active,
      focusWithin: !!state.focus,
    }
  el.text = !children
  const kids = []
  for (let k = 0; k < children; k += 1) {
    const p = mk(
      'p',
      (childClasses[k] ?? '').split(' ').filter(Boolean),
      {},
      el
    )
    p.text = true
    kids.push(p)
  }
  return { html, body, section, el, kids }
}

function matchAttr(node, a) {
  if (a.op === '?') return false
  const v = node.attrs[a.name]
  if (v === undefined) return false
  if (a.op === null) return true
  const w = a.value ?? ''
  if (a.op === '=') return v === w
  if (a.op === '~=') return v.split(/\s+/).includes(w)
  if (a.op === '^=') return v.startsWith(w)
  if (a.op === '$=') return v.endsWith(w)
  if (a.op === '*=') return v.includes(w)
  if (a.op === '|=') return v === w || v.startsWith(`${w}-`)
  return false
}
const FORM = new Set(['input', 'button', 'select', 'textarea'])
function matchPseudo(node, p) {
  const siblings = node.parent ? node.parent.children : [node]
  const idx = siblings.indexOf(node)
  switch (p.name) {
    case 'is':
    case 'where':
    case 'matches':
    case '-webkit-any':
      return splitTop(p.arg ?? '', ',').some((s) => matchesSelector(node, s))
    case 'not':
      return !splitTop(p.arg ?? '', ',').some((s) => matchesSelector(node, s))
    case 'has':
      return splitTop(p.arg ?? '', ',').some((rel) => hasRelative(node, rel))
    case 'first-child':
      return idx === 0
    case 'last-child':
      return idx === siblings.length - 1
    case 'only-child':
      return siblings.length === 1
    case 'first-of-type':
      return siblings.filter((s) => s.tag === node.tag).indexOf(node) === 0
    case 'last-of-type': {
      const same = siblings.filter((s) => s.tag === node.tag)
      return same.indexOf(node) === same.length - 1
    }
    case 'nth-child': {
      const arg = (p.arg ?? '').trim()
      const n = idx + 1
      if (arg === 'odd') return n % 2 === 1
      if (arg === 'even') return n % 2 === 0
      if (/^\d+$/.test(arg)) return n === Number(arg)
      return false
    }
    case 'empty':
      return !node.children.length && !node.text
    case 'root':
      return node.tag === 'html'
    case 'enabled':
      return FORM.has(node.tag)
    case 'placeholder-shown':
      return node.tag === 'input' && node.attrs.placeholder !== undefined
    case 'defined':
      return true
    case 'focus':
      return !!node.state?.focus
    case 'focus-visible':
      return !!node.state?.focusVisible
    case 'focus-within':
      return !!node.state?.focusWithin
    case 'hover':
      return !!node.state?.hover
    case 'active':
      return !!node.state?.active
    case 'dir':
      return (p.arg ?? '').trim() === 'ltr'
    case 'lang':
      return true
    default:
      return false
  }
}
function hasRelative(node, rel) {
  const r = rel.trim()
  const m = /^([>+~])\s*(.*)$/.exec(r)
  const comb = m ? m[1] : ' '
  const sel = m ? m[2] : r
  if (comb === '>') return node.children.some((c) => matchesSelector(c, sel))
  if (comb === ' ') {
    const stack = [...node.children]
    while (stack.length) {
      const c = stack.shift()
      if (matchesSelector(c, sel)) return true
      stack.push(...c.children)
    }
    return false
  }
  const sibs = node.parent ? node.parent.children : []
  const after = sibs.slice(sibs.indexOf(node) + 1)
  return comb === '+'
    ? !!after[0] && matchesSelector(after[0], sel)
    : after.some((s) => matchesSelector(s, sel))
}
function matchCompound(node, c) {
  if (c.tag && c.tag !== '*' && c.tag !== node.tag) return false
  for (const cls of c.classes) if (!node.classes.has(cls)) return false
  for (const id of c.ids) if (node.attrs.id !== id) return false
  for (const a of c.attrs) if (!matchAttr(node, a)) return false
  for (const p of c.pseudos) if (!matchPseudo(node, p)) return false
  return true
}
function matchParts(node, parts, i) {
  if (!matchCompound(node, parts[i].compound)) return false
  if (i === 0) return true
  const comb = parts[i].combinator
  if (comb === '>')
    return !!node.parent && matchParts(node.parent, parts, i - 1)
  if (comb === ' ') {
    for (let a = node.parent; a; a = a.parent)
      if (matchParts(a, parts, i - 1)) return true
    return false
  }
  const sibs = node.parent ? node.parent.children : []
  const before = sibs.slice(0, sibs.indexOf(node))
  if (comb === '+')
    return (
      !!before.length && matchParts(before[before.length - 1], parts, i - 1)
    )
  if (comb === '~') return before.some((s) => matchParts(s, parts, i - 1))
  return false
}
/** O seletor casa com o nó (sem pseudo-elemento)? */
export function matchesSelector(node, selector) {
  const parts = parseComplex(selector)
  if (!parts.length || parts[parts.length - 1].compound.pseudoElement)
    return false
  return matchParts(node, parts, parts.length - 1)
}
/** Alvo do seletor no nó: '' (o próprio), '::placeholder'… ou null. */
function targetOf(node, selector) {
  const parts = parseComplex(selector)
  if (!parts.length) return null
  const last = parts[parts.length - 1].compound
  const pe = last.pseudoElement
  if (pe) {
    const copy = parts.map((p, i) =>
      i === parts.length - 1
        ? { ...p, compound: { ...last, pseudoElement: null } }
        : p
    )
    return matchParts(node, copy, copy.length - 1) ? `::${pe}` : null
  }
  return matchParts(node, parts, parts.length - 1) ? '' : null
}

// ---------------------------------------------------------------------------------------------------------------
// Longhands físicas (horizontal-tb, ltr)

const SIDES = ['top', 'right', 'bottom', 'left']
const four = (values) => {
  const v = values.length ? values : ['0']
  return [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]]
}
const words = (value) =>
  splitTop(value.replace(/\s+/g, ' ').trim(), ' ').filter(Boolean)
const LOGICAL = {
  'inline-start': ['left'],
  'inline-end': ['right'],
  'block-start': ['top'],
  'block-end': ['bottom'],
  inline: ['left', 'right'],
  block: ['top', 'bottom'],
}
const OUTLINE_STYLES = new Set([
  'none',
  'hidden',
  'dotted',
  'dashed',
  'solid',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
  'auto',
])
const BORDER_STYLES = OUTLINE_STYLES

/** Expande shorthands e propriedades lógicas em longhands físicas: [[prop, value]]. */
export function longhands(prop, value) {
  const v = value.trim()
  const boxLike = /^(margin|padding|scroll-margin|scroll-padding)$/.exec(prop)
  if (boxLike) return four(words(v)).map((x, i) => [`${prop}-${SIDES[i]}`, x])
  let m =
    /^(margin|padding|scroll-margin|scroll-padding)-(inline|block|inline-start|inline-end|block-start|block-end)$/.exec(
      prop
    )
  if (m) {
    const sides = LOGICAL[m[2]]
    const vals = words(v)
    return sides.map((s, i) => [`${m[1]}-${s}`, vals[i] ?? vals[0]])
  }
  if (prop === 'inset') return four(words(v)).map((x, i) => [SIDES[i], x])
  m =
    /^inset-(inline|block|inline-start|inline-end|block-start|block-end)$/.exec(
      prop
    )
  if (m) {
    const vals = words(v)
    return LOGICAL[m[1]].map((s, i) => [s, vals[i] ?? vals[0]])
  }
  if (/^border-(width|style|color)$/.test(prop)) {
    const kind = prop.slice('border-'.length)
    return four(words(v)).map((x, i) => [`border-${SIDES[i]}-${kind}`, x])
  }
  m =
    /^border-(inline|block|inline-start|inline-end|block-start|block-end)-(width|style|color)$/.exec(
      prop
    )
  if (m) {
    const vals = words(v)
    return LOGICAL[m[1]].map((s, i) => [
      `border-${s}-${m[2]}`,
      vals[i] ?? vals[0],
    ])
  }
  if (prop === 'border' || /^border-(top|right|bottom|left)$/.test(prop)) {
    const sides = prop === 'border' ? SIDES : [prop.slice('border-'.length)]
    let width = 'medium'
    let style = 'none'
    let color = 'currentcolor'
    for (const w of words(v)) {
      if (BORDER_STYLES.has(w)) style = w
      else if (/^(-?[\d.]+(px|rem|em)?|thin|medium|thick|calc\(.*\))$/.test(w))
        width = w
      else color = w
    }
    return sides.flatMap((s) => [
      [`border-${s}-width`, width],
      [`border-${s}-style`, style],
      [`border-${s}-color`, color],
    ])
  }
  if (prop === 'border-radius') {
    const vals = four(words(v.split('/')[0]))
    return ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(
      (c, i) => [`border-${c}-radius`, vals[i]]
    )
  }
  const corner = {
    'start-start': 'top-left',
    'start-end': 'top-right',
    'end-end': 'bottom-right',
    'end-start': 'bottom-left',
  }
  m = /^border-(start-start|start-end|end-end|end-start)-radius$/.exec(prop)
  if (m) return [[`border-${corner[m[1]]}-radius`, v]]
  if (prop === 'gap') {
    const vals = words(v)
    return [
      ['row-gap', vals[0]],
      ['column-gap', vals[1] ?? vals[0]],
    ]
  }
  if (prop === 'overflow') {
    const vals = words(v)
    return [
      ['overflow-x', vals[0]],
      ['overflow-y', vals[1] ?? vals[0]],
    ]
  }
  if (prop === 'outline') {
    let style = 'none'
    let width = 'medium'
    let color = 'currentcolor'
    for (const w of words(v)) {
      if (OUTLINE_STYLES.has(w)) style = w
      else if (/^(-?[\d.]+(px|rem|em)?|thin|medium|thick|calc\(.*\))$/.test(w))
        width = w
      else if (w === 'inherit' || w === 'initial' || w === 'unset')
        return ['outline-style', 'outline-width', 'outline-color'].map((p) => [
          p,
          w,
        ])
      else color = w
    }
    return [
      ['outline-style', style],
      ['outline-width', width],
      ['outline-color', color],
    ]
  }
  if (prop === 'flex') {
    const vals = words(v)
    if (vals[0] === 'none')
      return [
        ['flex-grow', '0'],
        ['flex-shrink', '0'],
        ['flex-basis', 'auto'],
      ]
    if (vals[0] === 'auto')
      return [
        ['flex-grow', '1'],
        ['flex-shrink', '1'],
        ['flex-basis', 'auto'],
      ]
    if (vals[0] === 'initial')
      return [
        ['flex-grow', '0'],
        ['flex-shrink', '1'],
        ['flex-basis', 'auto'],
      ]
    if (vals.length === 1 && /^[\d.]+$/.test(vals[0]))
      return [
        ['flex-grow', vals[0]],
        ['flex-shrink', '1'],
        ['flex-basis', '0%'],
      ]
    const shrinkGiven = vals[1] !== undefined && /^[\d.]+$/.test(vals[1])
    return [
      ['flex-grow', vals[0]],
      ['flex-shrink', shrinkGiven ? vals[1] : '1'],
      ['flex-basis', shrinkGiven ? (vals[2] ?? '0%') : (vals[1] ?? '0%')],
    ]
  }
  if (prop === 'font' && /^(inherit|initial|unset)$/.test(v))
    return [
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'font-variant',
      'line-height',
    ].map((p) => [p, v])
  if (prop === 'list-style' && v === 'none')
    return [
      ['list-style-type', 'none'],
      ['list-style-image', 'none'],
    ]
  if (prop === 'text-decoration' && /^(inherit|initial|unset)$/.test(v))
    return [
      'text-decoration-line',
      'text-decoration-color',
      'text-decoration-style',
    ].map((p) => [p, v])
  return [[prop, v]]
}

// ---------------------------------------------------------------------------------------------------------------
// Cascata e var()

const INHERITED = new Set([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'white-space',
  'word-spacing',
  'visibility',
  'cursor',
  'list-style-type',
  'list-style-position',
  'text-indent',
  'direction',
  'caret-color',
  'accent-color',
  'tab-size',
  'font-feature-settings',
  'font-variation-settings',
  '-webkit-text-size-adjust',
  '-webkit-tap-highlight-color',
  'text-rendering',
  '-webkit-font-smoothing',
  '-moz-osx-font-smoothing',
  'text-size-adjust',
  'scrollbar-color',
  'scrollbar-width',
  'border-collapse',
  'border-spacing',
  'hyphens',
  'overflow-wrap',
  'word-break',
  'text-wrap',
])

/**
 * Folha do navegador (Chromium, html.css): só o anel de foco. `outline: auto` desenha o anel do sistema mesmo com
 * largura 0; uma classe que só dá a largura (outline-2, como no Tailwind 3) o deixa aparecer com a largura e a cor dela.
 */
const UA_LAYER = '(navegador)'
export const UA_RULES = [
  {
    sels: [':focus-visible'],
    conds: [],
    layer: UA_LAYER,
    order: -1,
    decls: [
      {
        prop: 'outline',
        value: 'auto 1px -webkit-focus-ring-color',
        important: false,
      },
    ],
  },
]

/**
 * Motor sobre um CSS achatado: `styleOf(spec)` devolve o estilo canônico do elemento, dos filhos e dos
 * pseudo-elementos (só propriedades declaradas por alguma regra que casa, mais as herdadas do elemento).
 */
export function createEngine(flat, env) {
  const layerRank = (layer) =>
    layer === UA_LAYER
      ? -Infinity
      : layer === null
        ? Infinity
        : flat.layers.indexOf(layer.split('.')[0])
  const active = [...UA_RULES, ...flat.rules].filter((r) =>
    r.conds.every((c) => conditionHolds(c, env))
  )
  // Índice pela primeira classe do composto mais à direita ('*' = sem classe): só esses seletores podem casar.
  const index = new Map()
  for (const rule of active)
    for (const sel of rule.sels) {
      const parts = parseComplex(sel)
      if (!parts.length) continue
      const key = parts[parts.length - 1].compound.classes[0] ?? '*'
      if (!index.has(key)) index.set(key, [])
      index.get(key).push({ rule, sel })
    }
  const cache = new Map()
  function matched(node, target) {
    const out = []
    const candidates = [
      ...(index.get('*') ?? []),
      ...[...node.classes].flatMap((c) => index.get(c) ?? []),
    ]
    const bestByRule = new Map()
    for (const { rule, sel } of candidates) {
      if (targetOf(node, sel) !== target) continue
      const s = specificity(sel)
      const best = bestByRule.get(rule)
      if (!best || cmpSpec(s, best) > 0) bestByRule.set(rule, s)
    }
    for (const [rule, best] of [...bestByRule].sort(
      (a, z) => a[0].order - z[0].order
    )) {
      rule.decls.forEach((d, i) => {
        if (!validAtParse(d.prop, d.value)) return
        for (const [prop, value] of d.prop.startsWith('--')
          ? [[d.prop, d.value]]
          : longhands(d.prop, d.value))
          out.push({
            prop,
            value,
            important: d.important,
            layer: layerRank(rule.layer),
            layerName: rule.layer,
            ua: rule.layer === UA_LAYER,
            spec: best,
            order: rule.order,
            i,
          })
      })
    }
    if (target === '' && node.inline)
      for (const [prop, value] of Object.entries(node.inline))
        out.push({
          prop,
          value,
          important: false,
          layer: Infinity,
          spec: [1, 0, 0, 0],
          inline: true,
          order: Infinity,
          i: 0,
        })
    return out
  }
  function cascaded(node, target) {
    const key = node
    const cacheKey = target
    let byNode = cache.get(key)
    if (!byNode) cache.set(key, (byNode = new Map()))
    if (byNode.has(cacheKey)) return byNode.get(cacheKey)
    const winners = new Map()
    const rank = (d) => [
      d.important ? 1 : 0,
      d.important ? -d.layer : d.layer,
      d.inline ? 1 : 0,
      ...d.spec,
      d.order,
      d.i,
    ]
    const cmp = (a, z) => {
      const ra = rank(a)
      const rz = rank(z)
      for (let k = 0; k < ra.length; k += 1)
        if (ra[k] !== rz[k]) return ra[k] - rz[k]
      return 0
    }
    // Por propriedade, as declarações da que vence para a que perde (revert-layer/revert descem nessa lista).
    // Empate exato: a declaração que aparece depois vence.
    matched(node, target).forEach((d, seq) => {
      if (!winners.has(d.prop)) winners.set(d.prop, [])
      winners.get(d.prop).push({ ...d, seq })
    })
    for (const list of winners.values())
      list.sort((a, z) => cmp(z, a) || z.seq - a.seq)
    byNode.set(cacheKey, winners)
    return winners
  }
  /**
   * Valor efetivo da propriedade no nó: a declaração que vence, descendo a cascata quando ela (ou o var() dela, pelo
   * fallback) dá `revert-layer` (tira a camada dela) ou `revert` (tira as do autor: sobra o navegador). null = nenhuma
   * declaração; { invalid } = var() sem valor e sem fallback.
   */
  function resolve(node, target, prop, lookup) {
    const dropped = []
    for (const d of cascaded(node, target).get(prop) ?? []) {
      if (dropped.some((f) => f(d))) continue
      let v = d.value.trim()
      if (lookup && v.includes('var(')) {
        const r = substitute(v, lookup)
        if (r === INVALID) return { invalid: true }
        v = r.trim()
      }
      const keyword = v.toLowerCase()
      if (keyword === 'revert-layer') {
        dropped.push(
          (x) =>
            x.ua === d.ua &&
            x.layerName === d.layerName &&
            x.important === d.important &&
            !!x.inline === !!d.inline
        )
        continue
      }
      if (keyword === 'revert') {
        dropped.push((x) => !x.ua)
        continue
      }
      return { value: v }
    }
    return null
  }
  const customMemo = new Map()
  function custom(node, target, name, seen = new Set()) {
    const k = `${target}|${name}`
    let memo = customMemo.get(node)
    if (!memo) customMemo.set(node, (memo = new Map()))
    if (memo.has(k)) return memo.get(k)
    const reg = flat.properties.get(name)
    const own = resolve(node, target, name, null)?.value
    let value
    if (own !== undefined && !/^(inherit|unset|initial)$/.test(own)) {
      if (seen.has(name)) value = undefined
      else {
        const r = substitute(own, (n) =>
          custom(node, target, n, new Set([...seen, name]))
        )
        value = r === INVALID ? (reg ? reg.initial : undefined) : r
      }
    } else if (own === 'initial' || (reg && !reg.inherits))
      value = reg ? reg.initial : undefined
    else if (target) value = custom(node, '', name)
    else value = node.parent ? custom(node.parent, '', name) : reg?.initial
    memo.set(k, value)
    return value
  }
  function computed(node, target, prop) {
    const parentValue = () =>
      target
        ? computed(node, '', prop)
        : node.parent
          ? computed(node.parent, '', prop)
          : undefined
    const r = resolve(node, target, prop, (n) => custom(node, target, n))
    // Sem declaração, ou var() inválido no valor (vale como unset): herda ou fica o inicial.
    if (!r || r.invalid) return INHERITED.has(prop) ? parentValue() : undefined
    const own = r.value
    if (own === 'inherit' || (own === 'unset' && INHERITED.has(prop)))
      return parentValue()
    if (own === 'initial' || own === 'unset') return undefined
    return own
  }
  /** Estilo canônico { prop: valor } de um alvo: propriedades declaradas nele (e as herdadas dele, se pedidas). */
  function styleOf(node, target = '', inheritedFromSelf = true) {
    const props = new Set(
      [...cascaded(node, target).keys()].filter((p) => !p.startsWith('--'))
    )
    if (inheritedFromSelf)
      for (const p of INHERITED) if (cascaded(node, target).has(p)) props.add(p)
    const out = {}
    for (const p of [...props].sort()) {
      const v = computed(node, target, p)
      if (/^-(ms|moz)-/.test(p)) continue
      out[p] = v === undefined ? initialOf(p) : canonical(p, v)
    }
    return postprocess(out, env)
  }
  return { styleOf, cascaded, computed }
}

const INVALID = Symbol('inválido')
/** Troca var(--x, fallback) pelo valor; INVALID se uma variável sem valor não tem fallback. */
export function substitute(value, lookup) {
  let invalid = false
  const replace = (text) => {
    let out = ''
    let i = 0
    while (i < text.length) {
      const at = text.indexOf('var(', i)
      if (at === -1 || (at > 0 && /[\w-]/.test(text[at - 1]))) {
        if (at === -1) {
          out += text.slice(i)
          break
        }
        out += text.slice(i, at + 4)
        i = at + 4
        continue
      }
      out += text.slice(i, at)
      let depth = 0
      let j = at + 3
      for (; j < text.length; j += 1) {
        if (text[j] === '(') depth += 1
        if (text[j] === ')') {
          depth -= 1
          if (depth === 0) break
        }
      }
      const inner = text.slice(at + 4, j)
      const comma = splitTop(inner, ',')
      const name = comma[0].trim()
      const hasFallback = inner.includes(',')
      const fallback = hasFallback
        ? inner.slice(inner.indexOf(',') + 1)
        : undefined
      const v = lookup(name)
      if (v !== undefined) out += v
      else if (hasFallback) out += replace(fallback)
      else invalid = true
      i = j + 1
    }
    return out
  }
  const r = replace(value)
  return invalid ? INVALID : r.trim()
}

// ---------------------------------------------------------------------------------------------------------------
// Valores canônicos

const round = (n, d = 3) => {
  const f = 10 ** d
  const r = Math.round(n * f) / f
  return Object.is(r, -0) ? 0 : r
}
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const gamma = (v) =>
  Math.abs(v) > 0.0031308
    ? Math.sign(v) * (1.055 * Math.abs(v) ** (1 / 2.4) - 0.055)
    : 12.92 * v
function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3
  const m = (L - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3
  const s = (L - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => clamp01(gamma(v)) * 255)
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
const NAMED = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
}
const num = (t, scale = 1) =>
  t.endsWith('%')
    ? (parseFloat(t) / 100) * scale
    : t === 'none'
      ? 0
      : parseFloat(t)

/** Cor CSS -> [r, g, b, a] (0–255, 0–1) ou null. `color-mix(in x, C p%, transparent)` = C com alfa × p. */
export function parseColor(input) {
  const s = input.trim().toLowerCase()
  if (s in NAMED) return NAMED[s]
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    let h = m[1]
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    const n = (i) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  m = /^color-mix\(in [\w-]+,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/.exec(
    s
  )
  if (m) {
    const c = parseColor(m[1])
    return c ? [c[0], c[1], c[2], c[3] * (Number(m[2]) / 100)] : null
  }
  m = /^([a-z]+)\((.*)\)$/.exec(s)
  if (!m) return null
  const fn = m[1]
  let body = m[2].replace(/,/g, ' ')
  let alpha = 1
  const slash = splitTop(body, '/')
  if (slash.length === 2) {
    alpha = num(slash[1].trim())
    body = slash[0]
  }
  const parts = body.trim().split(/\s+/)
  if (parts.some((p) => !/^-?[\d.]+(%|deg)?$|^none$/.test(p))) return null
  if ((fn === 'rgb' || fn === 'rgba') && parts.length >= 3) {
    if (parts.length === 4) alpha = num(parts[3])
    return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha]
  }
  if ((fn === 'hsl' || fn === 'hsla') && parts.length >= 3) {
    if (parts.length === 4) alpha = num(parts[3])
    const [r, g, b] = hslToRgb(
      parseFloat(parts[0]),
      num(parts[1]),
      num(parts[2])
    )
    return [r, g, b, alpha]
  }
  if (fn === 'oklab')
    return [
      ...oklabToRgb(num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4)),
      alpha,
    ]
  if (fn === 'oklch') {
    const h = (parseFloat(parts[2]) * Math.PI) / 180
    const C = num(parts[1], 0.4)
    return [
      ...oklabToRgb(num(parts[0]), C * Math.cos(h), C * Math.sin(h)),
      alpha,
    ]
  }
  return null
}
const colorText = (c) =>
  c[3] === 0
    ? 'rgba(0,0,0,0)'
    : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${round(c[3])})`
const COLOR_TOKEN =
  /color-mix\([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*\)|(?:rgba?|hsla?|oklab|oklch)\([^()]*\)|#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:transparent|white|black)\b/g
/** Troca cada cor reconhecida do valor por rgba(r,g,b,a). */
export function normalizeColors(value) {
  return value.replace(COLOR_TOKEN, (t) => {
    const c = parseColor(t)
    return c ? colorText(c) : t
  })
}

// calc() com dimensões: + - * / de números, px, %, deg, ms/s, vw/vh (rem e em viram px).
function evalCalc(expr) {
  const tokens = expr.match(
    /-?[\d.]+(?:e-?\d+)?(?:px|rem|em|%|deg|ms|s|vw|vh|svh|dvh|fr)?|[()+\-*/]|infinity/g
  )
  if (
    !tokens ||
    tokens.join('').replace(/\s/g, '') !== expr.replace(/\s|calc/g, '')
  )
    return null
  let pos = 0
  const dim = (t) => {
    if (t === 'infinity') return { v: Infinity, u: '' }
    const m = /^(-?[\d.]+(?:e-?\d+)?)(.*)$/.exec(t)
    let v = Number(m[1])
    let u = m[2]
    if (u === 'rem' || u === 'em') {
      v *= 16
      u = 'px'
    }
    if (u === 's') {
      v *= 1000
      u = 'ms'
    }
    return { v, u }
  }
  const primary = () => {
    const t = tokens[pos++]
    if (t === '(') {
      const r = sum()
      pos += 1
      return r
    }
    if (t === '-') {
      const r = primary()
      return r && { v: -r.v, u: r.u }
    }
    return dim(t)
  }
  const product = () => {
    let a = primary()
    while (a && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++]
      const b = primary()
      if (!b) return null
      if (op === '*') {
        if (a.u && b.u) return null
        a = { v: a.v * b.v, u: a.u || b.u }
      } else {
        if (b.u) return null
        a = { v: a.v / b.v, u: a.u }
      }
    }
    return a
  }
  const sum = () => {
    let a = product()
    while (a && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++]
      const b = product()
      if (!b) return null
      if (a.u !== b.u && a.v !== 0 && b.v !== 0) return null
      const u = a.v === 0 ? b.u : a.u
      a = { v: op === '+' ? a.v + b.v : a.v - b.v, u }
    }
    return a
  }
  const r = sum()
  return r && pos === tokens.length ? r : null
}
const dimText = ({ v, u }) => (v === Infinity ? 'infinity' : `${round(v)}${u}`)
/** calc(...) avaliável vira a dimensão; rem/em viram px; `0` sem unidade em contexto de comprimento vira 0px. */
function normalizeNumbers(value, lengthContext) {
  // Cores já normalizadas ficam de fora (o 0 de rgba(0,0,0,1) não é comprimento).
  const colors = []
  const masked = value.replace(
    /rgba\([^()]*\)/g,
    (c) => `§COR${colors.push(c) - 1}§`
  )
  return normalizeNumbersMasked(masked, lengthContext).replace(
    /§COR(\d+)§/g,
    (_, i) => colors[Number(i)]
  )
}
function normalizeNumbersMasked(value, lengthContext) {
  let out = value.replace(
    /calc\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g,
    (whole, inner) => {
      const r = evalCalc(inner.replace(/calc\(/g, '('))
      return r ? dimText(r) : whole
    }
  )
  out = out.replace(
    /(^|[\s(,/])(-?[\d.]+)(rem|em)(?![\w-])/g,
    (_, pre, n) => `${pre}${round(Number(n) * 16)}px`
  )
  out = out.replace(
    /(^|[\s(,/])(-?[\d.]+)s(?![\w-])/g,
    (_, pre, n) => `${pre}${round(Number(n) * 1000)}ms`
  )
  out = out.replace(
    /(^|[\s(,])(-?\d*\.\d+|-?\d+\.\d*)(?=[a-z%]*(?:[\s,)/]|$))/g,
    (_, pre, n) => `${pre}${round(Number(n))}`
  )
  if (lengthContext) out = out.replace(/(^|[\s(,])-?0(?=[\s,)]|$)/g, '$10px')
  return out
}

const LENGTH_PROPS =
  /^(margin|padding|top|right|bottom|left|width|height|min-|max-|gap|row-gap|column-gap|border-.*(width|radius)|outline-(width|offset)|font-size|letter-spacing|text-indent|scroll-|flex-basis|translate|border-spacing|text-underline-offset|text-decoration-thickness)/

function splitFunctions(value) {
  return value.match(/[\w-]+\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g) ?? []
}
/** Sombra: camadas sem as nulas (cor transparente ou tudo zero), comprimentos em px, cor em rgba. */
function canonicalShadow(value) {
  if (value.trim() === 'none') return 'none'
  const layers = []
  for (const layer of splitTop(value, ',')) {
    const toks = words(normalizeNumbers(normalizeColors(layer), true))
    if (!toks.length) continue
    const inset = toks.includes('inset')
    const lengths = toks
      .filter((t) => /^-?[\d.]+(px)?$/.test(t))
      .map((t) => (t.endsWith('px') ? t : `${t}px`))
    const color =
      toks.find(
        (t) =>
          t.startsWith('rgba(') ||
          t === 'currentcolor' ||
          /^(hsl|color)/.test(t)
      ) ?? 'currentcolor'
    while (lengths.length < 4) lengths.push('0px')
    if (
      color === 'rgba(0,0,0,0)' ||
      lengths.every((l) => /^-?0(\.0+)?px$/.test(l))
    )
      continue
    layers.push(`${inset ? 'inset ' : ''}${lengths.join(' ')} ${color}`)
  }
  return layers.length ? layers.join(', ') : 'none'
}
/** Degradê: direção explícita, cores em rgba, sem posições padrão; preserva a interpolação quando difere de sRGB. */
function canonicalGradient(value) {
  return value.replace(
    /(linear|radial|conic)-gradient\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g,
    (_, kind, inner) => {
      const parts = splitTop(
        normalizeNumbers(normalizeColors(inner), false),
        ','
      ).filter(Boolean)
      const head =
        parts.length && !/^rgba\(|^currentcolor/.test(parts[0])
          ? [parts.shift().replace(/\s+in\s+srgb$/i, '')]
          : []
      const n = parts.length
      const even = parts.every((p, i) => {
        const pos = / (-?[\d.]+)%$/.exec(p)
        return (
          !pos ||
          Math.abs(Number(pos[1]) - (n === 1 ? 0 : (i * 100) / (n - 1))) < 1e-6
        )
      })
      const stops = even
        ? parts.map((p) => p.replace(/ -?[\d.]+%$/, '').trim())
        : parts
      return `${kind}-gradient(${[...head, ...stops].join(', ')})`
    }
  )
}
/** transform: funções sem as identidades (translate 0, rotate 0, scale 1), escala em número, ângulo em deg. */
function canonicalTransform(value) {
  if (value.trim() === 'none') return 'none'
  const out = []
  for (const fn of splitFunctions(normalizeNumbers(value, false))) {
    const m = /^([\w-]+)\((.*)\)$/.exec(fn)
    const name = m[1].toLowerCase()
    const args = splitTop(m[2], ',').map((a) => a.trim())
    const zero = (a) => /^-?0(px|%|deg)?$/.test(a)
    const scale = (a) =>
      a.endsWith('%') ? round(parseFloat(a) / 100) : round(parseFloat(a))
    if (name === 'translate' || name === 'translate3d') {
      const [x = '0', y = '0', z = '0'] = args
      if ([x, y, z].every(zero)) continue
      out.push(
        `translate(${zero(x) ? '0px' : x}, ${zero(y) ? '0px' : y}${zero(z) ? '' : `, ${z}`})`
      )
    } else if (name === 'translatex') {
      if (!zero(args[0])) out.push(`translate(${args[0]}, 0px)`)
    } else if (name === 'translatey') {
      if (!zero(args[0])) out.push(`translate(0px, ${args[0]})`)
    } else if (name === 'rotate' || name === 'rotatez') {
      if (!zero(args[0])) out.push(`rotate(${parseFloat(args[0])}deg)`)
    } else if (name === 'scalex') {
      if (scale(args[0]) !== 1) out.push(`scaleX(${scale(args[0])})`)
    } else if (name === 'scaley') {
      if (scale(args[0]) !== 1) out.push(`scaleY(${scale(args[0])})`)
    } else if (name === 'scale') {
      const x = scale(args[0])
      const y = args[1] === undefined ? x : scale(args[1])
      if (x !== 1) out.push(`scaleX(${x})`)
      if (y !== 1) out.push(`scaleY(${y})`)
    } else if (name === 'skewx' || name === 'skewy') {
      if (!zero(args[0]))
        out.push(
          `${name === 'skewx' ? 'skewX' : 'skewY'}(${parseFloat(args[0])}deg)`
        )
    } else out.push(fn)
  }
  return out.length ? out.join(' ') : 'none'
}
/** Valor canônico de uma propriedade. */
export function canonical(prop, raw) {
  let v = raw.replace(/\s+/g, ' ').trim()
  if (v === 'initial' || v === 'unset') return initialOf(prop)
  if (prop === 'opacity' && /%$/.test(v))
    return String(round(parseFloat(v) / 100))
  if (/^(outline|border-(top|right|bottom|left))-width$/.test(prop))
    v = v
      .replace(/^thin$/, '1px')
      .replace(/^medium$/, '3px')
      .replace(/^thick$/, '5px')
  if (prop === 'transform-origin') return canonicalOrigin(v)
  if (prop === 'box-shadow') return canonicalShadow(v)
  if (prop === 'transform') return canonicalTransform(v)
  if (/^(translate|scale|rotate)$/.test(prop))
    return v === 'none' ? 'none' : normalizeNumbers(v, prop === 'translate')
  if (prop === 'background-image' || prop === 'mask-image')
    return canonicalGradient(v)
  if (
    prop === 'filter' ||
    prop === 'backdrop-filter' ||
    prop === '-webkit-backdrop-filter'
  ) {
    v = normalizeNumbers(normalizeColors(v), true)
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
    return v.trim() || 'none'
  }
  if (
    /^transition-(property|timing-function|duration|delay|behavior)$|^animation/.test(
      prop
    )
  )
    return splitTop(normalizeNumbers(v, false), ',')
      .map((s) => s.trim())
      .join(', ')
  if (
    /color$|^fill$|^stroke$|^caret-color$|^accent-color$|^background$/.test(
      prop
    )
  )
    return normalizeColors(v).replace(/currentColor/g, 'currentcolor')
  v = normalizeNumbers(
    normalizeColors(v.replace(/\s*,\s*/g, ', ')),
    LENGTH_PROPS.test(prop)
  )
  return v
}

/** Valores iniciais das propriedades que aparecem declaradas numa versão e ausentes na outra. */
export const INITIAL_VALUES = {
  outline: 'invisível',
  'outline-style': 'none',
  'outline-width': '3px',
  'outline-offset': '0px',
  '-webkit-line-clamp': 'none',
  'overflow-x': 'visible',
  'overflow-y': 'visible',
  transform: 'none',
  translate: 'none',
  scale: 'none',
  rotate: 'none',
  'clip-path': 'none',
  filter: 'none',
  'backdrop-filter': 'none',
  'box-shadow': 'none',
  'background-image': 'none',
}
const initialOf = (prop) => INITIAL_VALUES[prop] ?? '(inicial)'

const COLOR_PROP = /(^|-)color$|^fill$|^stroke$/
/** Declaração que o navegador descarta na leitura: propriedade de cor com valor que não é cor (ex.: clamp(...)). */
function validAtParse(prop, value) {
  if (!COLOR_PROP.test(prop) || prop.startsWith('--') || /var\(/.test(value))
    return true
  const v = value.trim().toLowerCase()
  if (
    /^(inherit|initial|unset|revert|revert-layer|currentcolor|transparent|none|auto)$/.test(
      v
    )
  )
    return true
  if (
    /^(clamp|calc|min|max)\(/.test(v) ||
    /^-?[\d.]+(px|rem|em|%|vw|vh)?$/.test(v)
  )
    return false
  return true
}

/** transform-origin em porcentagens (left/top = 0%, center = 50%, right/bottom = 100%; um valor só = x e 50%). */
function canonicalOrigin(value) {
  const map = {
    left: '0%',
    top: '0%',
    center: '50%',
    right: '100%',
    bottom: '100%',
  }
  const toks = words(normalizeNumbers(value, true)).map(
    (t) => map[t] ?? (/^-?0(px|%)?$/.test(t) ? '0%' : t)
  )
  const raw = words(value)
  if (toks.length === 1)
    return /^(top|bottom)$/.test(raw[0]) ? `50% ${toks[0]}` : `${toks[0]} 50%`
  return toks.join(' ')
}

/**
 * Contorno invisível (estilo none, largura 0 ou cor transparente) vira um só valor, como na prova no navegador. O
 * estilo `auto` (anel do navegador) desenha mesmo com largura 0 (Chromium); nas cores forçadas a cor transparente vira
 * a do sistema e o contorno aparece (é o que o `outline: 2px solid transparent` do outline-none do Tailwind 3 faz).
 */
function postprocess(style, env = {}) {
  const s = { ...style }
  const styleV = s['outline-style'] ?? 'none'
  const width = s['outline-width']
  const color = s['outline-color']
  const visible =
    styleV !== 'none' &&
    styleV !== '(inicial)' &&
    (styleV === 'auto' || !(width && /^0(px)?$/.test(width))) &&
    (color !== 'rgba(0,0,0,0)' || !!env.forcedColors)
  if (
    !visible &&
    ('outline-style' in s ||
      'outline-width' in s ||
      'outline-color' in s ||
      'outline-offset' in s)
  ) {
    for (const k of [
      'outline-style',
      'outline-width',
      'outline-color',
      'outline-offset',
    ])
      delete s[k]
    s.outline = 'invisível'
  }
  // translate/scale/rotate `none` é o valor inicial: igual a não declarar (a produção só tinha transform).
  for (const k of ['translate', 'scale', 'rotate'])
    if (s[k] === 'none') delete s[k]
  return s
}

// ---------------------------------------------------------------------------------------------------------------
// Variantes: condição normalizada de `<cadeia>:[--parity-probe:1]`

export const PROBE = '[--parity-probe:1]'
const escapeTw3 = (c) =>
  c.replace(/[^\w-]/g, (ch) => (ch === ',' ? '\\2c ' : `\\${ch}`))
const escapeTw4 = (c) => c.replace(/[^\w-]/g, (ch) => `\\${ch}`)
function canonicalCompound(compound) {
  const pe = compound.search(/::/)
  const head = pe === -1 ? compound : compound.slice(0, pe)
  const tail = pe === -1 ? '' : compound.slice(pe)
  const simple = []
  let depth = 0
  let cur = ''
  for (const ch of head) {
    if (
      (ch === '.' || ch === '[' || ch === ':' || ch === '&' || ch === '#') &&
      depth === 0 &&
      cur &&
      !cur.endsWith(':')
    ) {
      simple.push(cur)
      cur = ''
    }
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth -= 1
    cur += ch
  }
  if (cur) simple.push(cur)
  const typeSel = simple.filter((x) => /^[a-z*]/i.test(x))
  const rest = simple.filter((x) => !/^[a-z*]/i.test(x)).sort()
  return [...typeSel, ...rest].join('') + tail
}
/**
 * Seletor da variante na forma do Tailwind 3: combinadores com espaço, compostos em ordem, :has(:is(X)) = :has(X),
 * :is(composto) = composto e `&:is(:where(.group)X *)` = `.groupX &` (anotado: especificidade menor no Tailwind 4).
 */
export function canonicalVariantSelector(sel) {
  let s = sel
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
  let note = null
  for (;;) {
    const m =
      /&:is\(:where\((\.(?:group|peer)(?:\\\/[\w-]+)?)\)((?:[^()]|\((?:[^()]|\([^()]*\))*\))*?) (\*|~ \*)\)/.exec(
        s
      )
    if (!m) break
    note = 'especificidade'
    s = s.replace(
      m[0],
      m[3] === '*' ? `${m[1]}${m[2]} &` : `${m[1]}${m[2]} ~ &`
    )
  }
  s = s.replace(/:has\(:is\(([^()]*)\)\)/g, ':has($1)')
  s = s.replace(/:is\(((?:\[[^\]]*\]|:[\w-]+|\.[\w\\/-]+)+)\)/g, '$1')
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth -= 1
    if (ch === ' ' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  const canon = parts
    .map((p) => (['>', '+', '~', ''].includes(p) ? p : canonicalCompound(p)))
    .join(' ')
  return { selector: canon.replace(/\s+/g, ' '), note }
}
// A unidade fica (rem não vira px): 48rem e 768px só coincidem com a fonte do navegador em 16px.
const canonicalMedia = (params) =>
  params
    .replace(/\(width >= ([\d.]+px)\)/g, '(min-width: $1)')
    .replace(/\(width < ([\d.]+px)\)/g, 'not all and (min-width: $1)')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim()

/** Entradas { conds, selector, decl } de cada classe-sonda, a partir do CSS achatado. */
export function variantEntries(flat, chains) {
  const byClass = new Map()
  const want = new Map(chains.map((c) => [`${c}:${PROBE}`, c]))
  const tokens = new Map()
  for (const cls of want.keys()) {
    tokens.set(`.${escapeTw3(cls)}`, cls)
    tokens.set(`.${escapeTw4(cls)}`, cls)
  }
  for (const rule of flat.rules) {
    for (const sel of rule.sels) {
      let cls = null
      let token = null
      for (const [t, c] of tokens) {
        const idx = sel.indexOf(t)
        if (idx !== -1 && !/[\w\\-]/.test(sel[idx + t.length] ?? '')) {
          cls = c
          token = t
          break
        }
      }
      if (!cls) continue
      const { selector, note } = canonicalVariantSelector(
        sel.split(token).join('&')
      )
      const conds = rule.conds.map(
        (c) =>
          `@${c.name} ${c.name === 'media' ? canonicalMedia(c.params) : c.params.replace(/\s+/g, ' ').trim()}`
      )
      for (const d of rule.decls) {
        if (d.prop === '--parity-probe') continue
        const list = byClass.get(want.get(cls)) ?? {
          entries: [],
          notes: new Set(),
        }
        list.entries.push(
          `${conds.join(' › ')} | ${selector} | ${d.prop}: ${d.value.replace(/\s+/g, ' ').trim()}`
        )
        if (note) list.notes.add(note)
        byClass.set(want.get(cls), list)
      }
      if (!rule.decls.some((d) => d.prop !== '--parity-probe')) {
        const list = byClass.get(want.get(cls)) ?? {
          entries: [],
          notes: new Set(),
        }
        list.entries.push(`${conds.join(' › ')} | ${selector}`)
        if (note) list.notes.add(note)
        byClass.set(want.get(cls), list)
      }
    }
  }
  return new Map(
    [...byClass].map(([c, { entries, notes }]) => [
      c,
      { entries: [...new Set(entries)].sort(), notes: [...notes] },
    ])
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Utilitários: pares, cadeias e o estilo canônico de cada um

/** Divide `a:b:[&_x]:c` em ['a','b','[&_x]','c'] (dois-pontos fora de colchetes/parênteses). */
export function splitVariants(cls) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of cls) {
    if (ch === '[' || ch === '(') depth += 1
    if (ch === ']' || ch === ')') depth -= 1
    if (ch === ':' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts
}
export const baseOf = (cls) => splitVariants(cls).pop()
export const chainOf = (cls) => splitVariants(cls).slice(0, -1).join(':')

/** Classes do Tailwind 4 que substituem uma da produção (mesmo efeito): o lado da produção usa o nome antigo. */
export const RENAMES = {
  'outline-hidden': 'outline-none',
  'outline-solid': 'outline',
}

/** Parceiros que tornam o efeito do utilitário observável (ele só grava uma variável que outro lê). */
export function pairing(u) {
  if (/^(bg-gradient|bg-linear)-to-/.test(u))
    return { with: 'from-black via-white to-black' }
  if (/^from-/.test(u)) return { with: 'bg-gradient-to-r to-black' }
  if (/^via-/.test(u)) return { with: 'bg-gradient-to-r from-black to-black' }
  if (/^to-/.test(u)) return { with: 'bg-gradient-to-r from-black' }
  if (/^ring-offset-\d/.test(u) || /^ring-offset-\[\d/.test(u))
    return { with: 'ring-2 ring-black ring-offset-white' }
  if (/^ring-offset-/.test(u))
    return { with: 'ring-2 ring-black ring-offset-2' }
  if (/^ring(?:-\d+|-\[\d+px\])?$/.test(u)) return { with: 'ring-black' }
  if (u === 'ring-inset') return { with: 'ring-2 ring-black' }
  if (/^ring-/.test(u)) return { with: 'ring-2' }
  if (
    /^shadow-(?!(?:2xs|xs|sm|md|lg|xl|2xl|inner|none)$)(?!\[)[a-z]/.test(u) &&
    !/^shadow-(control|raised|textarea|checkbox)/.test(u)
  )
    return { with: 'shadow-md' }
  if (/^divide-/.test(u))
    return {
      with: /^divide-[xy]/.test(u) ? 'divide-black' : 'divide-y',
      children: true,
    }
  if (/^-?space-/.test(u)) return { children: true }
  if (/^placeholder-/.test(u)) return { tag: 'input' }
  if (
    /^outline-/.test(u) &&
    !/^outline-(?:\d|none|hidden|dashed|dotted|double|solid|offset|\[\d)/.test(
      u
    )
  )
    return { with: 'outline outline-2' }
  if (/^outline-offset/.test(u))
    return { with: 'outline outline-2 outline-black' }
  if (/^(decoration|underline-offset)-/.test(u)) return { with: 'underline' }
  if (/^(fill|stroke)-/.test(u)) return { tag: 'svg' }
  if (/^(appearance|accent|caret)-/.test(u)) return { tag: 'input' }
  if (/^(border-spacing|border-collapse|border-separate|caption)/.test(u))
    return { tag: 'table' }
  return {}
}

/** Variáveis definidas só por componente (estilo inline) recebem um valor fixo, igual nas duas versões. */
export const INLINE_VARS = {
  '--color-border': 'rgb(10 20 30)',
  '--color-bg': 'rgb(40 50 60)',
  '--nested-dialogs': '0',
  '--sidebar-width': '16rem',
  '--sidebar-width-icon': '3rem',
  '--skeleton-width': '70%',
}

/**
 * Passadas da prova: largura da janela, cores forçadas (só o contorno), estado do elemento e fonte do navegador.
 * foco-teclado = :focus + :focus-visible (Tab); foco-mouse = só :focus (clique num botão); fonte-20px = fonte padrão do
 * navegador em 20px numa janela de 800px (breakpoints em rem × px).
 */
export const PASSES = {
  1440: { width: 1440 },
  390: { width: 390 },
  'cores-forçadas': { width: 1440, forcedColors: true },
  'foco-teclado': { width: 1440, state: { focus: true, focusVisible: true } },
  'cores-forçadas foco-teclado': {
    width: 1440,
    forcedColors: true,
    state: { focus: true, focusVisible: true },
  },
  'foco-mouse': { width: 1440, state: { focus: true } },
  'fonte-20px': { width: 800, remPx: 20 },
}
/** Passadas de cada utilitário-base (a fixture guarda estas). */
export const BASE_PASSES = [
  '1440',
  '390',
  'cores-forçadas',
  'foco-teclado',
  'cores-forçadas foco-teclado',
]

/**
 * Estilo canônico de um conjunto de classes num elemento: { el, kids?, placeholder? } em cada passada (BASE_PASSES por
 * padrão); nas cores forçadas, só o contorno. `classes` já com os nomes da versão.
 */
export function styleOfClasses(
  sheet,
  classes,
  {
    tag = 'div',
    children = 0,
    childClasses = [],
    attrs,
    parentClasses = [],
    passes = BASE_PASSES,
  } = {}
) {
  const out = {}
  for (const vp of passes) {
    const pass = PASSES[vp]
    const forced = !!pass.forcedColors
    const engine = sheet.engine(pass.width, forced, pass.remPx ?? 16)
    const tree = buildTree({
      tag,
      classes,
      attrs: attrs ?? (tag === 'input' ? { placeholder: 'x' } : {}),
      children,
      childClasses,
      parentClasses,
      state: pass.state ?? {},
    })
    tree.el.inline = INLINE_VARS
    // Fontes do next/font (variáveis no <html>): as mesmas nas duas versões.
    tree.html.inline = { '--font-inter': 'Inter', '--font-jost': 'Jost' }
    if (forced) {
      // Sem contorno declarado, o estilo inicial (none) também é invisível.
      const st = engine.styleOf(tree.el, '')
      const style = st['outline-style'] ?? 'none'
      out[vp] = {
        el: {
          outline:
            st.outline ??
            (style === 'none' || style === '(inicial)'
              ? 'invisível'
              : `${style} ${st['outline-width'] ?? '3px'} offset ${st['outline-offset'] ?? '0px'}`),
        },
      }
      continue
    }
    const r = { el: engine.styleOf(tree.el, '') }
    if (tag === 'input' || tag === 'textarea')
      r.placeholder = engine.styleOf(tree.el, '::placeholder', false)
    if (children) r.kids = tree.kids.map((k) => engine.styleOf(k, '', false))
    out[vp] = r
  }
  return out
}

/** Folha pronta para o motor, com um motor por largura, cores forçadas e fonte do navegador (em cache). */
export function prepareSheet(root) {
  const flat = flattenCss(root)
  const engines = new Map()
  return {
    flat,
    engine(width, forcedColors = false, remPx = 16) {
      const k = `${width}|${forcedColors}|${remPx}`
      if (!engines.has(k))
        engines.set(k, createEngine(flat, { width, forcedColors, remPx }))
      return engines.get(k)
    },
  }
}

/** Achata um estilo { vp: { el, kids, placeholder } } em { "vp alvo prop": valor }. */
export function flatStyle(style) {
  const out = {}
  for (const [vp, r] of Object.entries(style)) {
    for (const [k, v] of Object.entries(r.el)) out[`${vp} ${k}`] = v
    if (r.placeholder)
      for (const [k, v] of Object.entries(r.placeholder))
        out[`${vp} ::placeholder ${k}`] = v
    r.kids?.forEach((kid, i) =>
      Object.entries(kid).forEach(
        ([k, v]) => (out[`${vp} filho${i + 1} ${k}`] = v)
      )
    )
  }
  return out
}

/**
 * Diferenças entre o elemento com a classe e a produção: propriedade em que alguma versão muda em relação ao próprio
 * controle (mesma tag e parceiros, sem a classe) e as duas não chegam ao mesmo valor. Diferença que existe também no
 * controle, igual, é do preflight/base e não do utilitário. `absolute`: toda diferença conta (componente cujo estilo,
 * na produção, vinha das regras globais por elemento e atributo, que valem também no controle).
 */
export function deltaDiff({ el4, ctrl4, el3, ctrl3, absolute = false }) {
  const diffs = []
  const keys = new Set([
    ...Object.keys(el4),
    ...Object.keys(ctrl4),
    ...Object.keys(el3),
    ...Object.keys(ctrl3),
  ])
  for (const k of keys) {
    const prop = k.split(' ').pop()
    const fill = (v) =>
      v === undefined || v === '(ausente)' || v === '(inicial)'
        ? (INITIAL_VALUES[prop] ?? '(ausente)')
        : v
    // el4 é o estilo completo (chave ausente = propriedade ausente, ex.: contorno invisível agrupado em `outline`);
    // el3 é só a diferença para o controle da produção (chave ausente = igual ao controle).
    const a = fill(el4[k])
    const m = fill(el3[k] ?? ctrl3[k])
    if (a === m) continue
    const ca = fill(ctrl4[k])
    const cm = fill(ctrl3[k])
    if (!absolute && a === ca && m === cm) continue
    diffs.push({ k, atual: a, producao: m })
  }
  return diffs
}

/** Só as propriedades em que o elemento difere do controle (o que a fixture guarda da produção). */
export function deltaOf(el, ctrl) {
  const out = {}
  for (const [k, v] of Object.entries(el)) if (ctrl[k] !== v) out[k] = v
  for (const k of Object.keys(ctrl)) if (!(k in el)) out[k] = '(ausente)'
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Plano: classes do produto, utilitários-base, cadeias, controles e combinações conferidas

const MARKERS = /^(group|peer|dark)(\/.*)?$/
/**
 * Classes utilitárias usadas no código do produto: o que o Tailwind 4 gera a partir das fontes (primeira classe de
 * cada regra de nível superior da camada utilities que não é marcador group/peer/dark). Mesmo extrator das provas.
 */
export function productClasses(root) {
  const set = new Set()
  root.walkAtRules('layer', (layer) => {
    if (layer.params !== 'utilities' || !layer.nodes) return
    const visit = (node) => {
      for (const child of node.nodes ?? []) {
        if (child.type === 'rule')
          for (const sel of child.selectors) {
            const cls = [
              ...sel.matchAll(
                /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[^0-9a-fA-F]|[\w-])+)/g
              ),
            ]
              .map((m) => unescapeCss(m[1]))
              .find((t) => !MARKERS.test(t))
            if (cls) set.add(cls)
          }
        else if (child.type === 'atrule') visit(child)
      }
    }
    visit(layer)
  })
  // O modificador ! (important) é proibido no produto: não entra (texto como `!containerRef` do código não é classe).
  return new Set([...set].filter((c) => !/^!|!$/.test(c)))
}

/** Utilitários-base e cadeias de variantes das classes usadas. */
export function planOf(classes) {
  const list = [...classes]
  return {
    bases: [...new Set(list.map(baseOf))].sort(),
    chains: [...new Set(list.map(chainOf).filter(Boolean))].sort(),
  }
}

/** Elementos da prova de cada utilitário (sozinho e com o par) e o controle de cada um. */
export function itemsOf(bases) {
  const items = []
  const controls = new Map()
  const controlOf = (tag, partners, children) => {
    const key = `${tag}|${partners}|${children}`
    if (!controls.has(key))
      controls.set(key, {
        key,
        tag,
        classes: partners ? partners.split(' ') : [],
        children,
      })
    return key
  }
  for (const base of bases) {
    const p = pairing(base)
    const tag = p.tag ?? 'div'
    const children = p.children ? 3 : 0
    items.push({
      base,
      mode: 'só',
      tag,
      children,
      classes: [base],
      control: controlOf(tag, '', children),
    })
    if (p.with)
      items.push({
        base,
        mode: 'par',
        tag,
        children,
        classes: [...p.with.split(' '), base],
        control: controlOf(tag, p.with, children),
      })
  }
  return { items, controls: [...controls.values()] }
}

/**
 * Utilitário de cor com o tom da paleta lido pela variável do tema (`bg-[var(--color-gray-50)]`, com opacidade
 * opcional): a produção não tinha a variável, e sim a classe da paleta (`bg-gray-50`), cujo valor palette.css repete
 * (conferido em primitives.test.ts). Achado 141.
 */
const PALETTE_VAR =
  /^(bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|decoration|placeholder|accent|caret|shadow)-\[var\(--color-([a-z]+-(?:50|[1-9]00|950)|white|black)\)\](\/[\w.%[\]-]+)?$/

/** Nomes da produção (Tailwind 3) das classes: RENAMES e PALETTE_VAR no utilitário-base. */
export const toProduction = (cls) => {
  const v = splitVariants(cls)
  const b = v.pop()
  const palette = PALETTE_VAR.exec(b)
  const production = palette
    ? `${palette[1]}-${palette[2]}${palette[3] ?? ''}`
    : b
  return [...v, RENAMES[b] ?? production].join(':')
}

/** Passadas das combinações: as dos utilitários e o foco por mouse (:focus sem :focus-visible). */
export const COMBO_PASSES = [...BASE_PASSES, 'foco-mouse']

/**
 * Combinações em que a semântica da produção dependia da ORDEM, da especificidade entre classes, do estado ou da folha
 * do navegador (a prova classe por classe não as vê): cada uma mostra uma restauração do lote css-paridade.
 * - `frames`: constantes de packages/ui/src/web (focus-ring.ts, field.ts, trigger.ts) lidas da fonte (uiFrames), antes
 *   de `classes`. Com `producao`, o lado da produção usa essas classes (o componente da main, cujo estilo vinha das
 *   regras globais de app/globals.css por elemento e atributo) e `props` limita a comparação às propriedades
 *   (expressão regular) que a combinação prova.
 * - `tag`, `attrs`, `parentClasses` (classes no pai) e `passes` (padrão COMBO_PASSES).
 */
export const COMBOS = [
  {
    name: 'text-* de variante responsiva vence leading-* (md:text-3xl)',
    classes: ['leading-tight', 'text-2xl', 'md:text-3xl'],
  },
  {
    name: 'leading-* vence text-* da mesma variante',
    classes: ['text-3xl', 'leading-tight'],
  },
  {
    name: 'space-y vence a margem própria do filho',
    classes: ['space-y-4', 'flex', 'flex-col'],
    children: 3,
    childClasses: ['mt-6', 'mb-2', ''],
  },
  {
    name: 'divide-y com filho que tem borda própria',
    classes: ['divide-y'],
    children: 3,
    childClasses: ['border-b-4', 'border-t-2', ''],
  },
  {
    name: 'outline + outline-1 (Dialog)',
    classes: ['outline', 'outline-1', 'outline-gray-200'],
  },
  {
    name: 'outline-2 sozinho: sem contorno em repouso, anel do navegador no foco por teclado',
    classes: ['outline-2', 'outline-orange-500'],
  },
  {
    name: 'focus:outline-2 sem utilitário de estilo: anel do navegador só no foco por teclado',
    classes: ['focus:outline-2', 'focus:outline-blue-500'],
  },
  ...[
    'outline',
    'outline-solid',
    'outline-dashed',
    'outline-dotted',
    'outline-double',
  ].map((style) => ({
    name: `${style} + focus:outline-2 (largura de outra variante): o foco mantém o estilo da classe`,
    classes: [style, 'focus:outline-2', 'outline-orange-500'],
  })),
  {
    name: 'outline-solid no pai não passa o estilo ao outline-2 do filho',
    parentClasses: ['outline-solid'],
    classes: ['outline-2', 'outline-orange-500'],
  },
  {
    name: 'outline-hidden + focus:outline-0 (gatilho de menu): sem contorno em nenhum foco',
    classes: ['outline-hidden', 'focus:outline-0'],
  },
  {
    name: 'focus:outline-hidden + focus:outline-0 (moldura dos campos): sem contorno em nenhum foco',
    classes: ['focus:outline-hidden', 'focus:outline-0'],
  },
  {
    name: 'outline-hidden + focus:outline-2: nas cores forçadas o contorno transparente aparece com a largura do foco',
    classes: ['outline-hidden', 'focus:outline-2'],
  },
  {
    name: 'outline-solid + outline-2 desenha',
    classes: ['outline-solid', 'outline-2', 'outline-orange-500'],
  },
  {
    name: 'outline-hidden + outline-0 no mesmo estado',
    classes: ['outline-hidden', 'outline-0'],
  },
  {
    name: 'translate + rotate + scale numa só transform',
    classes: ['-translate-x-1/2', '-translate-y-1/2', 'rotate-45', 'scale-105'],
  },
  {
    name: 'transform-none depois de translate',
    classes: ['translate-x-1', 'transform-none'],
  },
  {
    name: 'ring sem cor e sem largura (azul 500 a 50%, 3px)',
    classes: ['ring'],
  },
  {
    name: 'ring-2 com offset',
    classes: ['ring-2', 'ring-orange-500', 'ring-offset-2'],
  },
  {
    name: 'shadow-sm com cor de sombra',
    classes: ['shadow-sm', 'shadow-orange-500/20'],
  },
  {
    name: 'transition + duration + curva própria',
    classes: [
      'transition-all',
      'duration-200',
      '[transition-timing-function:ease-in-out]',
    ],
  },
  {
    name: 'breakpoint md: com a fonte do navegador em 20px (janela de 800px): hidden md:flex',
    classes: ['hidden', 'md:flex'],
    passes: ['1440', '390', 'fonte-20px'],
  },
  {
    name: 'breakpoint md: com a fonte do navegador em 20px (janela de 800px): flex-col md:flex-row',
    classes: ['flex', 'flex-col', 'md:flex-row'],
    passes: ['1440', '390', 'fonte-20px'],
  },
  {
    name: 'gatilho com aria-controls (TRIGGER_FRAME: Popover, Accordion, Dialog…): anel azul do navegador só no foco por teclado',
    tag: 'button',
    attrs: {
      type: 'button',
      'aria-controls': 'conteudo',
      'aria-expanded': 'false',
      'aria-haspopup': 'dialog',
      'data-state': 'closed',
    },
    frames: ['TRIGGER_FRAME'],
    producao: [],
    props: '^outline',
  },
  {
    name: 'gatilho do Select (FIELD_FRAME, role=combobox): sem contorno no foco',
    tag: 'button',
    attrs: {
      type: 'button',
      role: 'combobox',
      'aria-controls': 'lista',
      'aria-expanded': 'false',
      'data-state': 'closed',
    },
    frames: ['FIELD_FRAME'],
    producao: [],
    props: '^outline',
  },
  {
    name: 'seletor da barra de filtros (FILTER_FIELD_FRAME, aria-controls): sem contorno no foco',
    tag: 'button',
    attrs: { type: 'button', 'aria-controls': 'dropdown-content' },
    frames: ['FILTER_FIELD_FRAME'],
    producao: ['focus:outline-none', 'focus:ring-0', 'admin-filter-element'],
    props: '^outline',
  },
  {
    name: 'gatilho de menu do cabeçalho (MENU_TRIGGER_FRAME + HEADER_MENU_TRIGGER), sem modalidade de teclado: sem contorno',
    tag: 'button',
    attrs: {
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-controls': 'menu',
      'aria-expanded': 'false',
      'data-state': 'closed',
      'data-own-frame': '',
    },
    frames: ['MENU_TRIGGER_FRAME', 'HEADER_MENU_TRIGGER'],
    producao: [],
    props: '^outline',
  },
  {
    name: 'campo de texto (FIELD_FRAME): sem contorno no foco',
    tag: 'input',
    attrs: { type: 'text', placeholder: 'x' },
    frames: ['FIELD_FRAME'],
    producao: [],
    props: '^outline',
  },
  {
    name: 'área de texto (TEXTAREA_FRAME): sem contorno no foco',
    tag: 'textarea',
    attrs: { placeholder: 'x' },
    frames: ['TEXTAREA_FRAME'],
    producao: [],
    props: '^outline',
  },
]

/**
 * Constantes de classes exportadas por packages/ui/src/web/{focus-ring,field,trigger}.ts, lidas da fonte: string
 * literal ou `[...].join(" ")` de strings e outras constantes. `fsModule`/`pathModule` do node.
 */
export function uiFrames(repo, fsModule, pathModule) {
  const raw = {}
  for (const f of ['focus-ring.ts', 'field.ts', 'trigger.ts']) {
    const text = fsModule
      .readFileSync(
        pathModule.join(repo, 'packages', 'ui', 'src', 'web', f),
        'utf8'
      )
      .replace(/\r\n/g, '\n')
    for (const m of text.matchAll(/export const (\w+) =\s*([\s\S]*?);\n/g))
      raw[m[1]] = m[2].trim()
  }
  const value = (name, seen = []) => {
    if (seen.includes(name) || !(name in raw))
      throw new Error(
        `constante ${name} ausente ou circular em packages/ui/src/web`
      )
    const e = raw[name]
    const literal = /^(["'`])([^"'`$]*)\1$/.exec(e)
    if (literal) return literal[2]
    const list = /^\[([\s\S]*)\]\.join\(\s*["'] ["']\s*\)$/.exec(e)
    if (!list) throw new Error(`constante ${name}: forma não suportada`)
    return list[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const lit = /^(["'`])([^"'`$]*)\1$/.exec(part)
        return lit ? lit[2] : value(part, [...seen, name])
      })
      .join(' ')
  }
  return Object.fromEntries(
    Object.keys(raw)
      .filter((k) => /^[A-Z][A-Z_]+$/.test(k))
      .map((k) => [k, value(k)])
  )
}

/** Classes de uma combinação (e do pai) na versão atual (molduras de packages/ui + classes) e na produção. */
export function comboClasses(combo, frames) {
  const current = [
    ...(combo.frames ?? []).flatMap((f) => {
      if (!(f in frames)) throw new Error(`moldura ${f} ausente de packages/ui`)
      return frames[f].split(' ').filter(Boolean)
    }),
    ...(combo.classes ?? []),
  ]
  const parent = combo.parentClasses ?? []
  return {
    current,
    production: combo.producao ?? current.map(toProduction),
    parent,
    parentProduction: parent.map(toProduction),
  }
}

/** Opções de styleOfClasses de uma combinação (a tag, os atributos, os filhos e as passadas). */
export function comboOptions(combo, parentClasses) {
  return {
    tag: combo.tag ?? 'div',
    attrs: combo.attrs,
    children: combo.children ?? 0,
    childClasses: combo.childClasses ?? [],
    parentClasses,
    passes: combo.passes ?? COMBO_PASSES,
  }
}

/**
 * Strings de classes do código do produto (literais '…', "…" e `…` sem comentários) nas mesmas fontes do CSS: os
 * @source da entrada e o content do tailwind.config.cjs, sem testes nem fixtures. `readDir`/`readFile` do node:fs.
 */
export function productLiterals(repo, fsModule, pathModule) {
  const roots = [
    'packages/ui/src',
    'packages/frontend/src',
    'apps/clients/web/src',
    'app',
    'components',
    'lib',
    'hooks',
  ]
  const files = []
  const walk = (dir) => {
    if (!fsModule.existsSync(dir)) return
    for (const e of fsModule.readdirSync(dir, { withFileTypes: true })) {
      if (
        e.name === 'node_modules' ||
        e.name.startsWith('.') ||
        e.name === '__fixtures__'
      )
        continue
      const p = pathModule.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (
        /\.(tsx?|jsx?|mjs|cjs|mdx)$/.test(e.name) &&
        !/\.(test|spec)\./.test(e.name)
      )
        files.push(p)
    }
  }
  for (const r of roots) walk(pathModule.join(repo, r))
  const out = []
  for (const f of files) {
    const text = fsModule
      .readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1')
    for (const m of text.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g))
      out.push({
        file: pathModule.relative(repo, f).split(pathModule.sep).join('/'),
        text: m[1] ?? m[2] ?? m[3],
      })
  }
  return out
}

/**
 * Utilitários do Tailwind 3 que o 4 removeu (guia de atualização do 4): na produção davam estilo, no 4 não geram CSS, e
 * o extrator (que lê o CSS do 4) não os vê. `ring-green-500 ring-opacity-50` vira `ring-green-500/50`, overflow-ellipsis
 * vira text-ellipsis…
 */
const REMOVED_IN_TAILWIND_4 =
  /^(bg|text|border|divide|ring|placeholder)-opacity-|^overflow-ellipsis$|^decoration-(slice|clone)$/
export function removedInTailwind4(literals) {
  const found = []
  for (const { file, text } of literals)
    for (const token of text.split(/\s+/).filter(Boolean))
      if (REMOVED_IN_TAILWIND_4.test(baseOf(token)))
        found.push(`${file}: ${token}`)
  return found
}

/**
 * Degradê sem parada inicial: na produção (Tailwind 3), bg-gradient-to-* com via-/to- e sem from- era inválido e não
 * desenhava nada; no Tailwind 4 desenha (a parada inicial vale transparente). Lista as strings nessa situação.
 */
export function gradientsWithoutFrom(literals) {
  const found = []
  for (const { file, text } of literals) {
    const bases = text.split(/\s+/).filter(Boolean).map(baseOf)
    if (
      bases.some((b) => /^bg-gradient-to-/.test(b)) &&
      bases.some((b) => /^(via|to)-/.test(b)) &&
      !bases.some((b) => /^from-/.test(b))
    )
      found.push(`${file}: ${text.trim()}`)
  }
  return found
}

/**
 * Preflight: o Tailwind 4 mudou o estilo de elementos sem classe (cursor dos botões, fundo dos campos, cor do
 * placeholder, margem do <dialog>). Cada verificação compara uma propriedade do elemento nas duas versões; quem não a
 * declara fica com o valor do navegador (`ua`, o da folha padrão do Chromium).
 */
export const ELEMENT_CHECKS = [
  { name: 'button', tag: 'button', prop: 'cursor', ua: 'default' },
  {
    name: '[role=button]',
    tag: 'div',
    attrs: { role: 'button' },
    prop: 'cursor',
    ua: 'auto',
  },
  {
    name: 'input texto',
    tag: 'input',
    attrs: { type: 'text', placeholder: 'x' },
    prop: 'background-color',
    ua: 'field',
  },
  {
    name: 'input número',
    tag: 'input',
    attrs: { type: 'number', placeholder: '1' },
    prop: 'background-color',
    ua: 'field',
  },
  {
    name: 'input cor',
    tag: 'input',
    attrs: { type: 'color' },
    prop: 'background-color',
    ua: 'buttonface',
  },
  {
    name: 'textarea',
    tag: 'textarea',
    attrs: { placeholder: 'x' },
    prop: 'background-color',
    ua: 'field',
  },
  { name: 'select', tag: 'select', prop: 'background-color', ua: 'field' },
  {
    name: 'input texto',
    tag: 'input',
    attrs: { type: 'text', placeholder: 'x' },
    target: '::placeholder',
    prop: 'color',
    ua: 'darkgray',
  },
  {
    name: 'textarea',
    tag: 'textarea',
    attrs: { placeholder: 'x' },
    target: '::placeholder',
    prop: 'color',
    ua: 'darkgray',
  },
  {
    name: 'dialog',
    tag: 'dialog',
    attrs: { open: '' },
    prop: 'margin-top',
    ua: 'auto',
  },
  {
    name: 'dialog',
    tag: 'dialog',
    attrs: { open: '' },
    prop: 'margin-left',
    ua: 'auto',
  },
]

/** Valor canônico da verificação de preflight numa versão (o do navegador quando nenhuma regra declara). */
export function elementCheckValue(sheet, check) {
  const engine = sheet.engine(1440, false)
  const tree = buildTree({
    tag: check.tag,
    classes: [],
    attrs: check.attrs ?? {},
  })
  tree.html.inline = { '--font-inter': 'Inter', '--font-jost': 'Jost' }
  const style = engine.styleOf(tree.el, check.target ?? '', false)
  const v = style[check.prop]
  return v === undefined || v === '(inicial)' ? check.ua : v
}

// ---------------------------------------------------------------------------------------------------------------
// Elementos de foco (achado 128): o contorno do ELEMENTO de packages/ui contra o componente da produção, em repouso,
// no clique e no teclado, no modo normal e nas cores forçadas (alto contraste do Windows)

/**
 * Passadas dos elementos de foco, com a modalidade de entrada que `trackInputModality` (packages/ui/src/web/
 * focus-ring.ts) grava no <html> (`data-input-modality`):
 * - repouso: sem foco; `repouso teclado`: sem foco enquanto a pessoa navega pelo teclado (outro item do menu);
 * - clique: :focus sem :focus-visible, modalidade de ponteiro (clique num botão);
 * - `clique foco-por-código`: :focus e :focus-visible com modalidade de ponteiro (menu aberto pelo mouse move o foco
 *   ao item e devolve ao gatilho ao fechar; diálogo aberto pelo mouse move o foco ao X; o navegador pode tratar esse
 *   foco como :focus-visible);
 * - teclado: :focus e :focus-visible com modalidade de teclado (Tab, setas, Enter).
 * Cada uma também nas cores forçadas: o contorno sai só com estilo, largura e afastamento (a cor é a do sistema).
 */
export const FOCUS_PASSES = Object.fromEntries(
  [
    ['repouso', {}],
    ['repouso teclado', { modality: 'keyboard' }],
    ['clique', { modality: 'pointer', state: { focus: true } }],
    [
      'clique foco-por-código',
      { modality: 'pointer', state: { focus: true, focusVisible: true } },
    ],
    [
      'teclado',
      { modality: 'keyboard', state: { focus: true, focusVisible: true } },
    ],
  ].flatMap(([name, pass]) => [
    [name, pass],
    [`cores-forçadas ${name}`, { ...pass, forcedColors: true }],
  ])
)
/** Elemento que não recebe foco (cartão): só as passadas de repouso. */
const FOCUS_REST_PASSES = Object.keys(FOCUS_PASSES).filter((p) =>
  /repouso/.test(p)
)
/** Botões focados pelo clique nativo, sem foco movido por código depois do mouse (aba, caixa de seleção, CloseButton). */
const FOCUS_NATIVE_PASSES = Object.keys(FOCUS_PASSES).filter(
  (p) => !/foco-por-código/.test(p)
)

/**
 * Elementos de packages/ui atingidos pela regra do foco (visível só no teclado, nunca no clique, nenhum contorno em
 * repouso em nenhum modo), com o DOM que o componente renderiza (Radix, Base UI) e as classes da versão atual
 * (`frames`, constantes lidas da fonte por uiFrames, mais `classes`) e da produção (`producao`: as do componente da
 * main; o resto vinha das regras globais de app/globals.css por papel, aria-label e aria-haspopup, que a fixture
 * resolve). Os testes de cada componente (trigger.test.tsx, *.foco.web.test.tsx, Checkbox, Tabs, CloseButton,
 * SearchBar) provam que o componente aplica a moldura. `passes`: as passadas que o elemento vive (padrão: todas);
 * `teclado: 'halo'`: no modo normal o foco por teclado é uma sombra da produção, não o anel da marca.
 */
export const FOCUS_ELEMENTS = [
  {
    name: 'gatilho do DropdownMenu (MENU_TRIGGER_FRAME)',
    tag: 'button',
    attrs: {
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'data-state': 'closed',
    },
    frames: ['MENU_TRIGGER_FRAME'],
    producao: [],
  },
  {
    name: 'gatilho de menu do cabeçalho (MENU_TRIGGER_FRAME + HEADER_MENU_TRIGGER)',
    tag: 'button',
    attrs: {
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'data-state': 'closed',
      'data-own-frame': '',
    },
    frames: ['MENU_TRIGGER_FRAME', 'HEADER_MENU_TRIGGER'],
    producao: [],
  },
  {
    name: 'gatilho do Menubar (MENU_TRIGGER_FRAME)',
    tag: 'button',
    attrs: {
      type: 'button',
      role: 'menuitem',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'data-state': 'closed',
      tabindex: '-1',
    },
    frames: ['MENU_TRIGGER_FRAME'],
    producao: [],
  },
  {
    name: 'item do DropdownMenu (MENU_FOCUS_RING)',
    tag: 'div',
    attrs: { role: 'menuitem', tabindex: '-1', 'data-orientation': 'vertical' },
    frames: ['MENU_FOCUS_RING'],
    producao: [
      'focus:outline-none',
      'focus:ring-0',
      'focus-visible:outline-none',
      'focus-visible:ring-0',
    ],
  },
  {
    name: 'item do ContextMenu e do Menubar (MENU_FOCUS_RING)',
    tag: 'div',
    attrs: { role: 'menuitem', tabindex: '-1', 'data-orientation': 'vertical' },
    frames: ['MENU_FOCUS_RING'],
    producao: [],
  },
  {
    name: 'subgatilho de menu (MENU_FOCUS_RING)',
    tag: 'div',
    attrs: {
      role: 'menuitem',
      tabindex: '-1',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'data-state': 'closed',
    },
    frames: ['MENU_FOCUS_RING'],
    producao: [],
  },
  {
    name: 'X do Dialog com aria-label (MENU_FOCUS_RING)',
    tag: 'button',
    attrs: { type: 'button', 'aria-label': 'Fechar' },
    frames: ['MENU_FOCUS_RING'],
    producao: ['focus:outline-none', 'focus:ring-0'],
  },
  {
    name: 'X do Dialog sem aria-label (MENU_FOCUS_RING)',
    tag: 'button',
    attrs: { type: 'button' },
    frames: ['MENU_FOCUS_RING'],
    producao: ['focus:outline-none', 'focus:ring-0'],
  },
  {
    name: 'X do Sheet (MENU_FOCUS_RING)',
    tag: 'button',
    attrs: { type: 'button', 'aria-label': 'Close' },
    frames: ['MENU_FOCUS_RING'],
    classes: ['focus:shadow-none'],
    producao: [
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-slate-400',
      'focus-visible:ring-offset-2',
    ],
  },
  {
    name: 'caixa de seleção (Checkbox, HALO_FOCUS_OUTLINE)',
    tag: 'button',
    attrs: {
      type: 'button',
      role: 'checkbox',
      'aria-checked': 'false',
      'data-state': 'unchecked',
      value: 'on',
    },
    frames: ['HALO_FOCUS_OUTLINE'],
    classes: ['focus:border-checkbox-checked', 'focus:shadow-checkbox-focus'],
    producao: [
      'focus:border-orange-600',
      'focus:outline-orange-600',
      'focus:outline-2',
      'focus:ring-0',
    ],
    passes: FOCUS_NATIVE_PASSES,
    // No modo normal, o foco por teclado é o halo laranja da produção (sombra), não o anel: identidade mantida.
    teclado: 'halo',
  },
  {
    name: 'aba (TabsTrigger, FOCUS_RING)',
    tag: 'button',
    attrs: {
      type: 'button',
      role: 'tab',
      'aria-selected': 'false',
      'data-state': 'inactive',
      id: 'radix-r1-trigger-b',
      tabindex: '-1',
    },
    frames: ['FOCUS_RING'],
    producao: [
      'ring-offset-white',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-orange-500',
      'focus-visible:ring-offset-2',
    ],
    passes: FOCUS_NATIVE_PASSES,
  },
  {
    name: 'painel da aba (TabsContent, FOCUS_RING)',
    tag: 'div',
    attrs: { role: 'tabpanel', tabindex: '0', 'data-state': 'active' },
    frames: ['FOCUS_RING'],
    producao: [
      'ring-offset-white',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-orange-500',
      'focus-visible:ring-offset-2',
    ],
    passes: FOCUS_NATIVE_PASSES,
  },
  {
    name: 'botão de fechar (CloseButton, FOCUS_RING)',
    tag: 'button',
    attrs: { type: 'button', 'aria-label': 'Close' },
    frames: ['FOCUS_RING'],
    classes: ['focus:shadow-none'],
    producao: [],
    passes: FOCUS_NATIVE_PASSES,
  },
  {
    name: 'cartão da barra de filtros (FILTER_CARD)',
    tag: 'div',
    frames: ['FILTER_CARD'],
    producao: ['admin-filter-card'],
    passes: FOCUS_REST_PASSES,
  },
]

/** Classes de um elemento de foco na versão atual (molduras de packages/ui + classes). */
export function focusElementClasses(element, frames) {
  return comboClasses(
    { frames: element.frames, classes: element.classes ?? [] },
    frames
  ).current
}

/** Passadas de um elemento de foco (todas, salvo `passes`). */
export const focusPassesOf = (element) =>
  element.passes ?? Object.keys(FOCUS_PASSES)

/**
 * Contorno do elemento numa passada: `nenhum` ou `<estilo> <largura> <cor> offset <afastamento>` (nas cores forçadas,
 * sem a cor, que é a do sistema). O anel `auto` do navegador (:focus-visible sem contorno declarado) conta.
 */
export function focusOutline(sheet, classes, element, passName) {
  const pass = FOCUS_PASSES[passName]
  if (!pass) throw new Error(`passada de foco desconhecida: ${passName}`)
  const forced = !!pass.forcedColors
  const engine = sheet.engine(1440, forced, 16)
  const tree = buildTree({
    tag: element.tag ?? 'div',
    classes,
    attrs: element.attrs ?? {},
    state: pass.state ?? {},
  })
  tree.el.inline = INLINE_VARS
  tree.html.inline = { '--font-inter': 'Inter', '--font-jost': 'Jost' }
  if (pass.modality) tree.html.attrs['data-input-modality'] = pass.modality
  const st = engine.styleOf(tree.el, '')
  const style = st['outline-style'] ?? 'none'
  if (st.outline === 'invisível' || style === 'none' || style === '(inicial)')
    return 'nenhum'
  const width = st['outline-width'] ?? '3px'
  const offset = st['outline-offset'] ?? '0px'
  return forced
    ? `${style} ${width} offset ${offset}`
    : `${style} ${width} ${st['outline-color'] ?? 'currentcolor'} offset ${offset}`
}
