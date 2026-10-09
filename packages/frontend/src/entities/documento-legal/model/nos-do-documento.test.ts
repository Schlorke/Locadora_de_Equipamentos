import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { StorefrontLegalDocument } from '@gb-locacoes/contracts/storefront-legal'
import { DocumentContent, type DocumentNode } from '@gb-locacoes/ui'
import {
  CLASSES_DA_DEVOLUCAO,
  CLASSES_DA_PRIVACIDADE,
} from '../../../../../../tests/helpers/paginas-legais-classes'
import { indiceDoDocumento, nosDoDocumento } from './nos-do-documento'

const CLASSES = {
  privacidade: CLASSES_DA_PRIVACIDADE,
  devolucao: CLASSES_DA_DEVOLUCAO,
} as const

// Onda 134 (lote vitrine-conteúdo): o texto legal da locadora vira nós com tags e classes fixas no código; do dado só
// saem nós de texto. A igualdade com as páginas de antes, para o documento da GB, está em
// tests/unit/gb-legal-documents.parity.test.ts.
const CARGA =
  '<script>alert(1)</script> <img src=x onerror=alert(1)> javascript:alert(1) &amp;'
const documento: StorefrontLegalDocument = {
  version: 1,
  lastUpdated: '1 de janeiro de 2026',
  intro: CARGA,
  sections: [
    {
      id: 'condicoes',
      title: CARGA,
      blocks: [
        { type: 'paragraph', text: CARGA },
        {
          type: 'list',
          items: [
            CARGA,
            { lead: 'Locação diária:', text: 'devolução no dia seguinte' },
            { lead: 'Só o destaque', text: '' },
          ],
        },
      ],
    },
    {
      id: 'contato',
      title: 'Contato',
      blocks: [{ type: 'paragraph', text: 'Fale conosco:' }],
      contactCard: true,
      contactCardNote: CARGA,
    },
  ],
}

/** Todas as tags e props da árvore, e os textos dela. */
function percorrer(nos: DocumentNode[]) {
  const tags = new Set<string>()
  const props: Array<Record<string, unknown>> = []
  const textos: string[] = []
  const visitar = (no: DocumentNode) => {
    if (typeof no === 'string') {
      textos.push(no)
      return
    }
    tags.add(no.tag)
    if (no.props) props.push(no.props)
    no.children?.forEach(visitar)
  }
  nos.forEach(visitar)
  return { tags, props, textos }
}

describe('nosDoDocumento', () => {
  it('só as tags fixas das páginas; nenhuma vem do documento', () => {
    for (const variante of ['privacidade', 'devolucao'] as const) {
      const { tags, props } = percorrer(
        nosDoDocumento(documento, CLASSES[variante])
      )
      expect([...tags].sort()).toEqual(
        [
          'Card',
          'CardContent',
          'ContactInfoCard',
          'div',
          'h2',
          'li',
          'p',
          'span',
          'strong',
          'ul',
        ].sort()
      )
      // Props só id (do contrato, kebab-case), className fixa e a descrição do cartão de contato (texto).
      for (const prop of props)
        for (const chave of Object.keys(prop))
          expect(['id', 'className', 'description']).toContain(chave)
      expect(
        props.filter((prop) => 'id' in prop).map((prop) => prop.id)
      ).toEqual(['condicoes', 'contato'])
    }
  })

  it('chave estranha no dado (tag, props, html) nunca vira tag nem atributo', () => {
    // Um documento lido sem o contrato, com campos a mais em cada nível: nada deles chega à árvore.
    const injetado = {
      ...documento,
      tag: 'iframe',
      sections: documento.sections.map((section) => ({
        ...section,
        tag: 'script',
        props: { dangerouslySetInnerHTML: { __html: '<b>x</b>' } },
        blocks: section.blocks.map((block) => ({
          ...block,
          tag: 'script',
          props: { onClick: 'alert(1)', href: 'javascript:alert(1)' },
        })),
      })),
    } as unknown as StorefrontLegalDocument
    for (const variante of ['privacidade', 'devolucao'] as const) {
      const nos = nosDoDocumento(injetado, CLASSES[variante])
      expect(nos).toEqual(nosDoDocumento(documento, CLASSES[variante]))
      const { tags, props } = percorrer(nos)
      expect(tags.has('script')).toBe(false)
      expect(tags.has('iframe')).toBe(false)
      expect(JSON.stringify(props)).not.toMatch(
        /dangerouslySetInnerHTML|onClick|href/
      )
    }
  })

  it('texto malicioso sai como texto: o HTML gerado escapa a carga', () => {
    const nos = nosDoDocumento(documento, CLASSES.privacidade)
    const { textos } = percorrer(nos)
    expect(textos).toContain(CARGA)
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        ...nos.slice(0, 2).map((node, key) =>
          createElement(DocumentContent, {
            key,
            node,
            components: {
              Card: 'section',
              CardContent: 'div',
              ContactInfoCard: 'aside',
            } as never,
          })
        )
      )
    )
    expect(html).not.toMatch(/<script|<img/)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&amp;amp;')
  })

  it('item com destaque: <strong> e o texto com um espaço antes; sem texto, sem o espaço', () => {
    const lista = (
      (
        (
          nosDoDocumento(documento, CLASSES.devolucao)[1] as {
            children: DocumentNode[]
          }
        ).children[0] as { children: DocumentNode[] }
      ).children[1] as { children: DocumentNode[] }
    ).children[1] as { children: DocumentNode[] }
    expect(lista.children).toEqual([
      { tag: 'li', children: [CARGA] },
      {
        tag: 'li',
        children: [
          { tag: 'strong', children: ['Locação diária:'] },
          ' devolução no dia seguinte',
        ],
      },
      { tag: 'li', children: [{ tag: 'strong', children: ['Só o destaque'] }] },
    ])
  })

  it('a lista muda de classe entre Privacidade e Devolução; o resto é igual', () => {
    const classes = (variante: 'privacidade' | 'devolucao') =>
      percorrer(nosDoDocumento(documento, CLASSES[variante])).props.map(
        (prop) => prop.className
      )
    const privacidade = classes('privacidade')
    const devolucao = classes('devolucao')
    expect(privacidade).toContain('list-disc list-inside space-y-2 ml-4')
    expect(devolucao).toContain(
      'list-disc list-inside space-y-2 ml-4 text-[16px] text-gray-700'
    )
    expect(privacidade.length).toBe(devolucao.length)
  })

  it('seção com o cartão de contato: corpo e parágrafos com as classes da seção de contato; nota no cartão', () => {
    const contato = nosDoDocumento(documento, CLASSES.privacidade)[2]!
    expect(contato).toMatchObject({
      tag: 'Card',
      props: { id: 'contato' },
      children: [
        {
          tag: 'CardContent',
          children: [
            { tag: 'h2', children: [{ children: ['2.'] }, 'Contato'] },
            {
              tag: 'div',
              props: { className: 'space-y-4' },
              children: [
                {
                  tag: 'p',
                  props: {
                    className: 'text-[16px] text-gray-700 leading-relaxed',
                  },
                  children: ['Fale conosco:'],
                },
                { tag: 'ContactInfoCard', props: { description: CARGA } },
              ],
            },
          ],
        },
      ],
    })
    // Sem nota, o cartão sem props (a descrição padrão do widget).
    const semNota = nosDoDocumento(
      {
        ...documento,
        sections: [{ ...documento.sections[1]!, contactCardNote: undefined }],
      },
      CLASSES.privacidade
    )
    const corpo = (
      (semNota[1] as { children: DocumentNode[] }).children[0] as {
        children: DocumentNode[]
      }
    ).children[1] as { children: DocumentNode[] }
    expect(corpo.children.at(-1)).toEqual({ tag: 'ContactInfoCard' })
  })

  it('sem introdução, sem o cartão de introdução; o índice segue o documento', () => {
    const semIntro = nosDoDocumento(
      { ...documento, intro: undefined },
      CLASSES.devolucao
    )
    expect(semIntro).toHaveLength(2)
    expect(indiceDoDocumento(documento)).toEqual([
      { id: 'condicoes', title: CARGA },
      { id: 'contato', title: 'Contato' },
    ])
  })
})
