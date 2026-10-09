// Paridade dos textos legais da GB (onda 134, lote vitrine-conteúdo): o documento da GB (tools/gb-site-content.mjs), pelo
// `nosDoDocumento` do frontend, dá exatamente as árvores DocumentNode das páginas de Privacidade e de Devolução de antes
// da troca (caracterização do B0 em tests/unit/__fixtures__/paginas-legais/), nó a nó: tags, classes, numeração, a
// descrição do cartão de contato e os textos dos itens com destaque, que começam por espaço. O HTML e a árvore do app
// entram junto com a troca das páginas (B8).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  indiceDoDocumento,
  nosDoDocumento,
} from '../../packages/frontend/src/entities/documento-legal'
import { GB_LEGAL_DOCUMENTS } from '../../tools/gb-site-content.mjs'
import {
  CLASSES_DA_DEVOLUCAO,
  CLASSES_DA_PRIVACIDADE,
} from '../helpers/paginas-legais-classes'

const fixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '__fixtures__',
        'paginas-legais',
        name
      ),
      'utf8'
    )
  ) as {
    metadata: { updatedAt: string }
    sections: Array<{ id: string; title: string }>
    documentBlocks: unknown[]
  }

describe.each([
  ['privacy', CLASSES_DA_PRIVACIDADE, 'privacidade.document-blocks.json'],
  [
    'returnPolicy',
    CLASSES_DA_DEVOLUCAO,
    'politica-devolucao.document-blocks.json',
  ],
] as const)('%s da GB', (kind, classes, arquivo) => {
  const antes = fixture(arquivo)
  const documento = GB_LEGAL_DOCUMENTS[kind]

  it('a árvore é a mesma de antes da troca, nó a nó', () => {
    expect(nosDoDocumento(documento as never, classes)).toStrictEqual(
      antes.documentBlocks
    )
  })

  it('o índice e a data são os mesmos', () => {
    expect(indiceDoDocumento(documento as never)).toEqual(antes.sections)
    expect(documento.lastUpdated).toBe(antes.metadata.updatedAt)
  })
})
