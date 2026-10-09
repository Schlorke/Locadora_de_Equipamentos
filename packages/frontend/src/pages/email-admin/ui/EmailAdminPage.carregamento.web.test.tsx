import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminEmailLoading } from './EmailAdminPage.web'

/**
 * Carregamento da rota de e-mail do painel (onda 135, A6; M2 do plano de aposentadoria da raiz). A raiz legada tinha o
 * `app/admin/email/loading.tsx`; o host web não tinha nenhum. A marcação é a do fallback que a página já usava (a
 * mesma do arquivo da raiz), agora exportada para o `loading.tsx` do host web.
 */
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8')
const classesOf = (markup: string, attribute: 'class' | 'className') =>
  [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(
    (match) => match[1]
  )

describe('carregamento do e-mail do painel', () => {
  it('desenha o mesmo spinner do loading.tsx da raiz legada', () => {
    const legacy = read('../../../../../../app/admin/email/loading.tsx')
    const legacyClasses = classesOf(legacy, 'className')
    expect(legacyClasses).toHaveLength(2)
    expect(
      classesOf(renderToStaticMarkup(<AdminEmailLoading />), 'class')
    ).toEqual(legacyClasses)
  })

  it('é o fallback da própria página e sai pela entrada pública da página', () => {
    const source = read('./EmailAdminPage.web.tsx')
    expect(source).toMatch(/<Suspense\s+fallback=\{<AdminEmailLoading \/>\}/)
    expect(read('../index.ts')).toMatch(
      /export \{ AdminEmailPage, AdminEmailLoading \} from ["']\.\/ui\/EmailAdminPage\.web["']/
    )
  })
})
