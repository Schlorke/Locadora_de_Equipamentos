import { describe, expect, it, vi } from 'vitest'

// O grafo nativo não tem DOM: carregar DOMPurify aqui já é o defeito.
vi.mock('isomorphic-dompurify', () => {
  throw new Error('sanitize.native must not load isomorphic-dompurify')
})
vi.mock('dompurify', () => {
  throw new Error('sanitize.native must not load dompurify')
})

import { sanitizeHtml, sanitizeHtmlStrict } from './sanitize.native'

/** Qualquer início de marcação que um renderizador de HTML interpretaria. */
const MARKUP = /<[A-Za-z!/?]/

const attacks: Array<[string, string, string]> = [
  ['script with content', '<p>ok</p><script>alert(1)</script>', 'ok'],
  ['unclosed script', 'antes<script>alert(1)', 'antes'],
  ['script with spaced end tag', 'a<script type="x">alert(1)</script >b', 'ab'],
  ['event handler', 'foto <img src=x onerror="alert(1)">', 'foto'],
  ['javascript link', '<a href="javascript:alert(1)">clique</a>', 'clique'],
  ['svg onload', '<svg onload="alert(1)"><text>alert(2)</text></svg>fim', 'fim'],
  ['iframe', '<iframe src="https://evil.example.test">x</iframe>ok', 'ok'],
  ['style', '<style>body{background:red}</style>texto', 'texto'],
  ['quoted > inside attribute', '<a title="x>y" onclick=\'a>b\'>link</a>', 'link'],
  ['unterminated tag', 'texto <img src=x onerror=alert(1)', 'texto'],
  ['comment hiding a script', 'a<!-- <script>alert(1)</script> -->b', 'ab'],
  ['unterminated comment', 'a<!-- <img src=x onerror=alert(1)>', 'a'],
  ['tag rebuilt after one pass', '<<b>script>alert(1)<</b>/script>', ''],
  ['nested tag names', '<scr<script>ipt>alert(1)</script>', ''],
  ['doctype and processing', '<!DOCTYPE html><?xml x?>texto', 'texto'],
  // Como no navegador: o noscript termina no primeiro </noscript>.
  ['noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">', '">'],
]

describe('sanitizeHtml (native, sem DOM)', () => {
  it.each(attacks)('%s → só texto', (_name, attack, text) => {
    const safe = sanitizeHtml(attack)
    expect(safe).not.toMatch(MARKUP)
    expect(safe).not.toMatch(/alert\(/)
    expect(safe).toBe(text)
  })

  it('keeps the visible text with line breaks for block elements', () => {
    expect(
      sanitizeHtml(
        '<h2>Título</h2><p>Olá <strong>mundo</strong>,</p>\n  <p>linha 2<br>linha   3</p><ul><li>um</li><li>dois</li></ul>'
      )
    ).toBe('Título\n\nOlá mundo,\n\nlinha 2\nlinha 3\n\num\ndois')
    expect(sanitizeHtml('a<div>b</div><div>c</div>')).toBe('a\nb\nc')
    expect(sanitizeHtml('a<br><br>b<br/><br /><br>c')).toBe('a\n\nb\n\nc')
  })

  it('drops break markers smuggled in the input', () => {
    expect(sanitizeHtml('ab')).toBe('ab')
  })

  it('decodes entities exactly once, as text', () => {
    expect(
      sanitizeHtml('Preço &lt; R$&nbsp;10 &amp;amp; frete &#233; &#x2713; &quot;ok&quot;')
    ).toBe('Preço < R$ 10 &amp; frete é ✓ "ok"')
    expect(sanitizeHtml('&#0; &#x110000; &#xD800;')).toBe('� � �')
  })

  it('keeps a literal < that does not open a tag', () => {
    expect(sanitizeHtml('5 < 6 e 7 > 3')).toBe('5 < 6 e 7 > 3')
  })

  it('ignores the config: no tag survives on native', () => {
    expect(sanitizeHtml('<b>x</b>', { ALLOWED_TAGS: ['b'] })).toBe('x')
    expect(sanitizeHtmlStrict('<p class="c">t <a href="https://x.test">l</a></p>')).toBe('t l')
  })

  it('returns an empty string for non-string input', () => {
    expect(sanitizeHtml(null as unknown as string)).toBe('')
  })
})
