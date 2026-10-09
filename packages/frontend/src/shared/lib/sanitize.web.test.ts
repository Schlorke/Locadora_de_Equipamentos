import { describe, expect, it } from 'vitest'
import * as universal from './sanitize'
import * as native from './sanitize.native'
import * as web from './sanitize.web'

const { sanitizeHtml, sanitizeHtmlStrict } = web

/** Vetores clássicos de XSS; nenhum pode sair executável da variante web. */
const attacks = [
  '<p>ok</p><script>alert(1)</script>',
  '<img src="https://cdn.example.test/a.png" onerror="alert(1)">',
  '<a href="javascript:alert(1)">clique</a>',
  '<a href="JaVaScRiPt:alert(1)">clique</a>',
  '<svg onload="alert(1)"><circle></circle></svg>',
  '<iframe src="https://evil.example.test"></iframe>',
  '<style>body{background:url(javascript:alert(1))}</style>texto',
  '<div onclick="alert(1)" style="color:red">texto</div>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<form action="javascript:alert(1)"><button>ir</button></form>',
]

describe('sanitizeHtml (web, DOMPurify)', () => {
  it.each(attacks)('neutraliza %s', (attack) => {
    const safe = sanitizeHtml(attack)
    expect(safe).not.toMatch(
      /<script|<iframe|<svg|<style|<form|\son\w+\s*=|javascript:/i
    )
  })

  it('removes the script element together with its content', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe(
      '<p>ok</p>'
    )
    expect(
      sanitizeHtml('<img src="https://cdn.example.test/a.png" onerror="x()">')
    ).toBe('<img src="https://cdn.example.test/a.png">')
    expect(sanitizeHtml('<a href="javascript:alert(1)">clique</a>')).toBe(
      '<a>clique</a>'
    )
  })

  it('keeps the allowed formatting, links and escaped text untouched', () => {
    const content =
      '<p><strong>Olá</strong> <em>mundo</em> <a href="https://gb.example.test/x" target="_blank" rel="noopener">link</a></p><ul><li>item</li></ul>'
    expect(sanitizeHtml(content)).toBe(content)
    expect(sanitizeHtml('5 &lt; 6 &amp;&amp; &lt;script&gt;')).toBe(
      '5 &lt; 6 &amp;&amp; &lt;script&gt;'
    )
  })

  it('strict mode keeps only text formatting', () => {
    expect(
      sanitizeHtmlStrict(
        '<p class="c" id="i">t <a href="https://x.test">l</a><img src="https://x.test/i.png"></p>'
      )
    ).toBe('<p class="c">t l</p>')
  })

  it('returns an empty string for non-string input', () => {
    expect(sanitizeHtml(undefined as unknown as string)).toBe('')
  })
})

describe('sanitize contract', () => {
  it('web and native expose the same API and the universal entry is the web one', () => {
    expect(Object.keys(native).sort()).toEqual(Object.keys(web).sort())
    expect(Object.keys(universal).sort()).toEqual(Object.keys(web).sort())
    expect(universal.sanitizeHtml).toBe(web.sanitizeHtml)
    expect(universal.sanitizeHtmlStrict).toBe(web.sanitizeHtmlStrict)
    expect(native.isSafeJsonLd).toBe(web.isSafeJsonLd)
  })

  it('isSafeJsonLd rejects script-like JSON-LD on both platforms', () => {
    expect(web.isSafeJsonLd({ '@type': 'Organization', name: 'GB' })).toBe(
      true
    )
    expect(web.isSafeJsonLd({ name: '</script><script>alert(1)' })).toBe(false)
    expect(web.isSafeJsonLd({ url: 'javascript:alert(1)' })).toBe(false)
  })
})
