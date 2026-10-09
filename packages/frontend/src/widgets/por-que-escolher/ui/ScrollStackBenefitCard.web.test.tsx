// @vitest-environment jsdom
// Selo do cartão de benefício: o nome da própria locadora, nunca o da GB (achado 143). Orbes sem atraso também quando
// o cartão muda de posição (onda 134).
import { cleanup, render } from '@testing-library/react'
import { Shield } from 'lucide-react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { ScrollStackBenefitCard } from './ScrollStackBenefitCard.web'

afterEach(cleanup)

const props = {
  icon: Shield,
  title: 'Equipamentos Certificados',
  description: 'Manutenção preventiva.',
}

describe('ScrollStackBenefitCard', () => {
  it('selo com o nome da locadora', () => {
    const html = renderToStaticMarkup(
      createElement(ScrollStackBenefitCard, {
        ...props,
        marca: 'Locadora Alfa',
      })
    )
    expect(html).toContain('>Locadora Alfa</span>')
    expect(html).toContain('from-gray-700/50')
  })

  it('sem locadora: sem selo, e nunca o nome da GB', () => {
    const html = renderToStaticMarkup(
      createElement(ScrollStackBenefitCard, props)
    )
    expect(html).not.toContain('from-gray-700/50')
    expect(html).not.toMatch(/GB Loca/)
  })
})

describe('orbes do cartão (onda 134)', () => {
  it('trocar a posição do cartão não grava atraso no pulso dos orbes, como na montagem', () => {
    // Os cartões com compromisso entram depois da leitura das configurações, e o "Atendimento Especializado" muda de
    // posição; a produção pulsava os orbes sem atraso (o atalho `animation` zerava o atraso na montagem).
    const view = render(
      createElement(ScrollStackBenefitCard, { ...props, index: 0 })
    )
    view.rerender(createElement(ScrollStackBenefitCard, { ...props, index: 2 }))
    const orbes = Array.from(
      view.container.querySelectorAll<HTMLElement>('[style*="pulse-slow"]')
    )
    expect(orbes).toHaveLength(2)
    for (const orbe of orbes) {
      expect(orbe.getAttribute('style')).not.toContain('animation-delay')
      expect(orbe.style.animationDelay).toBe('')
    }
  })
})
