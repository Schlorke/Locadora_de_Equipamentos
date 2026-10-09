// Aviso das páginas legais quando o documento da locadora não pode ser mostrado (onda 134): ausente (a locadora não
// publicou), versão que o app não conhece (pede atualização), erro de leitura e carregamento. Publicado: sem aviso.
import { describe, expect, it } from 'vitest'
import { avisoDoDocumentoLegal } from './aviso'

describe('avisoDoDocumentoLegal', () => {
  it('cada estado tem o seu aviso; publicado não tem aviso', () => {
    expect(avisoDoDocumentoLegal({ status: 'ausente' })).toBe(
      'Esta locadora ainda não publicou este documento.'
    )
    expect(avisoDoDocumentoLegal({ status: 'versao-nao-suportada' })).toBe(
      'Atualize o aplicativo para ler este documento.'
    )
    expect(avisoDoDocumentoLegal({ status: 'erro' })).toBe(
      'Não foi possível carregar este documento. Tente novamente mais tarde.'
    )
    expect(avisoDoDocumentoLegal({ status: 'carregando' })).toBe(
      'Carregando documento...'
    )
    expect(
      avisoDoDocumentoLegal({
        status: 'publicado',
        documento: {
          version: 1,
          lastUpdated: 'hoje',
          sections: [
            { id: 'a', title: 'A', blocks: [{ type: 'paragraph', text: 'x' }] },
          ],
        },
        publicadoEm: null,
      })
    ).toBeNull()
  })
})
