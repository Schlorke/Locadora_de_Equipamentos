// Página "Política de Privacidade" da vitrine web com o documento da própria locadora (onda 134). A GB igual ao B0 está em
// tests/unit/paginas-legais.characterization.test.tsx; aqui, outra locadora e o documento ausente.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({ hook: { status: 'ausente' } as { status: string } }))
vi.mock('../../../entities/configuracao', () => ({
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
vi.mock('../../../entities/documento-legal', async (original) => {
  const real =
    await original<typeof import('../../../entities/documento-legal')>()
  return {
    ...real,
    useDocumentoLegal: (
      kind: Parameters<typeof real.useDocumentoLegal>[0],
      options: Parameters<typeof real.useDocumentoLegal>[1]
    ) =>
      options?.inicial
        ? real.useDocumentoLegal(kind, options)
        : (estado.hook as ReturnType<typeof real.useDocumentoLegal>),
  }
})
import { PrivacidadePage } from './PrivacidadePage'

const DOCUMENTO = {
  version: 1 as const,
  lastUpdated: '2 de março de 2026',
  intro: 'Texto de abertura da Locadora Nova.',
  sections: [
    {
      id: 'uso',
      title: 'Uso do Site',
      blocks: [
        { type: 'paragraph' as const, text: 'Regras de uso da Locadora Nova.' },
        {
          type: 'list' as const,
          items: ['Item simples', { lead: 'Prazo:', text: 'sete dias.' }],
        },
      ],
    },
    {
      id: 'contato',
      title: 'Fale Conosco',
      blocks: [{ type: 'paragraph' as const, text: 'Use os canais abaixo.' }],
      contactCard: true,
      contactCardNote: 'A Locadora Nova responde por estes canais.',
    },
  ],
}

describe('PrivacidadePage', () => {
  it('outra locadora: título do modelo, data, índice, texto e cartão de contato do documento dela', () => {
    const html = renderToStaticMarkup(
      createElement(PrivacidadePage, {
        documento: { document: DOCUMENTO, publishedAt: null },
      })
    )
    expect(html).toContain('Política de Privacidade')
    expect(html).toContain('Última atualização: 2 de março de 2026')
    expect(html).toContain('Texto de abertura da Locadora Nova.')
    expect(html).toContain('Uso do Site')
    expect(html).toContain('<li>Item simples</li>')
    expect(html).toContain('<li><strong>Prazo:</strong> sete dias.</li>')
    expect(html).toContain('A Locadora Nova responde por estes canais.')
    expect(html).toContain('contato@tenant.test')
    expect(html).not.toMatch(/GB Loca|Porto Alegre|19 de janeiro|23 de Junho|13 de Fevereiro/)
  })

  it('sem documento publicado: o aviso, sem data nem índice', () => {
    estado.hook = { status: 'ausente' }
    const html = renderToStaticMarkup(createElement(PrivacidadePage))
    expect(html).toContain('Política de Privacidade')
    expect(html).toContain('Esta locadora ainda não publicou este documento.')
    expect(html).not.toContain('Última atualização')
    expect(html).not.toContain('<button')
  })
})
