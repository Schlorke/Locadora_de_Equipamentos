// Termos de Uso no pedido de orçamento (onda 134; decisão do dono D-C, parte 1): com os Termos da locadora publicados,
// o aceite é obrigatório como antes; sem Termos publicados, o pedido segue sem a caixa de aceite (não se afirma aceite
// de texto inexistente); na falha de leitura, o envio fica bloqueado até recarregar.
import { describe, expect, it } from 'vitest'
import { termosDoOrcamento } from './termos-do-orcamento'

const PUBLICADO = {
  status: 'publicado' as const,
  documento: {
    version: 1 as const,
    lastUpdated: 'hoje',
    sections: [
      {
        id: 'a',
        title: 'A',
        blocks: [{ type: 'paragraph' as const, text: 'x' }],
      },
    ],
  },
  publicadoEm: null,
}

describe('termosDoOrcamento', () => {
  it('Termos publicados: aceite obrigatório, sem bloqueio', () => {
    expect(termosDoOrcamento(PUBLICADO)).toEqual({
      exigeAceite: true,
      documento: PUBLICADO.documento,
      bloqueio: null,
    })
  })

  it('Termos ausentes (D-C, parte 1): sem aceite e sem bloqueio', () => {
    expect(termosDoOrcamento({ status: 'ausente' })).toEqual({
      exigeAceite: false,
      documento: null,
      bloqueio: null,
    })
  })

  it('falha de leitura, versão desconhecida ou carregando: envio bloqueado com o motivo', () => {
    expect(termosDoOrcamento({ status: 'erro' })).toEqual({
      exigeAceite: false,
      documento: null,
      bloqueio:
        'Não foi possível carregar os Termos de Uso da locadora. Recarregue a página para enviar a solicitação.',
    })
    expect(termosDoOrcamento({ status: 'versao-nao-suportada' }).bloqueio).toBe(
      'Atualize o aplicativo para ler os Termos de Uso da locadora e enviar a solicitação.'
    )
    expect(termosDoOrcamento({ status: 'carregando' }).bloqueio).toBe(
      'Aguarde o carregamento dos Termos de Uso da locadora para enviar a solicitação.'
    )
  })
})
