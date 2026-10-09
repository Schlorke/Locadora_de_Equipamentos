import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ApiDocsPage } from './ApiDocsPage'

describe('ApiDocsPage', () => {
  it('mostra estado de carregamento antes do fetch', () => {
    const html = renderToStaticMarkup(createElement(ApiDocsPage))
    expect(html).toContain('Carregando documentação da API...')
  })
})
