// Documento legal da locadora (contrato `@gb-locacoes/contracts/storefront-legal`) em nós do `DocumentContent` do design
// system (onda 134, lote vitrine-conteúdo). Tags e props são fixas aqui; as classes vêm da página que desenha o
// documento (Privacidade e Devolução têm as delas, as mesmas de antes da troca), nunca do dado. Do documento só saem
// textos, que viram nós de texto do React (nunca HTML, link nem atributo). Com o documento da GB e as classes das
// páginas, a árvore é igual, nó a nó, à das páginas de antes (tests/unit/gb-legal-documents.parity.test.ts).
import {
  storefrontLegalItemParts,
  type StorefrontLegalBlock,
  type StorefrontLegalDocument,
  type StorefrontLegalSection,
} from '@gb-locacoes/contracts/storefront-legal'
import type { DocumentNode } from '@gb-locacoes/ui'

/** Classes de cada parte do documento, definidas pela página que o desenha. */
export interface ClassesDoDocumento {
  /** Cartão da introdução. */
  readonly cartao: string
  /** Cartão de cada seção (o da introdução com o deslocamento da âncora). */
  readonly cartaoDaSecao: string
  readonly conteudo: string
  readonly introducao: string
  readonly textoDaIntroducao: string
  readonly titulo: string
  readonly numero: string
  readonly corpo: string
  /** Corpo da seção que termina com o cartão de contato. */
  readonly corpoComContato: string
  readonly paragrafo: string
  readonly paragrafoComContato: string
  readonly lista: string
}

function bloco(
  block: StorefrontLegalBlock,
  classes: ClassesDoDocumento,
  comContato: boolean
): DocumentNode {
  if (block.type === 'paragraph')
    return {
      tag: 'p',
      props: {
        className: comContato ? classes.paragrafoComContato : classes.paragrafo,
      },
      children: [block.text],
    }
  return {
    tag: 'ul',
    props: { className: classes.lista },
    children: block.items.map((item) => {
      const { lead, text } = storefrontLegalItemParts(item)
      return {
        tag: 'li',
        children:
          lead === null
            ? [text]
            : [{ tag: 'strong', children: [lead] }, ...(text ? [text] : [])],
      }
    }),
  }
}

function secao(
  section: StorefrontLegalSection,
  index: number,
  classes: ClassesDoDocumento
): DocumentNode {
  const comContato = section.contactCard === true
  return {
    tag: 'Card',
    props: { id: section.id, className: classes.cartaoDaSecao },
    children: [
      {
        tag: 'CardContent',
        props: { className: classes.conteudo },
        children: [
          {
            tag: 'h2',
            props: { className: classes.titulo },
            children: [
              {
                tag: 'span',
                props: { className: classes.numero },
                children: [`${index + 1}.`],
              },
              section.title,
            ],
          },
          {
            tag: 'div',
            props: {
              className: comContato ? classes.corpoComContato : classes.corpo,
            },
            children: [
              ...section.blocks.map((block) =>
                bloco(block, classes, comContato)
              ),
              ...(comContato
                ? [
                    section.contactCardNote
                      ? {
                          tag: 'ContactInfoCard',
                          props: { description: section.contactCardNote },
                        }
                      : { tag: 'ContactInfoCard' },
                  ]
                : []),
            ],
          },
        ],
      },
    ],
  }
}

/** Cartão de introdução (se houver) e um cartão por seção, numerado na ordem do documento. */
export function nosDoDocumento(
  documento: StorefrontLegalDocument,
  classes: ClassesDoDocumento
): DocumentNode[] {
  return [
    ...(documento.intro
      ? [
          {
            tag: 'Card',
            props: { className: classes.cartao },
            children: [
              {
                tag: 'CardContent',
                props: { className: classes.conteudo },
                children: [
                  {
                    tag: 'div',
                    props: { className: classes.introducao },
                    children: [
                      {
                        tag: 'p',
                        props: { className: classes.textoDaIntroducao },
                        children: [documento.intro],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]
      : []),
    ...documento.sections.map((section, index) =>
      secao(section, index, classes)
    ),
  ]
}

/** Índice da página (id e título de cada seção, na ordem do documento). */
export function indiceDoDocumento(
  documento: StorefrontLegalDocument
): Array<{ id: string; title: string }> {
  return documento.sections.map(({ id, title }) => ({ id, title }))
}
