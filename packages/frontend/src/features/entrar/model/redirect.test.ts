import { describe, expect, it } from 'vitest'
import {
  NEUTRAL_REDIRECT,
  resolveAuthCallbackRedirect,
  resolveEntrarSessionRedirect,
  resolveEntrarSubmitRedirect,
  resolveLoginRedirect,
  resolveMembershipRedirect,
  safeInternalCallback,
  signInHref,
  reauthenticationHref,
} from './redirect'

const LEGACY_ADMIN_EMAIL = 'admin@gblocacoes.com.br'

it('retorno da reautenticação só leva rota/seleção, sem ação ou chave', () => {
  const href = new URL(
    reauthenticationHref('/admin/assinatura', '?locadora=alfa'),
    'https://app.example.test'
  )
  expect(href.pathname).toBe('/login')
  expect(href.searchParams.get('callbackUrl')).toBe(
    '/admin/assinatura?locadora=alfa'
  )
  expect(href.searchParams.get('reauthenticate')).toBe('1')
  expect([...href.searchParams.keys()].sort()).toEqual([
    'callbackUrl',
    'reauthenticate',
  ])
})
it.each([
  'https://evil.test',
  '//evil.test',
  '/admin/../admin/assinatura',
  '/%2f%2fevil.test',
])('retorno inválido de reautenticação não é propagado: %s', (route) => {
  expect(reauthenticationHref(route)).toBe('/login?reauthenticate=1')
})

describe('resolveMembershipRedirect', () => {
  it('decide pelo papel na locadora selecionada', () => {
    expect(resolveMembershipRedirect('ADMIN')).toBe('/admin/dashboard')
    expect(resolveMembershipRedirect('CLIENT')).toBe('/area-cliente')
    expect(resolveMembershipRedirect('FINANCIAL')).toBe('/area-cliente')
    expect(resolveMembershipRedirect('OPERATOR')).toBe('/area-cliente')
  })

  it('sem locadora selecionada ou com papel desconhecido usa o destino neutro', () => {
    expect(NEUTRAL_REDIRECT).toBe('/')
    expect(resolveMembershipRedirect(null)).toBe(NEUTRAL_REDIRECT)
    expect(resolveMembershipRedirect(undefined)).toBe(NEUTRAL_REDIRECT)
    expect(resolveMembershipRedirect('SUPERUSER')).toBe(NEUTRAL_REDIRECT)
  })
})

describe('resolveLoginRedirect', () => {
  it('usa callback interno', () => {
    expect(
      resolveLoginRedirect({ callbackUrl: '%2Fequipamentos', role: 'ADMIN' })
    ).toBe('/equipamentos')
  })

  it('ignora callback externo', () => {
    expect(
      resolveLoginRedirect({ callbackUrl: 'https://evil.test', role: 'CLIENT' })
    ).toBe('/area-cliente')
    expect(
      resolveLoginRedirect({ callbackUrl: '//evil.test', role: 'CLIENT' })
    ).toBe('/area-cliente')
    expect(
      resolveLoginRedirect({
        callbackUrl: 'https://evil.test',
        email: 'a@b.com',
      })
    ).toBe(NEUTRAL_REDIRECT)
  })

  it('papel ADMIN da locadora selecionada vai ao dashboard', () => {
    expect(
      resolveLoginRedirect({
        callbackUrl: null,
        email: 'a@b.com',
        role: 'ADMIN',
      })
    ).toBe('/admin/dashboard')
  })

  it('e-mail fixo não concede destino administrativo', () => {
    expect(
      resolveLoginRedirect({ callbackUrl: null, email: LEGACY_ADMIN_EMAIL })
    ).toBe(NEUTRAL_REDIRECT)
    expect(
      resolveLoginRedirect({
        callbackUrl: null,
        email: LEGACY_ADMIN_EMAIL,
        role: null,
      })
    ).toBe(NEUTRAL_REDIRECT)
    expect(
      resolveLoginRedirect({
        callbackUrl: null,
        email: LEGACY_ADMIN_EMAIL,
        role: 'CLIENT',
      })
    ).toBe('/area-cliente')
  })

  it('cliente da locadora selecionada vai para a área do cliente; sem seleção, destino neutro', () => {
    expect(
      resolveLoginRedirect({
        callbackUrl: null,
        email: 'cliente@email.com',
        role: 'CLIENT',
      })
    ).toBe('/area-cliente')
    expect(
      resolveLoginRedirect({ callbackUrl: null, email: 'cliente@email.com' })
    ).toBe(NEUTRAL_REDIRECT)
  })
})

describe('resolveEntrarRedirect', () => {
  it('na sessão, decide pelo papel da locadora selecionada e não pelo e-mail', () => {
    expect(resolveEntrarSessionRedirect('a@b.com', 'ADMIN')).toBe(
      '/admin/dashboard'
    )
    expect(resolveEntrarSessionRedirect('a@b.com', 'CLIENT')).toBe(
      '/area-cliente'
    )
    expect(resolveEntrarSessionRedirect(LEGACY_ADMIN_EMAIL, null)).toBe(
      NEUTRAL_REDIRECT
    )
    expect(resolveEntrarSessionRedirect(LEGACY_ADMIN_EMAIL)).toBe(
      NEUTRAL_REDIRECT
    )
  })

  it('no submit ainda não há locadora selecionada: destino neutro para qualquer e-mail', () => {
    expect(resolveEntrarSubmitRedirect('a@b.com')).toBe(NEUTRAL_REDIRECT)
    expect(resolveEntrarSubmitRedirect(LEGACY_ADMIN_EMAIL)).toBe(
      NEUTRAL_REDIRECT
    )
  })
})

describe('resolveAuthCallbackRedirect', () => {
  it('espera a sessão e manda anônimo ao login', () => {
    expect(
      resolveAuthCallbackRedirect({
        status: 'loading',
        hasUser: false,
        callbackUrl: null,
      })
    ).toBeNull()
    expect(
      resolveAuthCallbackRedirect({
        status: 'unauthenticated',
        hasUser: false,
        callbackUrl: null,
      })
    ).toBe('/login')
    expect(
      resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: false,
        callbackUrl: null,
      })
    ).toBeNull()
  })

  it('reusa a regra do login quando há usuário', () => {
    expect(
      resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: true,
        email: LEGACY_ADMIN_EMAIL,
        callbackUrl: '%2Fequipamentos',
      })
    ).toBe('/equipamentos')
    expect(
      resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: true,
        role: 'CLIENT',
        callbackUrl: null,
      })
    ).toBe('/area-cliente')
    expect(
      resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: true,
        role: 'ADMIN',
        callbackUrl: null,
      })
    ).toBe('/admin/dashboard')
  })

  it('e-mail fixo sem locadora selecionada vai ao destino neutro', () => {
    expect(
      resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: true,
        email: LEGACY_ADMIN_EMAIL,
        callbackUrl: null,
      })
    ).toBe(NEUTRAL_REDIRECT)
  })
})

describe('callbackUrl só aceita caminho relativo seguro', () => {
  const APP_ORIGIN = 'https://app.example.test'
  // [valor como chega (cru ou já decodificado pelo host), destino esperado]
  const accepted: Array<[string, string]> = [
    ['/equipamentos', '/equipamentos'],
    ['%2Fequipamentos', '/equipamentos'],
    [
      '/equipamentos/eq-1?periodo=semanal#fotos',
      '/equipamentos/eq-1?periodo=semanal#fotos',
    ],
    ['%2Farea-cliente%2Fhistorico%2F1', '/area-cliente/historico/1'],
    ['/orcamento?equipmentId=eq%201', '/orcamento?equipmentId=eq 1'],
    ['/', '/'],
    // Ponto dentro do nome do segmento não é segmento de ponto; codificação no query não muda o caminho.
    [
      '/equipamentos/serra-2.0?periodo=semanal',
      '/equipamentos/serra-2.0?periodo=semanal',
    ],
    ['/orcamento?volta=%252Fequipamentos', '/orcamento?volta=%2Fequipamentos'],
  ]
  const rejected: Array<[string, string]> = [
    ['https://evil.test', 'esquema absoluto'],
    ['HTTPS://evil.test/area-cliente', 'esquema em maiúsculas'],
    ['javascript:alert(1)', 'esquema javascript'],
    ['http:/evil.test', 'esquema sem barras'],
    ['//evil.test', 'protocolo relativo'],
    ['%2F%2Fevil.test', 'protocolo relativo codificado'],
    ['/\\evil.test', 'barra seguida de barra invertida'],
    ['%2F%5Cevil.test', 'barra invertida codificada'],
    ['\\\\evil.test', 'barras invertidas'],
    ['/%5C%5Cevil.test', 'barras invertidas codificadas depois da barra'],
    ['/equipamentos\\..\\admin', 'barra invertida no meio'],
    ['/\t/evil.test', 'TAB entre as barras'],
    ['%2F%09%2Fevil.test', 'TAB codificado'],
    ['/\r\n/evil.test', 'CR/LF entre as barras'],
    ['%2F%0D%0A%2Fevil.test', 'CR/LF codificados'],
    ['/\n/evil.test', 'LF entre as barras'],
    ['/\u0000/evil.test', 'NUL'],
    ['/\u007f/evil.test', 'DEL'],
    [' /evil.test', 'espaço antes da barra'],
    ['equipamentos', 'caminho sem barra inicial'],
    ['%E0%A4%A', 'codificação malformada'],
    ['', 'vazio'],
    // Segmentos de ponto: o navegador os remove e o caminho normalizado vira "//host" (protocolo relativo).
    ['/.//evil.test', 'segmento de ponto antes de //'],
    ['%2F.%2F%2Fevil.test', 'segmento de ponto codificado'],
    ['/..//evil.test', 'segmento de ponto-ponto antes de //'],
    ['/a/..//evil.test', 'ponto-ponto no meio antes de //'],
    ['/%252e%252e//evil.test', 'ponto-ponto codificado duas vezes'],
    ['/%252E.//evil.test', 'ponto codificado em maiúsculas misturado'],
    ['/area-cliente/../admin/dashboard', 'ponto-ponto que troca de caminho'],
    ['/equipamentos/.', 'segmento de ponto no fim'],
    // Barra e barra invertida codificadas que sobram depois da decodificação.
    ['/%252f%252fevil.test', 'barras codificadas duas vezes'],
    ['/%255C%255Cevil.test', 'barras invertidas codificadas duas vezes'],
  ]

  it.each(accepted)(
    'aceita %j → %j e continua na mesma origem',
    (callbackUrl, expected) => {
      expect(safeInternalCallback(callbackUrl)).toBe(expected)
      expect(resolveLoginRedirect({ callbackUrl, role: 'CLIENT' })).toBe(
        expected
      )
      expect(new URL(expected, APP_ORIGIN + '/login').origin).toBe(APP_ORIGIN)
    }
  )

  it.each(rejected)(
    'recusa %j (%s) e usa o destino do papel',
    (callbackUrl) => {
      expect(safeInternalCallback(callbackUrl)).toBeNull()
      expect(resolveLoginRedirect({ callbackUrl, role: 'CLIENT' })).toBe(
        '/area-cliente'
      )
      expect(resolveLoginRedirect({ callbackUrl, role: null })).toBe(
        NEUTRAL_REDIRECT
      )
      expect(
        resolveAuthCallbackRedirect({
          status: 'authenticated',
          hasUser: true,
          role: 'ADMIN',
          callbackUrl,
        })
      ).toBe('/admin/dashboard')
    }
  )

  it('nenhum destino recusado seria da mesma origem se fosse seguido (prova de que o risco é real)', () => {
    const offOrigin = [
      '/\\evil.test',
      '/\t/evil.test',
      '/\r\n/evil.test',
      '//evil.test',
      'https://evil.test',
    ]
    for (const value of offOrigin)
      expect(new URL(value, APP_ORIGIN + '/login').origin).not.toBe(APP_ORIGIN)
  })

  it('segmentos de ponto: o caminho normalizado, que o roteador usa como URL canônica, sai da origem (prova de que o risco é real)', () => {
    for (const value of [
      '/.//evil.test',
      '/..//evil.test',
      '/a/..//evil.test',
      '/%2e%2e//evil.test',
    ]) {
      const normalized = new URL(value, APP_ORIGIN + '/login')
      expect(normalized.origin).toBe(APP_ORIGIN)
      expect(normalized.pathname).toBe('//evil.test')
      expect(new URL(normalized.pathname, APP_ORIGIN).origin).not.toBe(
        APP_ORIGIN
      )
    }
  })

  it('callback malformado não lança no fluxo de login', () => {
    expect(() =>
      resolveLoginRedirect({ callbackUrl: '%E0%A4%A', role: 'ADMIN' })
    ).not.toThrow()
    expect(() =>
      resolveAuthCallbackRedirect({
        status: 'authenticated',
        hasUser: true,
        callbackUrl: '%',
      })
    ).not.toThrow()
  })
})

describe('signInHref (login com retorno para onde a pessoa estava)', () => {
  it('volta ao caminho com a query quando o login aceita o retorno sem mudar', () => {
    expect(signInHref('/equipamentos/eq-1', '?periodo=semanal')).toBe(
      '/login?callbackUrl=%2Fequipamentos%2Feq-1%3Fperiodo%3Dsemanal'
    )
    expect(signInHref('/equipamentos/eq-1')).toBe(
      '/login?callbackUrl=%2Fequipamentos%2Feq-1'
    )
  })

  it('query que o login recusaria ou mudaria ao decodificar: volta só ao caminho', () => {
    expect(signInHref('/equipamentos/eq-1', '?nome=a%20b')).toBe(
      '/login?callbackUrl=%2Fequipamentos%2Feq-1'
    )
    expect(signInHref('/equipamentos/eq-1', '?x=a\\b')).toBe(
      '/login?callbackUrl=%2Fequipamentos%2Feq-1'
    )
  })

  it('caminho que o login recusaria: login sem retorno', () => {
    expect(signInHref('/equipamentos/%2e%2e//evil.test', '?a=1')).toBe('/login')
    expect(signInHref('//evil.test')).toBe('/login')
    expect(signInHref(undefined, '?a=1')).toBe('/login')
  })
})
