import { describe, expect, it } from 'vitest'
import { linksDeContato } from './contato'

describe('linksDeContato (site em pausa, S13)', () => {
  it('telefone, WhatsApp e e-mail na ordem, com as convenções da vitrine', () => {
    expect(
      linksDeContato({
        telefone: ' (51) 3333-0000 ',
        whatsapp: '(51) 99999-0000',
        email: ' contato@locadora.test ',
      })
    ).toEqual([
      {
        rotulo: 'Telefone',
        valor: '(51) 3333-0000',
        href: 'tel:+555133330000',
      },
      {
        rotulo: 'WhatsApp',
        valor: '(51) 99999-0000',
        href: 'https://wa.me/5551999990000',
      },
      {
        rotulo: 'E-mail',
        valor: 'contato@locadora.test',
        href: 'mailto:contato@locadora.test',
      },
    ])
  })

  it('valor vazio, sem dígitos ou e-mail inválido fica de fora', () => {
    expect(
      linksDeContato({
        telefone: '  ',
        whatsapp: 'sem número',
        email: 'contato',
      })
    ).toEqual([])
    expect(linksDeContato({})).toEqual([])
  })
})
