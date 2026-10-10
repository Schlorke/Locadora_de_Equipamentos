import { describe, expect, it } from 'vitest'
import {
  ADMIN_FINANCIAL_HOME,
  ADMIN_LOGIN_REDIRECT,
  resolveAdminIndexRedirect,
  resolveAdminLoginRedirect,
  resolveAdminRoleRedirect,
} from './redirect'

describe('redirects de entrada do admin', () => {
  it('login admin vai para o login universal', () => {
    expect(ADMIN_LOGIN_REDIRECT).toBe('/login')
  })

  it('admin autenticado vai ao dashboard e anônimo ao login', () => {
    expect(resolveAdminIndexRedirect('authenticated', true)).toBe(
      '/admin/dashboard'
    )
    expect(resolveAdminIndexRedirect('unauthenticated', false)).toBe(
      '/admin/login'
    )
    expect(resolveAdminIndexRedirect('loading', false)).toBeNull()
    expect(resolveAdminIndexRedirect('authenticated', false)).toBeNull()
  })

  it('/admin/login espera a sessão e segue para o login universal', () => {
    expect(resolveAdminLoginRedirect('loading')).toBeNull()
    expect(resolveAdminLoginRedirect('authenticated')).toBe(
      ADMIN_LOGIN_REDIRECT
    )
    expect(resolveAdminLoginRedirect('unauthenticated')).toBe(
      ADMIN_LOGIN_REDIRECT
    )
  })
})

// Onda 135 (A6; M1 do plano de aposentadoria da raiz): o layout do painel da raiz legada mandava o FINANCIAL para o
// financeiro (antiga app/admin/admin-layout-client.tsx retirada em F) e as configurações só abriam para ADMIN
// (antiga app/admin/settings/layout.tsx retirada em F, que devolvia os outros papéis a /admin).
// O papel é o do vínculo com a locadora selecionada, nunca o User.role global.
describe('papel do vínculo nas rotas do painel', () => {
  it('FINANCIAL vai ao financeiro de qualquer rota do painel', () => {
    for (const path of [
      '/admin',
      '/admin/dashboard',
      '/admin/orcamentos/orc-1',
      '/admin/settings',
      '/admin/financeiros',
    ])
      expect(resolveAdminRoleRedirect(path, 'FINANCIAL')).toBe(
        ADMIN_FINANCIAL_HOME
      )
    expect(ADMIN_FINANCIAL_HOME).toBe('/admin/financeiro')
  })

  it('FINANCIAL fica no financeiro e nas subrotas dele', () => {
    expect(
      resolveAdminRoleRedirect('/admin/financeiro', 'FINANCIAL')
    ).toBeNull()
    expect(
      resolveAdminRoleRedirect('/admin/financeiro/lancamentos', 'FINANCIAL')
    ).toBeNull()
  })

  it('configurações só para ADMIN; os outros papéis voltam ao índice do painel', () => {
    expect(resolveAdminRoleRedirect('/admin/settings', 'ADMIN')).toBeNull()
    expect(resolveAdminRoleRedirect('/admin/settings', 'OPERATOR')).toBe(
      '/admin'
    )
    expect(resolveAdminRoleRedirect('/admin/settings/textos', 'OPERATOR')).toBe(
      '/admin'
    )
    expect(resolveAdminRoleRedirect('/admin/settings', 'CLIENT')).toBe('/admin')
    expect(resolveAdminRoleRedirect('/admin/settingsx', 'OPERATOR')).toBeNull()
  })

  it('ADMIN e OPERATOR seguem nas demais rotas', () => {
    for (const role of ['ADMIN', 'OPERATOR'])
      for (const path of [
        '/admin',
        '/admin/dashboard',
        '/admin/financeiro',
        '/admin/equipamentos/novo',
      ])
        expect(resolveAdminRoleRedirect(path, role)).toBeNull()
  })

  it('sem papel (sem locadora selecionada), entradas públicas e fora do painel: nada', () => {
    expect(resolveAdminRoleRedirect('/admin/dashboard', null)).toBeNull()
    expect(resolveAdminRoleRedirect('/admin/dashboard', undefined)).toBeNull()
    expect(resolveAdminRoleRedirect('/admin/login', 'FINANCIAL')).toBeNull()
    expect(resolveAdminRoleRedirect('/admin/entrada', 'FINANCIAL')).toBeNull()
    expect(resolveAdminRoleRedirect('/area-cliente', 'FINANCIAL')).toBeNull()
    expect(resolveAdminRoleRedirect('/administrativo', 'FINANCIAL')).toBeNull()
  })
})
