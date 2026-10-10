import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminEmailLoading } from './EmailAdminPage.web'

/**
 * Carregamento da rota de e-mail do painel (onda 135, A6; M2 do plano de aposentadoria da raiz). A raiz legada tinha o
 * antigo `app/admin/email/loading.tsx`, retirado em F; o host web não tinha nenhum. A marcação foi preservada
 * como literal neste teste e no fallback da página, exportado para o `loading.tsx` atual do host web.
 */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8')
const classesOf = (markup: string, attribute: 'class' | 'className') =>
  [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(
    (match) => match[1]
  )

describe('carregamento do e-mail do painel', () => {
  it('desenha o spinner preservado do carregamento de e-mail', () => {
    // Values characterized from the preserved root snapshot; no live root read after F.
    expect(
      classesOf(renderToStaticMarkup(<AdminEmailLoading />), 'class')
    ).toEqual([
      'min-h-screen bg-gray-50 flex items-center justify-center',
      'h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-orange-600',
    ])
  })

  it('é o fallback da própria página e sai pela entrada pública da página', () => {
    const source = read('./EmailAdminPage.web.tsx')
    expect(source).toMatch(/<Suspense\s+fallback=\{<AdminEmailLoading \/>\}/)
    expect(read('../index.ts')).toMatch(
      /export \{ AdminEmailPage, AdminEmailLoading \} from ["']\.\/ui\/EmailAdminPage\.web["']/
    )
  })
})
