import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TesteToastPage } from './TesteToastPage'

describe('TesteToastPage', () => {
  it('mantém o título e seções de demonstração', () => {
    const html = renderToStaticMarkup(createElement(TesteToastPage))
    expect(html).toContain('Teste Completo de Toasts Sonner')
    expect(html).toContain('Toasts Básicos')
    expect(html).toContain('Promise Toast')
    expect(html).toContain('Disparar 5 Toasts Simultâneos')
  })
})
