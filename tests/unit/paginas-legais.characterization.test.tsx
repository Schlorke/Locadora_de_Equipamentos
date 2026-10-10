// Páginas legais da vitrine web: o texto fixo da GB virou o documento de cada locadora (onda 134, lote vitrine-conteúdo,
// B8). A caracterização do B0 gravou, em tests/unit/__fixtures__/paginas-legais/, o HTML estático das três páginas de
// antes da troca, com um contato de teste. Este teste prova que as páginas novas, com o documento da GB
// (tools/gb-site-content.mjs, o que o tools/gb-site-settings.mjs publica), dão exatamente esses arquivos, byte a byte. A
// comparação é por leitura do arquivo (nunca regravação de snapshot): a referência do B0 não muda.
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GB_LEGAL_DOCUMENTS } from '../../tools/gb-site-content.mjs'

vi.mock('../../packages/frontend/src/entities/configuracao', () => ({
  usePublicSettings: () => ({
    settings: {
      companyPhone: '(11) 1234-5678',
      whatsappNumber: '(11) 99999-1111',
      contactEmail: 'contato@tenant.test',
      marketingEmail: '',
      companyAddress: 'Endereço da locadora',
      socialLinks: {},
      heroCarousel: [],
    },
    isLoading: false,
    error: null,
  }),
}))

const FIXTURES = path.resolve('tests/unit/__fixtures__/paginas-legais')
const PUBLICADO_EM = '2026-10-07T12:00:00.000Z'

describe('páginas legais web com o documento da GB (igual ao B0)', () => {
  it('HTML estático das três páginas, byte a byte', async () => {
    const { TermosPage } =
      await import('../../packages/frontend/src/pages/termos/ui/TermosPage.web')
    const { PrivacidadePage } =
      await import('../../packages/frontend/src/pages/privacidade/ui/PrivacidadePage.web')
    const { PoliticaDevolucaoPage } =
      await import('../../packages/frontend/src/pages/politica-devolucao/ui/PoliticaDevolucaoPage.web')
    for (const [name, Page, kind] of [
      ['termos', TermosPage, 'terms'],
      ['privacidade', PrivacidadePage, 'privacy'],
      ['politica-devolucao', PoliticaDevolucaoPage, 'returnPolicy'],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(Page, {
          documento: {
            document: GB_LEGAL_DOCUMENTS[kind] as never,
            publishedAt: PUBLICADO_EM,
          },
        })
      )
      expect(html + '\n', name).toBe(
        // Git stores the reference as LF; normalize only checkout CRLF before the exact markup comparison.
        // Approved class spelling; the historical HTML and every other byte stay fixed.
        fs
          .readFileSync(path.join(FIXTURES, name + '.web.html'), 'utf8')
          .replace(/\r\n/g, '\n')
          .replaceAll('flex-shrink-0', 'shrink-0')
      )
    }
    // Prazo medido: 2,9 s sozinho (o primeiro import das três páginas compila framer-motion e os ícones); passou dos
    // 20 s padrão com o `pnpm test:unit` inteiro em paralelo.
  }, 60_000)

  it('texto malicioso do documento sai como texto (sem HTML, script ou link)', async () => {
    const { TermosPage } =
      await import('../../packages/frontend/src/pages/termos/ui/TermosPage.web')
    const { PrivacidadePage } =
      await import('../../packages/frontend/src/pages/privacidade/ui/PrivacidadePage.web')
    const malicioso = {
      version: 1,
      lastUpdated: '<img src=x onerror=alert(1)>',
      intro: '<script>alert(1)</script>',
      sections: [
        {
          id: 'secao',
          title: '<b>javascript:alert(1)</b>',
          blocks: [
            { type: 'paragraph', text: '&lt;a href="javascript:alert(1)"&gt;' },
            {
              type: 'list',
              items: [
                '<a href="https://evil.example">x</a>',
                { lead: '<i>Rótulo:</i>', text: '<svg onload=alert(1)>' },
              ],
            },
          ],
        },
      ],
    }
    for (const Page of [TermosPage, PrivacidadePage]) {
      const html = renderToStaticMarkup(
        createElement(Page, {
          documento: { document: malicioso as never, publishedAt: null },
        })
      )
      expect(html).not.toMatch(
        /<script|<img|<a href="https:\/\/evil|<svg onload|<b>|<i>|href="javascript/
      )
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).toContain(
        '&amp;lt;a href=&quot;javascript:alert(1)&quot;&amp;gt;'
      )
    }
  }, 60_000)
})
