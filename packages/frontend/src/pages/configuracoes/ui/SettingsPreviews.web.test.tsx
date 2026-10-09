// Prévia "Como aparece no Google" do painel (achado 146): sem nota nem contagem de avaliações inventadas. O bloco
// mostrava "4.9 · 500+ avaliações" e cinco estrelas ao lado do nome de qualquer locadora selecionada; sem fonte de
// avaliações por locadora, a linha fica de fora.
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}))
vi.mock('./HeaderFooterPreview.web', () => ({
  HeaderFooterPreview: () => null,
}))

import { CompanyInfoPreview } from './SettingsPreviews.web'

describe('CompanyInfoPreview (prévia SEO)', () => {
  it('mostra o nome e o contato da locadora selecionada, sem nota nem contagem de avaliações', () => {
    const html = renderToStaticMarkup(
      <CompanyInfoPreview
        data={{
          name: 'Locadora Nova',
          description: 'Andaimes e betoneiras em Curitiba.',
          phone: '(41) 3000-0000',
          email: 'contato@locadora-nova.example.test',
        }}
      />
    )
    expect(html).toContain('Como aparece no Google')
    expect(html).toContain('>LN<')
    expect(html).toContain('Locadora Nova - Locação de Equipamentos para')
    expect(html).toContain('(41) 3000-0000')
    // Só o texto visível (as classes têm números, como gap-1.5).
    const texto = html.replace(/<[^>]*>/g, ' ')
    expect(texto).not.toMatch(/avalia[cç][oõ]es/i)
    expect(texto).not.toMatch(/\b\d[.,]\d\b/)
    expect(texto).not.toMatch(/\d+\+/)
    expect(html).not.toContain('fill-current')
  })
})
