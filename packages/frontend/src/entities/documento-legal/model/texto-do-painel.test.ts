import { describe, expect, it } from 'vitest'
import type { StorefrontLegalBlock } from '@gb-locacoes/contracts/storefront-legal'
import { blocosParaTexto, textoParaBlocos } from './texto-do-painel'

// Sintaxe leve do editor de textos legais (onda 134): ida e volta exata com os blocos do contrato. A ida e volta dos
// três documentos da GB está em tests/unit/gb-site-content.test.ts.
const BARRA = '\\'

describe('texto do painel ↔ blocos', () => {
  it('parágrafos separados por linha em branco; itens com "- "; destaque com "**Rótulo:**"', () => {
    const texto = [
      'A devolução segue o contrato.',
      '',
      '- Equipamento limpo.',
      '- **Locação diária:** devolução no dia seguinte',
      '- **Só o destaque**',
      '',
      'Último parágrafo.',
    ].join('\n')
    const blocos: StorefrontLegalBlock[] = [
      { type: 'paragraph', text: 'A devolução segue o contrato.' },
      {
        type: 'list',
        items: [
          'Equipamento limpo.',
          { lead: 'Locação diária:', text: 'devolução no dia seguinte' },
          { lead: 'Só o destaque', text: '' },
        ],
      },
      { type: 'paragraph', text: 'Último parágrafo.' },
    ]
    expect(textoParaBlocos(texto)).toEqual(blocos)
    expect(blocosParaTexto(blocos)).toBe(texto)
  })

  it('linhas seguidas viram um parágrafo; linhas em branco a mais e CRLF não contam', () => {
    expect(
      textoParaBlocos(
        'Primeira linha\r\nsegunda linha\r\n\r\n\r\n\r\n  Outro.  '
      )
    ).toEqual([
      { type: 'paragraph', text: 'Primeira linha segunda linha' },
      { type: 'paragraph', text: 'Outro.' },
    ])
  })

  it('duas listas seguidas ficam separadas pela linha em branco', () => {
    const blocos: StorefrontLegalBlock[] = [
      { type: 'list', items: ['a'] },
      { type: 'list', items: ['b'] },
    ]
    expect(textoParaBlocos(blocosParaTexto(blocos))).toEqual(blocos)
  })

  it('escapes: "- " e "**" literais, a barra no começo e asteriscos no destaque', () => {
    const blocos: StorefrontLegalBlock[] = [
      { type: 'paragraph', text: '- não é item' },
      { type: 'paragraph', text: BARRA + 'barra no começo' },
      {
        type: 'list',
        items: [
          '**não é destaque**',
          BARRA + 'barra no item',
          '- item que começa com hífen',
          { lead: 'Com *asterisco* e ' + BARRA + 'barra', text: 'resto' },
          { lead: 'a**b', text: '' },
        ],
      },
    ]
    const texto = blocosParaTexto(blocos)
    expect(texto.split('\n\n')[0]).toBe(BARRA + '- não é item')
    expect(textoParaBlocos(texto)).toEqual(blocos)
  })

  it('"**" sem fechamento é texto do item', () => {
    expect(textoParaBlocos('- **sem fechamento')).toEqual([
      { type: 'list', items: ['**sem fechamento'] },
    ])
    expect(textoParaBlocos('- ****')).toEqual([
      { type: 'list', items: ['****'] },
    ])
  })

  it('HTML e link continuam texto', () => {
    const texto = '<script>alert(1)</script>\n\n- [link](javascript:alert(1))'
    expect(textoParaBlocos(texto)).toEqual([
      { type: 'paragraph', text: '<script>alert(1)</script>' },
      { type: 'list', items: ['[link](javascript:alert(1))'] },
    ])
  })

  it('texto vazio: nenhum bloco', () => {
    expect(textoParaBlocos('')).toEqual([])
    expect(textoParaBlocos('\n\n  \n')).toEqual([])
  })
})
