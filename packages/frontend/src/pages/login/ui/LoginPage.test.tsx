import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import { LoginPage, LoginPageFallback } from './LoginPage'

const adapter = {
  getSession: async () => null,
  signInCredentials: async () => ({ ok: true }),
  replace: () => undefined,
}
// Nome sem a palavra do nome provisório da plataforma (a casca da vitrine nunca mostra PLATFORM.displayName).
const LOCADORA = { nome: 'Andaimes Sul', cidade: null, uf: null, logoUrl: null }
/** Login na vitrine de uma locadora: a identidade vem do cartão público (achado 143). */
const naVitrine = (props: Parameters<typeof LoginPage>[0]) =>
  renderToStaticMarkup(
    createElement(IdentidadePublicaProvider, {
      value: LOCADORA,
      children: createElement(LoginPage, props),
    })
  )

describe('LoginPage', () => {
  it('modo de reautenticação informa que o pedido ainda precisa ser revisado no painel', () => {
    const html = renderToStaticMarkup(
      createElement(LoginPage, {
        ...adapter,
        requireReauthentication: true,
        shell: 'platform',
      })
    )
    expect(html).toContain('Confirme sua identidade')
    expect(html).toContain('Depois, revise e confirme o pedido no painel.')
    expect(html).toContain('Entrar no Sistema')
  })
  it('mantém o título, o botão e os links', () => {
    const html = naVitrine(adapter)
    expect(html).toContain('Entrar')
    expect(html).toContain('Entrar no Sistema')
    expect(html).toContain('placeholder="seu@email.com"')
    expect(html).toContain('href="/cadastro"')
    expect(html).toContain('href="/recuperar-senha"')
    // O teste anterior afirmava o rodapé fixo da GB para qualquer locadora.
    expect(html).toContain('© 2024 Andaimes Sul - Sistema de Acesso')
    expect(html).not.toContain('GB Locações')
  })

  it('vitrine sem locadora identificada: nem sigla nem rodapé de outra locadora', () => {
    const html = renderToStaticMarkup(createElement(LoginPage, adapter))
    expect(html).toContain('>Sistema de Acesso<')
    expect(html).not.toMatch(/GB Loca|>\s*GB\s*</)
  })

  it('preserva o callback no link de cadastro', () => {
    const html = renderToStaticMarkup(
      createElement(LoginPage, { ...adapter, callbackUrl: '/equipamentos' })
    )
    expect(html).toContain('href="/cadastro?callbackUrl=%2Fequipamentos"')
  })

  it('sem cadastro (login da equipe no host app): some só o convite; formulário e recuperação continuam', () => {
    const html = renderToStaticMarkup(
      createElement(LoginPage, {
        ...adapter,
        callbackUrl: '/admin',
        allowSignUp: false,
      })
    )
    expect(html).not.toContain('/cadastro')
    expect(html).not.toContain('Não tem uma conta?')
    expect(html).toContain('Entrar no Sistema')
    expect(html).toContain('href="/recuperar-senha"')
  })

  it('na vitrine (padrão) nada muda: sobe sob o cabeçalho fixo e mostra a marca da locadora', () => {
    const html = naVitrine(adapter)
    expect(html).toContain(
      '<div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 md:-mt-[96px]">'
    )
    expect(html).toContain('<div class="mx-auto flex h-16 w-16 items-center')
    expect(html).toMatch(/>\s*AS\s*<\/span>/)
    expect(html).not.toContain(PLATFORM.displayName)
  })

  it("na casca da plataforma: o nome da plataforma no lugar de 'GB' e do rodapé da locadora, sem o deslocamento do cabeçalho da vitrine", () => {
    const html = renderToStaticMarkup(
      createElement(LoginPage, {
        ...adapter,
        callbackUrl: '/admin',
        allowSignUp: false,
        shell: 'platform',
      })
    )
    expect(html).toMatch(new RegExp(`>\\s*${PLATFORM.displayName}\\s*</span>`))
    expect(html).toContain(`${PLATFORM.displayName} - Sistema de Acesso`)
    expect(html).not.toMatch(/>\s*GB\s*</)
    expect(html).not.toContain('GB Locações')
    expect(html).not.toContain('-mt-[96px]')
    expect(html).not.toContain('min-h-screen')
    expect(html).toContain(
      '<div class="flex flex-1 flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">'
    )
    expect(html).toContain('Entrar no Sistema')
    expect(html).toContain('href="/recuperar-senha"')
  })

  it('a espera da rota acompanha a casca: ocupa a janela na vitrine e o espaço abaixo da barra na plataforma', () => {
    expect(renderToStaticMarkup(createElement(LoginPageFallback))).toContain(
      'class="min-h-screen bg-gradient-to-br'
    )
    const platform = renderToStaticMarkup(
      createElement(LoginPageFallback, { shell: 'platform' })
    )
    expect(platform).toContain('class="flex-1 bg-gradient-to-br')
    expect(platform).not.toContain('min-h-screen')
  })

  it('a espera da rota anuncia o carregamento com a cor da marca, sem paleta solta', () => {
    const html = renderToStaticMarkup(createElement(LoginPageFallback))
    expect(html).toContain('role="status"')
    expect(html).toContain('Carregando...')
    expect(html).toContain('border-brand')
    expect(html).not.toContain('orange-600')
  })
})
