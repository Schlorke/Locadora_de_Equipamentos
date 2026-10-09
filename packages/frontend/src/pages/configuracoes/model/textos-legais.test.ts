// Editor dos textos legais no painel (onda 134, B10): documento publicado ↔ formulário (sintaxe leve por seção), id
// estável das seções, data do dia ao editar e a validação do contrato antes de publicar.
import { describe, expect, it } from 'vitest'
import {
  dataPorExtenso,
  documentoDoFormulario,
  formularioDoDocumento,
  formularioNovo,
  moverSecao,
  type FormularioDoTexto,
} from './textos-legais'

// Documento de teste com abertura, parágrafos, lista com destaque e cartão de contato com nota. A ida e volta dos três
// documentos da GB está em tests/unit/gb-site-content.painel.test.ts.
const DOCUMENTO = {
  version: 1,
  lastUpdated: '2 de março de 2026',
  intro: 'Texto de abertura da Locadora Teste.',
  sections: [
    {
      id: 'uso',
      title: 'Uso do Site',
      blocks: [
        { type: 'paragraph', text: 'Primeiro parágrafo.' },
        { type: 'paragraph', text: 'Segundo parágrafo.' },
        {
          type: 'list',
          items: ['Item simples', { lead: 'Prazo:', text: 'sete dias.' }],
        },
      ],
    },
    {
      id: 'pagamento',
      title: 'Pagamento',
      blocks: [{ type: 'paragraph', text: 'Boleto ou Pix.' }],
    },
    {
      id: 'contato',
      title: 'Fale Conosco',
      blocks: [{ type: 'paragraph', text: 'Use os canais abaixo.' }],
      contactCard: true,
      contactCardNote: 'A Locadora Teste responde por estes canais.',
    },
  ],
}

describe('textos legais no painel', () => {
  it('ida e volta sem perda: abertura, parágrafos, lista com destaque e cartão de contato', () => {
    const documento = JSON.parse(JSON.stringify(DOCUMENTO))
    const form = formularioDoDocumento(documento)
    expect(documentoDoFormulario(form)).toEqual({ documento, erro: null })
  })

  it('documento novo: data do dia por extenso, uma seção vazia; publicar exige texto', () => {
    const form = formularioNovo(new Date(2026, 9, 7))
    expect(form.lastUpdated).toBe('7 de outubro de 2026')
    expect(form.secoes).toHaveLength(1)
    expect(documentoDoFormulario(form)).toEqual({
      documento: null,
      erro: 'Cada seção precisa de título e texto.',
    })
  })

  it('seção nova ganha id pelo título, sem repetir; nota do cartão só com o cartão', () => {
    const form: FormularioDoTexto = {
      lastUpdated: '1 de março de 2026',
      intro: '',
      secoes: [
        {
          id: '',
          titulo: 'Prazo de Devolução',
          texto: 'Sete dias.',
          cartao: false,
          nota: 'ignorada',
        },
        {
          id: '',
          titulo: 'Prazo de devolução',
          texto: '- **Prazo:** sete dias',
          cartao: true,
          nota: '',
        },
      ],
    }
    expect(documentoDoFormulario(form).documento).toEqual({
      version: 1,
      lastUpdated: '1 de março de 2026',
      sections: [
        {
          id: 'prazo-de-devolucao',
          title: 'Prazo de Devolução',
          blocks: [{ type: 'paragraph', text: 'Sete dias.' }],
        },
        {
          id: 'prazo-de-devolucao-2',
          title: 'Prazo de devolução',
          blocks: [
            { type: 'list', items: [{ lead: 'Prazo:', text: 'sete dias' }] },
          ],
          contactCard: true,
        },
      ],
    })
  })

  it('texto com caractere de controle ou acima do limite: erro do contrato, nada publicado', () => {
    const form = formularioNovo(new Date(2026, 0, 1))
    form.secoes[0] = {
      id: 'a',
      titulo: 'A',
      texto: 'x'.repeat(5001),
      cartao: false,
      nota: '',
    }
    expect(documentoDoFormulario(form)).toEqual({
      documento: null,
      erro: 'O documento não está no formato aceito: confira os tamanhos e os caracteres de cada campo.',
    })
  })

  it('subir e descer seções', () => {
    const form = formularioDoDocumento(JSON.parse(JSON.stringify(DOCUMENTO)))
    const ids = form.secoes.map((secao) => secao.id)
    expect(moverSecao(form, 1, -1).secoes.map((secao) => secao.id)).toEqual([
      ids[1],
      ids[0],
      ...ids.slice(2),
    ])
    expect(moverSecao(form, 0, -1)).toBe(form)
    expect(moverSecao(form, ids.length - 1, 1)).toBe(form)
  })

  it('data por extenso no formato que a vitrine mostra', () => {
    expect(dataPorExtenso(new Date(2026, 0, 19))).toBe('19 de janeiro de 2026')
    expect(dataPorExtenso(new Date(2026, 11, 1))).toBe('1 de dezembro de 2026')
  })
})
