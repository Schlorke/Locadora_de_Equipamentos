import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('E-mail admin', () => {
  it('mantém títulos, textos Zoho e diálogos de confirmação', () => {
    const source = readFileSync(
      new URL('./EmailAdminPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('title="E-mail"')
    expect(source).toContain(
      'subtitle="Gerencie a caixa Zoho Mail pelo painel"'
    )
    expect(source).toContain('Conectar Zoho Mail')
    // Achado 143: exemplo neutro; o teste anterior afirmava o e-mail da GB no painel de qualquer locadora.
    expect(source).toContain('contato@sualocadora.com.br')
    expect(source).not.toContain('locacoesgb')
    expect(source).toContain('Novo e-mail')
    expect(source).toContain('Excluir permanentemente da lixeira?')
    expect(source).toContain('Marcar como spam?')
    expect(source).toContain('export function AdminEmailPage()')
    expect(source).toContain('<Suspense')
    expect(source).toContain("from './email-layout-container.web'")
    expect(source).toContain("from './email-full-view-dialog.web'")
    expect(source).toContain("from './email-composer-dialog.web'")

    const hook = readFileSync(
      new URL('../model/carga.web.ts', import.meta.url),
      'utf8'
    )
    expect(hook).toContain("from 'next/navigation'")
    expect(hook).toContain('export function useEmailPage()')
    const model = readFileSync(
      new URL('../model/carga.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain('admin-email-search')
    expect(model).toContain('/api/admin/zoho-mail')
    expect(model).toContain("from './tipos'")

    const composer = readFileSync(
      new URL('../model/use-email-composer.ts', import.meta.url),
      'utf8'
    )
    expect(composer).toContain('/api/admin/zoho-mail/attachments/upload')
    expect(composer).toContain('/api/admin/zoho-mail/messages/drafts')
    expect(composer).toContain('/api/admin/zoho-mail/messages/send')
    expect(composer).toContain(
      '/api/admin/zoho-mail/messages/${messageId}/reply'
    )

    const route = readFileSync(
      new URL('../../../../../../app/admin/email/page.tsx', import.meta.url),
      'utf8'
    )
    expect(route).toContain("from '@gb-locacoes/frontend/pages/email-admin'")
    expect(route).toContain('return <AdminEmailPage />')
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/email/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/email-admin["']/
    )
    expect(webRoute).toContain('return <AdminEmailPage />')

    const loading = readFileSync(
      new URL('../../../../../../app/admin/email/loading.tsx', import.meta.url),
      'utf8'
    )
    expect(loading).toContain('export default function AdminEmailLoading()')
    // Onda 135 (A6): o carregamento da rota no host web, pela mesma marcação (AdminEmailLoading da página).
    const webLoading = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/email/loading.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webLoading).toMatch(
      /import \{ AdminEmailLoading \} from ["']@gb-locacoes\/frontend\/pages\/email-admin["']/
    )
    expect(webLoading).toContain('return <AdminEmailLoading />')
  })
})
